# Content API clients

`@uniformdev/canvas` ships one client class per job. Picking the right one is the single most consequential decision when reading or writing Uniform content, because the wrong choice silently destroys data rather than erroring.

## Constructing a client

Every client takes a `ClientOptions`: `{ apiKey?, bearerToken?, projectId, apiHost?, fetch?, limitPolicy?, bypassCache?, signal? }`. Supply either an `apiKey` or a `bearerToken`.

```ts
import { EntryManagementClient } from '@uniformdev/canvas';

const entries = new EntryManagementClient({
  apiKey: process.env.UNIFORM_CLI_API_KEY,
  projectId: process.env.UNIFORM_PROJECT_ID,
});
```

Delivery clients take a `DeliveryClientOptions`, which adds `edgeApiHost` (defaults to `https://uniform.global`) and `disableSWR`.

The default limit policy allows six concurrent requests. Leave it alone unless you are deliberately batching.

## Delivery vs management

The mode is the client class, not a call-time flag, and the choice is made once at construction.

Delivery clients (`EntryDeliveryClient`, `CompositionDeliveryClient`, `RouteClient`) are read-only, hit the edge, and return resolved content — patterns expanded, data resources fetched, component `_id`s stripped. They default to published and cached.

Management clients (`EntryManagementClient`, `CompositionManagementClient`, `ContentTypeClient`, `ComponentDefinitionClient`, `WorkflowClient`, `CategoryClient`, `LabelClient`, `ReleaseClient`, `LocaleClient`, and the rest) read the canonical, PUT-safe shape from origin — patterns as references, data resources as definitions. They default to draft and `bypassCache: true`.

The split exists because reading delivery-shaped content and writing it back destroys data: it unlinks patterns and replaces data resource definitions with their fetched results. Read with a management client whenever you intend to write. Reading to render, to send somewhere else, or to inspect resolved values is exactly what delivery is for, and it is the right client for "find published entries matching X" because published state and resolved data are what you want there.

Do not set `bypassCache: true` on high-volume delivery reads; you will hit rate limits.

Management clients also accept `format: 'editor'` per call, which expands patterns for display while staying PUT-safe.

## Reading an entry

`get` returns an envelope around the content, and most of what a write needs lives on the envelope rather than inside it.

```ts
const fresh = await entries.get({ entryId, pattern: 'any' });

fresh.modified;          // the concurrency token
fresh.workflowId;        // and fresh.workflowStageId — undefined means the workflow's initial stage
fresh.editionId;
fresh.entry.fields;      // the actual content
```

`const { entry } = await entries.get(...)` compiles and gives you the content, so it is fine for a read-only pass. Do not use it when you intend to write: `convertEntryToPutEntry` and `ifUnmodifiedSince` both need the envelope you just threw away.

Three read arguments change the result and get forgotten.

`pattern` defaults to `false`, which means "regular entries only", and the flag describes what the row *is* rather than where it came from. An entry that is itself a pattern — the reusable template other entries point at — is excluded by that default. An ordinary entry created from a pattern is not excluded; it carries `_pattern` and still reads back normally.

Since an ID already identifies exactly one row, the kind filter has nothing useful to do on a lookup by ID and can only hide the row you asked for. When it does, `get` throws a 404 and `list` returns an empty array — both indistinguishable from the entry not existing. Pass `pattern: 'any'` for any lookup by ID.

`editionId` pins the exact row. An edition is a locale-targeted variant sharing one identity, so passing the same `editionId` on the read and the write guarantees you round-trip the same row.

`releaseId` targets a release rather than the mainline. Omit it when the change lives on a release and you will read the mainline version and write over the wrong thing.

Do not pass `locale` on a read you intend to write back. A locale-scoped read collapses each localizable field's per-locale map into a single flat value, and saving that back drops every other translation. Read unscoped and edit inside `field.locales` instead.

`get` throws `ApiClientError(404)` when the entry is absent; `list` returns an empty array. Choose based on whether "missing" is an error in your flow.

## Field shapes

An entry field is `{ type, value }` for a non-localized field and `{ type, locales: { 'en-US': value } }` for a localized one. The same field can be either depending on project configuration, so read defensively.

```ts
function readFieldValue(
  field: { value?: unknown; locales?: Record<string, unknown> } | undefined,
  locale: string
) {
  if (!field) return undefined;
  if (field.locales) return field.locales[locale];
  return field.value;
}
```

Rich text fields hold a Lexical document — a JSON tree of `{ root: { children: [...] } }`. Never assemble that by hand from a string; build the node structure explicitly, and when reading, walk the tree collecting `text` nodes rather than assuming a shape.

## Writing

`save(body, opts?)` takes a `PutEntryBody` and an optional `{ ifUnmodifiedSince }`, and returns `{ modified }` — the new concurrency token. The server rejects the write with a 409 when the row changed since that timestamp.

Build the body with `convertEntryToPutEntry(fresh)`, which strips the read-only parts (author, stats) and keeps everything the PUT expects. Hand-building the body drops fields you didn't think about.

```ts
import { convertEntryToPutEntry } from '@uniformdev/canvas';

const fresh = await entries.get({ entryId, pattern: 'any' });
const body = convertEntryToPutEntry(fresh);
body.entry.fields.summary = { type: 'text', value: summary };

await entries.save(body, { ifUnmodifiedSince: fresh.modified });
```

Pass `ifUnmodifiedSince` from a read taken immediately before the write. A token captured earlier in the same routine — before your own preceding write, for instance — is already stale and will 409.

`saveAndPublish` does the draft write and the publish in two PUTs, with the concurrency guard applying to the draft. `unpublish` drops only the published state; `remove` deletes everything. Both take an optional `editionId` to scope to one edition, and to target only the base edition you pass the same value for `editionId` and `entryId`.

Compositions follow the same vocabulary through `CompositionManagementClient`, except that `get` there returns `{ composition }`.

## Deprecated predecessors

`CanvasClient`, `ContentClient`, and the `Uncached*Client` variants are the previous generation. They still work and remain for backward compatibility, but new code should use the persona-shaped clients — the deprecation exists precisely because the old flag-based API made the "read resolved, write back, corrupt" failure representable.

- `CanvasClient` split into `CompositionDeliveryClient`, `CompositionManagementClient`, and `ComponentDefinitionClient`.
- `ContentClient` split into `EntryDeliveryClient`, `EntryManagementClient`, and `ContentTypeClient`.
- `UncachedCanvasClient`, `UncachedContentClient`, `UncachedCategoryClient`, and `UncachedLabelClient` collapsed into `bypassCache: true` on the corresponding client.

Method names moved too. The old verb-plus-noun methods became a uniform `get` / `list` / `save` / `remove` vocabulary, where `get` always means a single fetch:

```ts
// Before
const { entries } = await new ContentClient(options).getEntries({ orderBy, filters });

// After
const { entries } = await new EntryDeliveryClient(options).list({ orderBy, filters });
```

`getCanvasClient` and friends in `@uniformdev/next-app-router` are framework wrappers rather than these classes, and are unaffected.
