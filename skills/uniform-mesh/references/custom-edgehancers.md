# Custom edgehancers

> Custom edgehancers must be enabled for a Uniform team — contact Uniform to request access.
> Deploying them needs a **Team Admin** API key.

Managed JavaScript that runs on Uniform's edge whenever a data connector fetches a data
resource. Nothing to host: you build a hook to an `.mjs` bundle and deploy it per connector
archetype. Typical added latency is 1–2 ms.

Both hooks receive a **batch** of data resources and must return the **same count in the same
order**. For `request`, every item in a batch is guaranteed to be the same archetype (same
endpoint shape and response format).

## Which hook

| | `preRequest` | `request` |
|---|---|---|
| Role | Rewrites the request definition; Uniform still performs the fetch | **Replaces** the fetch — your code returns the data |
| Runs | **Always**, on every request, even when the cache is fresh | **Only on a cache miss**; a valid cached resource never invokes it |
| Cache key | Computed *after* it runs, so it can change it | Already fixed before it runs — cannot change it |
| HTTP requests | **Not allowed** | Expected |

**`preRequest` — auth and cache manipulation.** Because it runs on every request and the cache
key is derived from the request definition (method, URL, headers, parameters, body — note
`custom` and `variables` are *not* cache-key inputs), it is the only place to vary caching:

- **Auth**: inject or swap a token per fetch — e.g. on `dataSourceVariant === 'unpublished'`,
  swap in a draft token from `dataResource.custom` and point at the preview host.
- **Draft vs published**: `fetchContext === 'editing'` distinguishes editor fetches, so you can
  add `?preview=true` or an `x-preview` header for authors only.
- **Cache control**: override `dataResource.ttl`, or deliberately change a request parameter to
  produce a *different cache key* for a dynamic fetch.
- **Dynamic URLs/params** computed from conditional input the integration's UI stored in
  `custom`.
- **Blocking and annotating**: push to `errors` (the fetch is skipped entirely), `warnings` (the
  fetch still happens), or set `uiBadgeText` (≤ 12 characters) to label the resource in the UI.

Variable references are already interpolated before your hook sees the resource — a data type
URL of `foo.com/${path}` with `variables: { path: 'bar' }` arrives as `foo.com/bar`.

**`request` — batching and response shaping.** It owns the fetch, so use it when one HTTP call
should serve many resources or when the response needs work:

- **Batching**, the most common use: separate resources for IDs 1, 2, 3 become one
  `api.com/entities?ids=1,2,3`. Cuts latency significantly on compositions with many resources.
- **OAuth access token exchange** against an OAuth-secured API.
- **Business rules**: hide private or irrelevant fields from authors, enrich by combining
  several sources, remap awkward or non-JSON responses.
- **`surrogateKeys`**: return an alternate cache key — e.g. the external entity ID — so a later
  purge request for that key invalidates everything tagged with it.

**Deciding:** if the request itself must vary *and* be cached correctly, do it in `preRequest`
and let Uniform fetch. Reach for `request` when you need to control the call itself.

In both hooks an unhandled exception adds its message as an error to **every** resource in the
batch, so catch per item if one bad resource shouldn't fail the batch.

## `preRequest` shape

```ts
import { type PreRequestHookFn } from '@uniformdev/mesh-edgehancer-sdk';

const preRequest: PreRequestHookFn = async ({ dataResources, fetchContext, dataSourceVariant }) => ({
  dataResources: dataResources.map(({ dataResource }) => {
    if (dataSourceVariant === 'unpublished' && dataResource.custom?.draftToken) {
      dataResource.headers ??= [];
      dataResource.headers.push({ key: 'authorization', value: dataResource.custom.draftToken as string });
    }
    if (fetchContext === 'editing') {
      dataResource.parameters ??= [];
      dataResource.parameters.push({ key: 'preview', value: 'true' });
    }
    return { dataResource, errors: [], warnings: [], infos: [] };
  }),
});

export default preRequest;
```

