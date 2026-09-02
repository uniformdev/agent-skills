# Best practices

Product documentation: [automation best practices](https://docs.uniform.app/docs/guides/automations/best-practices).

## The workflow-stage idiom

An automation owns a stage: it fires when content enters, does its work, and transitions forward on success or to an error stage on failure. That makes "is the work done?" observable, bounds how often expensive work runs, and is the supported shape for computed fields — Uniform has no save-blocking computation.

```ts
triggers: [
  {
    type: 'workflow.transition',
    filter: `input.newStage.workflowId == "${WORKFLOW_ID}" && input.newStage.stageId == "${STAGE_ID}"`,
  },
],
```

- One owning automation per auto-transitioning stage. Additional automations on that stage must be notify-only, or they race to transition the same entity.
- Split a multi-stage flow across multiple automations, one per stage — cycle protection below is why.
- Filter on workflow and stage IDs, not names.

Stage setup is dashboard work — tell the user, do not attempt it. The owned stage needs the automation's role on **Modify**, and on **Can transition** for every outgoing edge the run will take. Leave **Auto publish** and **Require validity** off on destinations Scout or `ScoutClient` writes into; those settings run in the editor. Details: [automation best practices](https://docs.uniform.app/docs/guides/automations/best-practices), [workflows](https://docs.uniform.app/docs/guides/composition/workflows). The transition itself is a guarded `save` — [sdk-api.md](sdk-api.md).

## Cycle and cascade protection

Automations call Uniform APIs, which fire events, which trigger automations. Two guards apply.

Provenance suppression: automation-originated writes carry run metadata on the automation's token, and dispatch refuses to re-fire the originating automation on its own writes. A handler on `entry.changed` that saves an entry will not re-invoke itself; the suppressed invocation is recorded.

A depth budget increments a generation counter on those writes and caps it at four, which catches ping-pong (A fires B fires A). Exceeding it ends the run with a log entry explaining why.

The design consequence: a stage automation that transitions into another automated stage must be a different automation from the one that owns the destination. If review and translation lived in one automation, the transition into Translation would be a self-retrigger and provenance suppression would abort it.

## Limits

| Limit | Value | What it changes |
|---|---|---|
| Wall-clock / CPU per run | 15 min / 5 min (awaiting is free) | Nothing retries a timeout: page a backlog, never poll an external job to completion |
| Outbound requests per run | 100 | Batch list reads instead of looping one request per item |
| Bundle size | 1 MB | Measure after adding an SDK; if it doesn't fit, use `fetch` |
| Cycle depth | 4 generations | A chain of automations is at most four hops deep |

The sandbox is web-standard: `fetch` and `crypto.subtle` are global; Node builtins, streams, and the filesystem are not. An import that touches `self` at module scope breaks the deploy (`isomorphic-fetch` is the usual case). See [execution limits](https://docs.uniform.app/docs/guides/automations#execution-model-and-limits).

## Design for unordered, at-least-once delivery

Events broadcast in parallel with no ordering, no dedup, and no retry.

- Running twice on the same input is harmless. Derive deterministic IDs (a UUIDv5 over a stable external key) so a repeat updates the same entry.
- Check whether the work is already done before repeating it. If so, log and skip the operation but still advance the workflow stage.
- Tolerate any arrival order. `entry.changed` may land after `entry.published`.
- Sequence with stages, or with one automation.

## Outcomes

A handler returns one of four outcomes — that is what run history shows. Returning nothing means success; an unhandled exception means failure.

- `success` — the work was done. Also correct when the primary work succeeded and a best-effort side effect failed and was logged. Finding nothing to do is still `success` when the job was to look.
- `rejected` — this event was not mine (wrong type, a payload this handler was not asked to act on). Healthy, not a problem.
- `unauthorized` — the automation's own check failed (webhook signature or shared secret).
- `failure` — missing configuration, exhausted AI credits, an upstream error.

The platform records `timeout` when a run exceeds the CPU, wall-clock, or outbound-request budget — that outcome is not yours to return.

Return an explicit outcome on every path, including early returns.

## Filters

Content-event and incoming-webhook triggers take an optional CEL `filter` over `{ input, trigger }`. Not `true` means the event is dropped: no run, no log, no cost. `schedule` and `aiTool` take none.

```ts
'input.type == "article"'
'!input.initiator.is_api_key'
'input.newStage.workflowId == "<uuid>" && input.newStage.stageId == "<uuid>"'
'input.method == "POST" && input.headers["x-github-event"] == "push"'
```

Build filters from shared constants with a template literal. CEL is case-sensitive.

Keep filters total: a missing field is an evaluation error, recorded as a `failure` run. A `workflow.transition` payload does not carry content type — filter on workflow and stage IDs; type-check in the handler. Authenticity checks belong in the handler (`unauthorized`), not the filter.

## Authenticating an incoming webhook

The request is `{ method, headers, query, rawBody }` with header keys lower-cased. Verify it yourself.

A shared secret in a header is adequate when the URL itself is secret. Compare against a literal `process.env.UNIFORM_ENV_*` read, return `{ outcome: 'unauthorized' }` on mismatch, then parse `rawBody`.

HMAC is over the exact bytes in `rawBody`. Verify with `crypto.subtle`, then parse. `JSON.parse` then `JSON.stringify` will not match.

The endpoint acknowledges immediately with `200` and runs asynchronously. `200` means received. If the caller needs a real result, it must poll something you write, or you need your own backend.

## One automation, one job

A run cannot pause, resume, retry, or signal another run, and there is no human-in-the-loop inside a run.

- Work that must stay together belongs in one automation.
- A human checkpoint in the middle belongs in two, split at the checkpoint and joined by a workflow stage.
- Real orchestration (long-running, fan-out/fan-in, an external state machine) belongs on your own backend, triggered by an incoming-webhook automation.

## Read with a management client

Delivery-shaped content has patterns and data resources resolved. Saving it back unlinks patterns and destroys data resource definitions. Read with a management client whenever you intend to write.

## Notifications, not logs

Logs are developer-facing. Notifications (`NotificationsClient` or an external channel) are how you tell a human something happened.

Runs and logs are retained for 7 days and are not redacted: log the operation and the entity id, never a secret, token, or whole payload. Logs are not an audit trail — anything that must outlive the week belongs on the content or in an external system.

## Reference use cases

| Job | Shape |
|---|---|
| AI review / translation on an editorial stage | `workflow.transition` filtered to the stage, plus an `aiTool` automation for notifications |
| Inbound sync from a PIM/DAM/commerce system | `incomingWebhook` + signature verification + deterministic IDs + `EntryManagementClient.save` |
| Outbound sync on publish | `entry.published` / `composition.published` + a `fetch` to the downstream system |
| CDN purge / site rebuild | `composition.published` (or `release.launched`) + a deploy hook `fetch` |
| Search index sync | `entry.published` for upserts, `entry.deleted` for removals, one automation with both triggers |
| Validation gate | `workflow.transition` into a review stage; advance on pass, transition to an error stage and notify on fail |
| Nightly maintenance | `schedule` + management client queries |
| Governed action for Scout | `aiTool` with a tightly scoped `description` |
| Reindex on publish *and* nightly | one automation, `entry.published` + `schedule`, narrowed on `input.eventType` |
