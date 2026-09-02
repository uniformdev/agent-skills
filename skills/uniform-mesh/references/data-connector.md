# Data connector

The most common Mesh use case: connect an external system (CMS, commerce, search API) so
authors can browse and select records from it inside Uniform. A data connector has three
editor locations working together:

- **Data source editor** — configure the connection (base URL, credentials). One per
  connector.
- **Data type editor** — define a request template (method, path, parameters, dynamic
  variables) for a kind of query. One per archetype.
- **Data resource editor** — the author-facing picker that runs the query and selects
  specific record(s). One per archetype.

And one optional fourth:

- **Data resource selector** — customises how an author picks a value *inside* the fetched
  JSON, replacing Uniform's default JSON tree viewer. One per archetype.

## Manifest

A data connector is declared as a location: a **data source editor** for the connection,
plus one or more **archetypes**, each with its own **data type editor**, **data resource
(picker) editor**, and optional **selector**. Validate against the schema (see
`manifest.md`) — it is authoritative if these keys ever move:

```json
{
  "locations": {
    "dataConnectors": [
      {
        "type": "product-catalog",
        "displayName": "Product catalog",
        "dataSourceEditorUrl": "/data-source",
        "dataArchetypes": {
          "product-by-id": {
            "displayName": "Product by id",
            "typeEditorUrl": "/data-type",
            "dataEditorUrl": "/data-resource",
            "dataResourceSelectorUrl": "/data-selector"
          }
        }
      }
    ]
  }
}
```

Behavior worth knowing:
- Each connector has a globally unique `type`.
- A connector can opt into a preview/unpublished data variant — it surfaces as
  `metadata.enableUnpublishedMode` in the data source editor.
- Omit any editor URL and Uniform renders its built-in HTTP editor for that location.

## Data source editor — `useMeshLocation<'dataSource'>()`

Store the connection and **secrets** here. Header/parameter values and `custom` are
encrypted at rest; `customPublic` is plaintext and readable by the data type / data
resource editors. Never put credentials in `settings` or in a data type value.

```tsx
import { DataSourceLocationValue, useMeshLocation, ValidationResult } from '@uniformdev/mesh-sdk-react';
import { Input, VerticalRhythm } from '@uniformdev/design-system';

export default function DataConnectionEditor() {
  const { value, setValue, metadata } = useMeshLocation<'dataSource'>();
  const custom = value.custom ?? {};
  // read current creds from value.custom, edit in local state, then:

  const save = (spaceId: string, token: string) =>
    setValue(() => {
      const newValue: DataSourceLocationValue = {
        baseUrl: `https://api.example.com/spaces/${spaceId}`,
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        parameters: [{ key: 'access_token', value: token }], // encrypted
        custom: { spaceId, token },                          // encrypted, editor-only
        customPublic: { spaceId },                           // plaintext, other editors can read
        ...(metadata.enableUnpublishedMode
          ? { variants: { unpublished: {
              baseUrl: `https://preview.example.com/spaces/${spaceId}`,
              headers: [{ key: 'Content-Type', value: 'application/json' }],
              parameters: [{ key: 'access_token', value: token }],
            } } }
          : {}),
      };
      const options: ValidationResult = spaceId && token
        ? { isValid: true }
        : { isValid: false, validationMessage: 'Space ID and token are required' };
      return { newValue, options };
    });

  return (
    <VerticalRhythm gap="base">
      <Input label="Space ID" value={String(custom.spaceId ?? '')} onChange={/* … */} />
      <Input label="Token" type="password" value={String(custom.token ?? '')} onChange={/* … */} />
    </VerticalRhythm>
  );
}
```

## Data type editor — `useMeshLocation<'dataType'>()`

Define the request template for this archetype: `method`, `path` (leading slash, with
`${variable}` placeholders), `parameters`, and `variables` (dynamic-input definitions).
Non-secret config goes in `custom`. `getDataResource` is available to fetch options (e.g.
list content types) using the parent connection.

```tsx
import { DataTypeLocationValue, useMeshLocation, LoadingOverlay } from '@uniformdev/mesh-sdk-react';

export default function TypeEditor() {
  const { setValue, getDataResource } = useMeshLocation<'dataType'>();
  // optionally call getDataResource(...) to populate selectable options for the editor UI

  const persist = (allowedTypes: string[]) =>
    setValue((prev: DataTypeLocationValue) => ({
      newValue: {
        ...prev,
        method: 'GET',
        path: '/entries',
        variables: { entryIds: { default: '', type: 'text', displayName: 'Entry Ids' } },
        parameters: [
          { key: 'sys.id[in]', value: '${entryIds}' },
          { key: 'include', value: '1', omitIfEmpty: true },
        ],
        custom: { allowedTypes },
      },
    }));
  // …
}
```

## Data resource editor — dynamic inputs + result selection

The picker authors use. `useMeshLocation<'dataResource'>()` gives `value`, `setValue`,
`getDataResource`, and `metadata` (with `dataType.custom`, `dataSource.baseUrl`,
`dynamicInputs`, `archetype`). Keep the page thin and wrap the search UI in
`DataResourceDynamicInputProvider` + `ObjectSearchProvider`.

```tsx
import {
  useMeshLocation, DataResourceDynamicInputProvider, ObjectSearchProvider,
  ObjectSearchContainer, ObjectSearchFilter, ObjectSearchResultList, useObjectSearchContext,
  GetDataResourceMessage,
} from '@uniformdev/mesh-sdk-react';
import { useAsync } from 'react-use';

