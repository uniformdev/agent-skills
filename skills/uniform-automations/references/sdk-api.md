# The automations SDK

Module shape, credentials, and the write patterns the types don't lead you to. Also in [code automations](https://docs.uniform.app/docs/guides/automations/code-automations).

## The module

An automation is a module that default-exports `defineAutomation`.

```ts
import { defineAutomation } from '@uniformdev/automations-sdk';

export default defineAutomation({
  metadata: {
    name: 'Sync published articles downstream',
    description: 'Pushes published article entries to the search index.',
    triggers: [{ type: 'entry.published', filter: 'input.type == "article"' }],
    permissions: { role: 'developer' },
  },
  handler: async ({ input, log, uniformCredentials }) => {
    log.info(`Indexing "${input.name}" (${input.id}).`);
    // ...work...
    return { outcome: 'success' };
  },
});
```

## The invoke contract

Uniform invokes that default export with `{ trigger, input, uniformCredentials }` and it resolves to `{ outcome, logs }`, where each log entry is `{ level, message, createdAt }`.

That is the whole runtime surface: import the module, call it with a payload, assert on the result.

```ts
import automation from './notify-on-publish.automation';

const result = await automation({
  trigger: { type: 'entry.published' },
  input: buildEntryPublishedPayload({ id: 'entry-1', name: 'Hello' }),
  uniformCredentials: { projectId: 'p1', bearerToken: 'token' },
});

expect(result.outcome).toBe('success');
expect(result.logs.map((entry) => entry.message)).toContain('Published Hello');
```

Event payloads are wide — build them from a fixture helper; types come from `@uniformdev/webhooks`. Two traps: a fixture that omits `uniformCredentials` when metadata declares `permissions` fails before the handler runs, and the `input` fixture must carry the `eventType` discriminant.

## SDK clients

Automations call the Uniform APIs through the SDK clients. The two you'll need in almost every automation are the management clients for the entity you are changing:

```ts
import { CompositionManagementClient, EntryManagementClient } from '@uniformdev/canvas';

const entries = new EntryManagementClient(uniformCredentials);
const compositions = new CompositionManagementClient(uniformCredentials);
```

Credentials come from `context.uniformCredentials`, a `UniformConnectionParams` every Uniform client accepts. Clients are not pre-wired, so the runtime doesn't bundle every client into every automation.

Credentials exist only when metadata declares `permissions`: the types then make `uniformCredentials` non-optional, and the runtime refuses to invoke a handler that promised credentials without them. They carry the automation's machine identity, except `aiTool` runs, which carry the invoking user.

Reads that will be written back: invoke `uniform-sdk`, then return here. Thread `editionId` and `releaseId` from the event — next section.

## Threading the event payload through a read-modify-write

An event payload names the row that changed. Carry that identity into both the read and the write.

```ts
const fresh = await entries.get({
  entryId: input.id,
  pattern: 'any',
  editionId: input.editionId,
  releaseId: input.trigger?.type === 'release' ? input.trigger.id : undefined,
});
```

`input.editionId` pins the edition. `input.trigger` tells you whether the change happened on a release — drop `releaseId` and you read the base version.

## Transitioning a workflow stage

There is no separate transition call. `workflowId` and `workflowStageId` are fields on the entity, so moving a stage is a guarded save.

```ts
import { convertEntryToPutEntry } from '@uniformdev/canvas';

const fresh = await entries.get({ entryId, pattern: 'any' });

await entries.save(
  { ...convertEntryToPutEntry(fresh), workflowId, workflowStageId: targetStageId },
  { ifUnmodifiedSince: fresh.modified }
);
```

Compositions work the same way through `CompositionManagementClient.save`.

Read the stage graph with `WorkflowClient.list()` (`{ results: WorkflowDefinition[] }` — `.get()` is deprecated). A `workflow.transition` event names the stage landed on, not what is reachable; look up `workflow.stages[currentStageId].transitions`. Resolve the target from the graph rather than hardcoding its ID.

Re-read immediately before the transition. A `modified` captured before your own enrichment write is stale and the transition 409s. Treat that 409 as retryable: re-read, try again a couple of times, then log a warning and leave the entity where a human can advance it. Do not fail the run — the work itself succeeded.

Guarded save: [templates/on-workflow-stage.automation.ts](../templates/on-workflow-stage.automation.ts). 409 retry: [templates/scout-client.automation.ts](../templates/scout-client.automation.ts).

## Notifications

`NotificationsClient` (in `@uniformdev/automations-sdk`, experimental) sends an in-app message.

```ts
import { NotificationsClient } from '@uniformdev/automations-sdk';

await new NotificationsClient(uniformCredentials).create({
  projectId: input.project.id,
  recipients: [input.initiator.id],
  summary: { format: 'markdown', value: `**${input.name}** was rejected in review.` },
  entity: { type: 'entry', entityId: input.id },
});
```

Recipients are user subject IDs (1–100); summary caps at 256 characters. `entity` is optional and deep-links; extra fields vary by kind (entries and compositions take `releaseId` and `editionId`, most platform types take `entityId` alone, `{ type: 'external', url }` links out). Wrap the send so a failure logs a warning instead of failing the run.

## Secrets

Secrets are injected as `UNIFORM_ENV_`-prefixed environment variables and inlined at deploy time by scanning the source for literal accesses. `process.env.UNIFORM_ENV_SLACK_TOKEN` works; `process.env[name]` compiles, deploys, and reads `undefined` at runtime. See [secrets](https://docs.uniform.app/docs/guides/automations/code-automations#secrets-and-environment-variables).

```ts
const token = process.env.UNIFORM_ENV_SLACK_TOKEN;
if (!token) {
  log.error('UNIFORM_ENV_SLACK_TOKEN is not configured.');
  return { outcome: 'failure' };
}
```

Because inlining happens at deploy, rotating a secret requires a redeploy for the automation to see the new value.