## `request` shape (batched)

The SDK ships the batching plumbing — don't hand-roll ID mapping:

```ts
import {
  convertBatchResultsToEdgehancerResult,
  getDataResourceAsRequest,
  resolveBatchFetchIds,
  type RequestHookFn,
} from '@uniformdev/mesh-edgehancer-sdk';

const request: RequestHookFn = async ({ dataResources }) => {
  const getId = ({ dataResource }) => dataResource.parameters?.find((p) => p.key === 'id')?.value;
  const batchFetchIds = resolveBatchFetchIds(dataResources, getId);

  const first = dataResources[0].dataResource;
  const response = await fetch(
    getDataResourceAsRequest({
      ...first,
      parameters: [
        ...(first.parameters?.filter(({ key }) => key !== 'id') ?? []),
        { key: 'ids', value: batchFetchIds.validIds.join(',') },
      ],
    })
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`batch fetch failed ${response.status}: ${text}`);

  return {
    results: convertBatchResultsToEdgehancerResult({
      batch: dataResources,
      batchFetchIds,
      batchResults: JSON.parse(text) as Array<{ id: string }>,
      resolveIdFromBatchResultFn: (r) => r.id.toString(),
      missingBatchResultErrorMessage: (item) => `ID ${getId(item)} was not found`,
    }),
  };
};

export default request;
```

For a non-batched `request` hook, `map()` over `dataResources` and return one result per item.

## When hooks run

Any data-resource fetch, whichever surface triggered it: a data type being tested in the
Uniform UI, resources fetched by the composition or entry editor, resources fetched through the
composition / entry / route APIs, and ephemeral resources fetched by an integration UI via the
Mesh SDK's `getDataResource`.

## Deploy and remove

Each hook is deployed and removed independently, per connector type and archetype. Build to
`.mjs` first, then:

```json
{
  "deploy-edgehancer:preRequest": "uniform integration definition edgehancer deploy --connectorType <connectorType> --archetype <dataArchetype> --hook preRequest ./edgehancer/dist/preRequest.mjs",
  "remove-edgehancer:preRequest": "uniform integration definition edgehancer remove --connectorType <connectorType> --archetype <dataArchetype> --hook preRequest --compatibilityDate 2025-07-15",
  "deploy-edgehancer:request": "uniform integration definition edgehancer deploy --connectorType <connectorType> --archetype <dataArchetype> --hook request ./edgehancer/dist/request.mjs",
  "remove-edgehancer:request": "uniform integration definition edgehancer remove --connectorType <connectorType> --archetype <dataArchetype> --hook request --compatibilityDate 2025-07-15"
}
```

## Testing

Hooks are plain functions, so unit-test them with vitest by constructing a context. The SDK
exports the context *types* (`PreRequestEdgehancerContext`, `RequestEdgehancerContext`,
`EdgehancerMergedDataType`, …) but **not** mock factories — write small local ones typed against
those types, as the example's `_testUtils.ts` does:

```ts
import { expect, test } from 'vitest';
import { setupTestPreRequestHookContext, setupTestPreRequestDataResourceContext } from './_testUtils';
import preRequest from './preRequest';

test('adds preview parameter when editing', async () => {
  const result = await preRequest(
    setupTestPreRequestHookContext({
      dataResources: [setupTestPreRequestDataResourceContext()],
      fetchContext: 'editing',
    })
  );
  expect(result.dataResources[0].dataResource.parameters).toContainEqual({ key: 'preview', value: 'true' });
});
```

## Reference

- Working samples — `preRequest.ts`, `request.ts`, `requestBatched.ts`, their tests, and
  `_testUtils.ts`:
  https://github.com/uniformdev/examples/tree/main/mesh/mesh-integration/edgehancer
- Docs: https://docs.uniform.app/docs/integrations/mesh-integrations/custom-edgehancers
