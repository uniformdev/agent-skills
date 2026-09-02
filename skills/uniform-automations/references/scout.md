# Scout and automations

Scout meets automations in three ways with different security models. Scout automations can also be created in the dashboard ([Scout automations](https://docs.uniform.app/docs/guides/automations/scout-automations)); this file is the code path. Instructions follow [Scout best practices](https://docs.uniform.app/docs/guides/ai/scout/best-practices), except an automation has no one to ask follow-up questions of. Runs consume [AI credits](https://docs.uniform.app/docs/guides/ai/ai-credits).

| | Scout automation | `ScoutClient` in a handler | `aiTool` automation |
|---|---|---|---|
| Direction | Uniform runs the agent for you | your code calls the agent | the agent calls your code |
| You author | instructions | a handler | a handler + `inputSchema` |
| Identity | the automation's machine identity | the automation's machine identity | the invoking Scout user |
| Appears in runs list | yes | yes | no — the result goes to Scout |
| Consumes AI credits | yes | yes | only the calling turn does |

## Scout automations (`defineScoutAutomation`)

An automation with no code. On each trigger, Uniform runs Scout headlessly with your instructions as the user message and the trigger payload attached as context. The agent's tool calls are the automation's actions, performed as its machine identity. Worked example: [templates/scout-workflow-stage.automation.ts](../templates/scout-workflow-stage.automation.ts).

Constraints, all enforced by the types or the deploy:

- `permissions` is required. The name comes from the user (Identity); they must hold it to deploy.
- No `aiTool` trigger — that would be circular. Events, schedule, and incoming webhook are allowed.
- No `compatibilityDate`. The runtime is Uniform's.
- Instructions cap at 16,384 characters.

### Writing instructions

The agent sees your instructions followed by the fired trigger and its payload as JSON. It has no other view of what it is reacting to, so anything it needs must be in the instructions or the payload.

A structure that works:

```
## Step 1: <do the work>
<Role framing: "You are an expert copy editor…">
<What the subject is: "The content ready for your review is the entity in the trigger payload.">
<Scope: which locales, which field kinds to ignore>
<Explicit criteria, as a list>
<The decision bar: "The bar for rejection is high — you must be confident…">

## Step 2: <take the action>
<The concrete tool action: execute the transition, save the entry, call the notify tool>

## Step 3: <report>
<What to post where, using which payload fields — e.g. `entity.url` from the trigger payload>

Reporting your run outcome: report `failure` if <the partial-success case>.
```

State the outcome contract explicitly. The runner asks the agent to declare a terminal outcome plus a one-line summary, and that declaration becomes the run's outcome. Spell out what counts as failure rather than success, especially for partial work — "a partial translation is not a success".

Reference payload fields by name. The agent can read `entity.url` or `input.newStage.stageName`, but only if you point at them.

Give it a bar, not just a task. "Reject only when confident" prevents an agent from thrashing a workflow on ambiguous content.

Anything that isn't an agent capability must be a tool. A Scout automation has no code, so it cannot call a Slack webhook. Author that once as an `aiTool` automation and tell the instructions to call it by name.

The run log holds the full agent transcript. Read it before rewriting instructions.

## Calling Scout from a handler (`ScoutClient`)

Reach for this when most of the job is deterministic and one step needs judgement. Full `invoke` surface: [Scout Client SDK](https://docs.uniform.app/docs/sdk/scout-client).

```ts
import { ScoutClient } from '@uniformdev/automations-sdk/ai';

const scout = new ScoutClient(uniformCredentials);

const { text } = await scout.invoke({
  message: `Get the ${input.id} entry and check it against the brand guidelines.`,
});
```

Result is `{ text, messages }`, plus `structuredOutput` when you passed a schema.

`invoke` throws when the team is out of AI credits, and when an `outputSchema` was supplied but Scout finished without a conforming result. Catch it, log the message, return `{ outcome: 'failure' }` — the error string is not a contract.

### Structured results

Pass an `outputSchema` when you need a machine-readable answer. Scout must record a conforming result as its final action.

```ts
import * as z from 'zod';

const { structuredOutput } = await scout.invoke({
  message: 'Summarize this entry and rate its SEO readiness.',
  outputSchema: z.object({
    summary: z.string().describe('Two sentences, plain text, no marketing language.'),
    seoScore: z.number().describe('0-100.'),
    issues: z.array(z.string()).describe('One short sentence per issue found.'),
  }),
});
```

A zod schema types `structuredOutput`; a plain JSON Schema object leaves it `unknown`. `.describe()` on each field is the instruction the model reads — usually a better home for formatting than the message. Prefer a structured result whenever you intend to write the answer into content.

If you write to an entry immediately after Scout did, re-read before your own save. Scout's writes reach the read edge slightly after `invoke` resolves, so a `modified` captured earlier is stale and the save 409s. See [sdk-api.md](sdk-api.md).

`aiTool` automations cannot call Scout by default — the run already sits inside a Scout turn. Credentials carry an invalid AI host to make this fail loudly. If you genuinely need it, pass an explicit `aiApiHost` and make certain the prompt cannot re-trigger the automation.

## `aiTool` automations

An automation exposed to Scout as a callable tool: the agent reasons, your code acts.

```ts
export default defineAutomation({
  metadata: {
    name: 'Creature info',
    // Load-bearing: the LLM reads this to decide when to call the tool.
    description: 'Gets you information about a creature in D&D',
    triggers: [{ type: 'aiTool' }],
    inputSchema: z.object({
      name: z.string().describe('The name of the creature, lowercase (e.g. "owlbear").'),
    }),
  },
  handler: async ({ input, log }) => {
    const res = await fetch(`https://www.dnd5eapi.co/api/2014/monsters/${input.name}`);
    if (!res.ok) {
      log.error(`Failed to fetch creature information: ${res.statusText}`);
      return { outcome: 'failure' };
    }
    log.info(JSON.stringify(await res.json(), null, 2));
  },
});
```

`description` is the selection criterion — write it as an instruction and scope it. `.describe()` every schema field; say what the value is and where to get it (`entity.url` from the trigger payload).

Logs are the tool result: every level goes to the agent, and nothing else does. Say what happened even when nothing happened — silence reads as success. When returning data, a short markdown list beats a JSON dump; end with what the agent should do next.

It runs as the invoking user: no `permissions`, no privilege escalation. Runs do not appear in the runs list; debug through the Scout conversation. `inputSchema` is converted from zod to JSON Schema at deploy; Zod 4 is a peer dependency.