type Entry = { id: string; title: string };

function Search({ getDataResource, onSelect, multiSelect }: {
  getDataResource: <T>(m: GetDataResourceMessage) => Promise<T>;
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
}) {
  const { boundQuery, onSetList, selectedListItems } = useObjectSearchContext<unknown, Entry>();

  const { value: items = [], loading } = useAsync(async () => {
    const { keyword = '' } = boundQuery as { keyword?: string };
    const res = await getDataResource<{ items: { sys: { id: string }; fields: { title: string } }[] }>({
      method: 'GET', path: '/entries',
      parameters: [{ key: 'query', value: keyword, omitIfEmpty: true }, { key: 'limit', value: '25' }],
    });
    return res.items.map((i) => ({ id: i.sys.id, title: i.fields.title }));
  }, [boundQuery]);

  useEffect(() => { if (!loading) onSetList({ items }); }, [items, loading, onSetList]);
  useEffect(() => { onSelect(selectedListItems.map((i) => i.id)); }, [selectedListItems]);

  return (
    <ObjectSearchContainer label="Select entry" enableDynamicInputToResultId searchFilters={<ObjectSearchFilter />}>
      <ObjectSearchResultList<Entry> whenNothingSelected="Nothing selected yet"
        renderResultComponent={(v) => <div key={v.id}>{v.title}</div>} />
    </ObjectSearchContainer>
  );
}

export default function DataEditor() {
  const { value, setValue, metadata, getDataResource } = useMeshLocation<'dataResource'>();
  return (
    <DataResourceDynamicInputProvider>
      <ObjectSearchProvider isMulti={metadata.archetype === 'multipleEntry'}>
        <Search getDataResource={getDataResource} multiSelect={metadata.archetype === 'multipleEntry'}
          onSelect={(ids) => setValue(() => ({ newValue: { entryIds: ids.join(',') } }))} />
      </ObjectSearchProvider>
    </DataResourceDynamicInputProvider>
  );
}
```

For per-field dynamic inputs (binding a field to a `${variable}` or a plain value), use
`InputVariables` with an `inputWhenNoVariables` fallback. `EntrySearch` is an older,
simpler all-in-one alternative to the `ObjectSearch*` family — prefer `ObjectSearch*` for
new work.

## Optional: data resource selector — `useMeshLocation<'dataResourceSelector'>()`

> ⚠️ The SDK tags this location `@deprecated` to mean **experimental — subject to change
> without notice**, not "being removed". Treat the
> shape below as less stable than the other locations.

Once an author has picked a record, they still have to point at a *value inside it* to bind a
component parameter — by default a raw JSON tree viewer. This location replaces that viewer
with domain-specific UI: a grid of product images, formatted prices, whatever makes the choice
obvious to a non-technical author.

Declared per archetype as `dataResourceSelectorUrl` (see the manifest above).

- **`value`** is a **JSON pointer string** into the resolved resource — `/title`,
  `/images/0`, `/moves/0/move/name`.
- **`setValue`** takes the pointer, not the data: `setValue(() => ({ newValue: '/images/0' }))`.
- **`metadata`** carries `dataResourceValue` (the resolved JSON for the current resource),
  `dataResourceName`, `dataTypeId`, `archetype` (useful when one selector serves several
  archetypes), and `allowedTypes` — the bindable types the target parameter accepts, so you can
  offer only pointers that fit. Canvas editor context comes along too.
- Also available, and easy to miss: **`getDataResource`** to fetch from the connector using the
  current data source, **`editorState`** for inspecting or mutating the surrounding
  composition/entry tree (see [editor-state.md](editor-state.md) — here it can be `undefined`,
  so guard it), and **`isReadOnly`**.

```tsx
'use client'; // App Router only
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';
import { ScrollableList, ScrollableListItem } from '@uniformdev/design-system';

export default function ProductSelector() {
  const { value, setValue, metadata, isReadOnly } = useMeshLocation<'dataResourceSelector'>();
  const product = metadata.dataResourceValue as { images?: string[] } | undefined;

  return (
    <ScrollableList label="Pick an image">
      {(product?.images ?? []).map((src, i) => (
        <ScrollableListItem
          key={src}
          buttonText={src}
          active={value === `/images/${i}`}
          onClick={() => !isReadOnly && setValue(() => ({ newValue: `/images/${i}` }))}
        />
      ))}
    </ScrollableList>
  );
}
```

Omit `dataResourceSelectorUrl` and authors get the default JSON tree viewer, which is a
perfectly good default — add a selector only when the shape of the data makes it painful.

## Optional: edgehancers

A connector can run managed JavaScript on Uniform's edge for each data-resource fetch, via two
hooks: `preRequest` (rewrite the request definition — auth tokens, draft vs published, cache
TTL and cache keys; Uniform still fetches) and `request` (replace the fetch entirely — batching
several resources into one call, OAuth exchanges, reshaping responses).

Which one you need is decided by caching: `preRequest` runs on every request and can change the
cache key, `request` runs only on a cache miss and cannot. See
[custom-edgehancers.md](custom-edgehancers.md) for the hook contracts, use cases, batching
helpers, deployment, and testing.
