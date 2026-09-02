---
name: uniform-automations
description: >-
  Uniform Automations (`defineAutomation`, `defineScoutAutomation`, `ScoutClient`, `*.automation.ts`). Use when handling a Uniform content event, a schedule, an inbound webhook, an `aiTool`, a Scout workflow-stage job, a Uniform sync with an external system, or reviewing a `*.automation.ts` module.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform automations

Serverless functions authored in the user's repo and deployed with the Uniform CLI. This skill is the judgement the SDK types don't give you. Product surface: [automations guide](https://docs.uniform.app/docs/guides/automations). Signatures: JSDoc in `@uniformdev/automations-sdk` and `@uniformdev/canvas`.

## Mental model

One automation is one TypeScript module that default-exports the result of a define function. Everything else it imports is just modules.

| | `defineAutomation({ metadata, handler })` | `defineScoutAutomation(metadata, instructions)` |
|---|---|---|
| You write | code | natural-language instructions |
| The actions are | whatever your handler does | the tool calls the Scout agent makes |
| Runs as | your bundled code, in Uniform's sandbox | Uniform's Scout agent, headlessly |
| `permissions` | optional | required — the agent has no authority without a role |
| Cost | compute only | consumes AI credits per run |

Both live in `*.automation.ts`; the CLI infers which from the default export. The public ID is the filename: `send-welcome.automation.ts` deploys as `send-welcome`. Renaming orphans the deployed automation; deleting the old one is a separate `uniform automation delete`.

## Decision procedure

State, in order, before opening any file: Kind (`handler` | `scout` | `hybrid`), Binding (`stage <id>` | `event <name>` | `none`), Triggers (the array), Filter (the CEL, or `none`), Identity (`role <name from the user>` | `none`).

**1. Kind.** Handler for deterministic work. Reach for AI only where the task is judgement-shaped. `defineScoutAutomation` when the whole job is agentic; `defineAutomation` plus `ScoutClient` when you need control around one AI step. [Code automations](https://docs.uniform.app/docs/guides/automations/code-automations) are this skill's path.

**2. Binding.** Work *to* content binds to a `workflow.transition` on a stage the automation owns. A save is not a binding. One owning automation per auto-transitioning stage. [workflows](https://docs.uniform.app/docs/guides/composition/workflows).

**3. Triggers.** Always an array. Events, `schedule`, and `incomingWebhook` compose and reduce to one `eventType`-discriminated `input` union. `aiTool` is exclusive — it runs as the invoking caller. At most one `schedule`, at most one `incomingWebhook`, no duplicate event names. Event names and payloads: `@uniformdev/webhooks`, [webhooks](https://docs.uniform.app/docs/guides/webhooks), [event catalog](https://www.svix.com/event-types/us/org_2HgMLYs57QWpjfM80UPmW98qTgT/).

**4. Filter.** Cheap predicates go in the CEL `filter`; keep filters total (only fields the payload schema guarantees). Expensive predicates and authenticity checks stay in the handler. A miss records no run. [filtering](https://docs.uniform.app/docs/guides/automations/triggers#filtering).

**5. Identity.** No `permissions` means no Uniform API access. Role names are not discoverable: ask the user which role to grant, or to create one. They can only grant roles they hold; automations cannot run as a team admin. [the automation identity](https://docs.uniform.app/docs/guides/automations/code-automations#the-automation-identity).

When Kind is `scout` or `hybrid`, read [references/scout.md](references/scout.md). Then read [references/best-practices.md](references/best-practices.md) — workflow-stage, filters, outcomes, delivery, limits, and webhook auth if Triggers includes `incomingWebhook`.

Then write:

6. Module shape: [references/sdk-api.md](references/sdk-api.md). Copy a [template](templates/) when the types don't lead you there — stage (`on-workflow-stage`), Scout in a handler (`scout-client`), Scout instructions (`scout-workflow-stage`).
7. Filter first, then handler. Explicit outcome on every path.
8. Unit test by calling the default export; invoke contract in [references/sdk-api.md](references/sdk-api.md).
9. Walk [references/review-checklist.md](references/review-checklist.md) before deploying.
10. Leave deploy to the user: `npx uniform automation deploy` (or a project npm script). [CLI automation](https://docs.uniform.app/docs/guides/cli/commands/automation).

## Guardrails

- Reads that will be written back: invoke `uniform-sdk`, then return here.
- Secrets: literal `process.env.UNIFORM_ENV_*`.
- Logs: operation + entity id.
- Notifications: wrap, continue.
- Handlers: idempotent.
