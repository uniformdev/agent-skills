# Definitions

`search-components.json`, written by the CLI to the project root, is a single Uniform CLI
**package file** (the CLI treats a `serialization.directory` ending in `.json` as one package
rather than a folder of per-entity files). `uniformsearch.config.js` is the config that points at
it. Together they push everything the search components need, and nothing the project already has.

## What the package contains (create-uniform-search 0.0.6)

| Entity | Ids |
|---|---|
| Category | **Uniform Search** (every component below is filed under it) |
| Components | `searchEngine`, `searchBox`, `searchAutocomplete`, `searchList`, `facetContainer`, `searchFacet`, `searchPagination`, `searchSorting` |
| Block content types | `pageSize`, `orderBy`, `searchFacet` (backing the `$block` parameters on pagination, sort and facets) |
| Component patterns | **Search Engine** (a pre-wired results page), **Search Autocomplete** (a header typeahead) |

Check the shipped version with `node -e 'console.log(require("./search-components.json").components.map(c=>c.id))'`
— a newer CLI may add types (the starter it is synced from already has `searchBoxAutocomplete`).

Component ids, slots and the parameters the React code reads:

| Type id | Slots | Parameters |
|---|---|---|
| `searchEngine` | `search-top`, `search-main`, `search-bottom` | `baseFilters` (filterByConfig), `entryUrlMapping` (entryUrlMapping), `queryBy` (queryByConfig), `toleranceLevel` (select: off/basic/aggressive) |
| `searchBox` | — | `label`, `placeholder`, `delay` (+ six `dex-*` presentation params the component ignores, see below) |
| `searchAutocomplete` | — | `label`, `placeholder`, `delay`, `minChars`, `maxResults`, `resultsPath`, `viewAllText`, `noResultsText`, `queryBy`, `entryUrlMapping` |
| `searchList` | — | `cardButtonText`, `noResultsFoundText`, `tryDifferentFiltersText`, `clearAllFilterText` |
| `facetContainer` | `facets` | — |
| `searchFacet` | — | `fieldKey` (facetByConfig), `type` (select/multiSelect/range), `title` |
| `searchPagination` | — | `siblingCount`, `pageSizes` ($block of `pageSize`) |
| `searchSorting` | — | `orderBy` ($block of `orderBy`) |

`filterByConfig`, `queryByConfig`, `facetByConfig`, `sortByConfig` and `entryUrlMapping` are
parameter types registered by the `uniform-search-integration` Mesh integration
(`locations.canvas.parameterTypes` in its manifest). They only resolve in a project where it is
installed.

## The config

```js
// uniformsearch.config.js
module.exports = {
  serialization: {
    directory: 'search-components.json',      // relative to the cwd of the push command
    mode: 'create',                           // additive: creates missing entities, never updates or deletes
    entitiesConfig: {
      component: {},
      componentPattern: { published: true },
      contentType: {},
      category: {},
    },
  },
};
```

`mode` is `SyncMode = 'mirror' | 'createOrUpdate' | 'create'` in the CLI's types. `create` is
what makes the push safe to run without pulling first: an entity that already exists is skipped,
so re-running is a no-op and nothing in the project is ever modified or removed. The `directory`
is resolved from the working directory, which is why both files sit together where the command
is run. Renaming either means changing the other.

## Locale

The two patterns are authored in a single locale, in two places: `"_locales": [...]` on each
pattern and `"locales": { "<code>": … }` on localized parameter values. A pattern whose locale is
not the project's default pushes fine and is then not usable.

The CLI rewrites both to the locale it resolves, in this order: `--locale`; else the project
default fetched with `UNIFORM_API_KEY`/`UNIFORM_PROJECT_ID` from `.env`/`.env.local`
(`GET /api/v1/locales`, the entry with `isDefault`); else `en`. Pass `--locale` explicitly so the
result does not depend on which credentials happen to be in `.env`.

Find the default locale first:

1. `uniform-data/locale/*.yaml` if the project serializes locales — the file with `isDefault: true`
   (or the only file).
2. Otherwise the REST API with the project's CLI credentials:
   ```bash
   curl -s -H "x-api-key: $UNIFORM_API_KEY" \
     "https://uniform.app/api/v1/locales?projectId=$UNIFORM_PROJECT_ID"
   # → {"results":[{"displayName":"English","isDefault":true,"locale":"en","order":0}]}
   ```
3. Otherwise ask. Default to `en` only when nothing else is available.

Use the **canonical** casing Uniform reports (`en-US`, not `en-us`) — this is a Uniform entity
field, not a search collection name. After the run, confirm the CLI's
`Set search content locale to "<code>"` line (or `already uses locale`).

## Strip the Design Extensions parameters

The 0.0.6 package's `searchBox` carries six parameters typed `dex-segmented-control-parameter`,
`dex-token-selector-parameter` and `dex-color-palette-parameter` (in two groups, "Presentation
Settings" and "Label"). Those types come from the Design Extensions integration, and
`SearchBox.tsx` reads none of them. Unless Design Extensions is installed in the project, remove
them before the user pushes (run from the directory holding `search-components.json`):

```bash
node -e '
const fs=require("fs");const f="search-components.json";const j=JSON.parse(fs.readFileSync(f,"utf8"));
for(const c of j.components){const ps=c.parameters||[];const dex=new Set(ps.filter(p=>/^dex-/.test(p.type)).map(p=>p.id));
 c.parameters=ps.filter(p=>{if(dex.has(p.id))return false;if(p.type==="group"){const kids=(p.typeConfig?.childrenParams||[]).filter(k=>!dex.has(k));if(!kids.length)return false;p.typeConfig.childrenParams=kids}return true});
 if(dex.size)console.log(c.id+": removed "+[...dex].join(", "))}
fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");
'
```

Expected output: `searchBox: removed textSize, border, size, labelColor, labelSize, font`. This
and the locale are the only edits to make to the package file.

## Hand the push to the user

Give the user the command and stop:

```bash
npx @uniformdev/cli sync push --config ./uniformsearch.config.js
```

Optionally add it as an npm script (`"uniform:push:search"`). Do not run it yourself, do not
route the definitions through the Uniform MCP, and do not copy them into `uniform-data/`. It
authenticates with `UNIFORM_API_KEY` / `UNIFORM_PROJECT_ID` from the environment or `.env`;
`--what-if` previews without writing.

There is no `-m`/`--mode` flag on `sync push` — the mode is only configurable in the file.

## After the push (what the author does)

1. In the project's `page` definition, allow `searchEngine` in the content slot (see
   [install.md](install.md#allow-the-types-in-slots)); allow `searchAutocomplete` where the header is.
2. Open a page, add **Search Engine** (or the **Search Engine** pattern), and fill its slots:
   `search-top` → Search Box, Search Sort; `search-main` → Facet Container with Search Facets,
   Search Results; `search-bottom` → Search Pagination.
3. On Search Engine, set **Query By** to the indexed fields to match against and, if hits should
   link to pages, **Entry Url Mapping**. On each Search Facet set **Facet by field** and the facet type.
4. Preview. Results depend on the index — if nothing comes back, check the integration's
   indexing status before debugging the front end.
