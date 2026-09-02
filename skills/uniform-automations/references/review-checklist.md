# Review checklist

Walk this before deploying an automation, and when reviewing someone else's.

## Shape

- Filename is the public ID.
- `triggers` is an array: at most one `schedule`, at most one `incomingWebhook`, no duplicate event names, `aiTool` exclusive.
- Content-mutating work is bound to a stage.
- User has been told to grant the automation role Modify and Can transition on the owned stage.
- User has been told to leave Auto publish and Require validity off on stages Scout moves content into.
- One job. A human checkpoint in the middle means two automations.

## Filters

- Every cheap predicate is in the filter.
- Filters are total.
- Workflow and stage filters compare IDs from shared constants, not names.
- Authenticity checks stay in the handler.

## Identity and secrets

- Role name came from the user; omit `permissions` if the automation never calls Uniform.
- Secrets are literal `process.env.UNIFORM_ENV_*`.
- Missing configuration is `failure` with a log naming the variable.
- Logs carry the operation and the entity id.

## Reads and writes

- Reads that will be written back: invoke `uniform-sdk`, then return here.
- Management client for anything written back.
- Thread `editionId` and `releaseId` from the event through both the read and the write.
- A 409 after your own preceding write is retried by re-reading.

## Behavior

- Running twice on the same input is harmless.
- Work that costs money checks whether it is already done before doing it.
- Explicit outcome on every path.
- Best-effort side effects log a warning and continue.
- Human-facing messages go to notifications; logs carry the run's own story.
- For an `aiTool`, logs say something useful on every path.

## Budget and bundle

- Batch list reads; a run gets 100 outbound requests.
- Work fits in the wall-clock; a backlog job pages.
- External jobs callback through an incoming-webhook automation.
- Third-party SDKs measured against the 1 MB ceiling; anything that doesn't fit is `fetch`.
- No import that touches browser globals at module scope or needs Node streams.

## Tests

- Default export called with `{ trigger, input, uniformCredentials }`.
- `input` fixture carries the `eventType` discriminant.
- `uniformCredentials` present whenever metadata declares `permissions`.
- Rejection path and at least one failure path covered.
