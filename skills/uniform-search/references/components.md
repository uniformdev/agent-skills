# Components at runtime

How the scaffolded components behave, so changes to them (renderers, styling, extra components)
keep working with the definitions and the search service. File names are under
`components/search/` after the CLI runs; this describes what `create-uniform-search@0.0.7`
ships (templates unchanged through 0.0.10). Read the scaffolded files for anything not covered here — they are the source.

## Provider and slots

`SearchEngine.tsx` is the root: it creates the search function (`performSearch` from
`lib/search/searchClient.ts`, wrapped with the typo-tolerance preset), derives the locale from
the URL, and renders `SearchProvider` + `SearchItemDefaultUrlResolverProvider` from
`@uniformdev/search/react` around three `UniformSlot`s: `search-top`, `search-main`,
`search-bottom`. Every other search component (except `SearchAutocomplete`) reads that context
via `useSearch()` and must be placed inside those slots. Search state (query, filters, sort,
page, page size) is mirrored to the URL by the provider, so results are shareable.

## Self-registration

The App Router slot model does not let a parent read its children's parameters, so children
register their own configuration with the provider:

| Component | Registers | Semantics |
|---|---|---|
| `SearchFacet` | `{ fieldKey, type, title }` via `registerFilterOption` | one entry per facet; unregisters on unmount |
| `SearchPagination` | its `pageSizes` block via `registerPageSizes(id, …)` | last registered wins; unmount clears (→ default page size) |
| `SearchSorting` | its `orderBy` block via `registerOrderBy(id, …)` | last registered wins; unmount clears (→ relevance) |

`FacetContainer` is only a slot wrapper. This is why page size and order-by are configured on
the pagination and sort components, not on the engine.

## Result renderers

`SearchList` resolves a card renderer per hit from `renderers/index.ts`, keyed by
`${hit.source}::${hit.type}` (e.g. `entry::product`, `entry::article`); `renderers/default.tsx`
is the fallback. To support the project's own content types, add a module exporting
`source`, `type: string[]` and `Renderer`, and push it into `rendererModules`. Hit URLs come
from `useUrlResolver()`, backed by the engine's `entryUrlMapping` and, for composition hits, a
node-id → path map fetched from the search service's `/api/project-map` endpoint
(`lib/search/projectMapClient.ts`) — an authenticated call; see the patch in
[install.md](install.md#patch-the-project-map-client).

Click analytics: `@uniformdev/search ≥ 0.0.7` exposes `trackClick({ docId, locale })` on the
client for the integration's "top clicked" report. The scaffolded `SearchList` (unchanged through
CLI 0.0.7) does not call it; the starter's newer one wraps each hit in a capture-phase
`onClickCapture` that does.

## Autocomplete

`SearchAutocomplete` is standalone: built on the headless `useAutocomplete` hook from
`@uniformdev/search/react` (debounced instant results, race-safe, WAI-ARIA combobox prop
getters, ↑/↓/Enter/Esc/Home/End), with its own `queryBy` and `entryUrlMapping`, no provider
needed. Place it in a header; `resultsPath` is where Enter sends the query (`?search=…`).
A `SearchBoxAutocomplete` variant that lives *inside* a Search Engine and inherits its query
fields, locale, base filter and active facets exists in the search starter and will arrive in a
later CLI version — do not write one by hand.

Highlighting: the service wraps matched terms in `<mark>`; `ui/Highlighted.tsx` uses
`getHighlightMatch(hit, field)` from `@uniformdev/search` to render them.

## Typo tolerance

`lib/search/typoTolerance.ts` maps `toleranceLevel` (`off` | `basic` | `aggressive`) to the
Typesense typo parameters on `SearchParams` (`maxTypos`, `minLengthFor1Typo`,
`minLengthFor2Typos`, `typoFallbackThreshold`). The engine applies the preset as defaults and any
per-request value overrides it. Tune the numbers there — they are deliberately in project code,
not in the package.

## Localization

- The engine reads the locale from the first URL segment only when it matches
  `/^[a-z]{2}-[a-z]{2}$/i` (`en-us`, `ja-jp`); otherwise it uses `NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE`,
  else sends none. A two-letter locale (`en`) is therefore never taken from the URL — set the
  env var for such projects.
- Search collections are per locale and named with a **lowercased** locale
  (`<projectId>_search_en-us`); a non-localized project uses the suffix-less collection. The
  engine lowercases the locale it sends. Anything that resolves Uniform content must keep the
  canonical form (`en-US`) — that lookup is case-sensitive.
- Localized projects have no suffix-less collection, so a request from `/` with no default
  locale configured targets a collection that does not exist and returns nothing, without an
  error in the UI.

## The `type` parameter on SearchFacet

The definition's `type` parameter (facet type) collides with the reserved `ComponentProps.type`
(`"searchFacet"`), which the compat adapter spreads last. `SearchFacet.tsx` therefore reads
`component.parameters.type.value` and falls back to `select`. Keep that if you edit the file.

## Newer components (starter ahead of the published CLI)

CLI 0.0.7 ships `Recommendations` and the ranking helpers; `SearchBoxAutocomplete`,
`RelatedContent` and the cards are still starter-only. Until `search-components.json` in the
project lists a type id **and** the CLI has written its file, do not write it by hand. Register each one whose type id is in the package (see the mapping rule in
[install.md](install.md#register-the-components)).

### Search Box Autocomplete (`searchBoxAutocomplete`)

**Not shipped by CLI 0.0.7–0.0.10** — the package defines the type (and allows it in `search-top`), but
no `SearchBoxAutocomplete.tsx` or `ui/AutocompletePanel.tsx` is written; leave it unmapped. In
the starter, `SearchBoxAutocomplete` lives *inside* a Search Engine (`search-top` slot): it takes no
`queryBy`/`entryUrlMapping` of its own but reads the engine's `performSearch`, `queryBy`,
`locale`, base filter and active facet selections from `useSearch()`, so suggestions mirror the
filtered results, and it pushes the typed query into the provider so the results list updates
as you type. Same `ui/AutocompletePanel.tsx` as the standalone one. Choose it for a results
page; choose `searchAutocomplete` for a header.

### Recommendations (`recommendations`)

**Shipped by CLI 0.0.7.** An **async server component**: reads the `ufvd` cookie (`CookieTransitionDataStore` from
`@uniformdev/context`), reduces the scores with `resolveEnrichmentBoost`, runs one wildcard
search with `orderBy: 'behavior'` and renders the hits through the same result renderers.
Parameters: `title`, `contentType` (public id; empty = every type), `boostCategories`
(comma-separated category ids; empty = every manifest category), `maxRecommendations`
(default 4), `entryUrlMapping`. Locale comes from the matched route's `dynamicInputs.locale`,
else `NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE`.

It has prerequisites the rest of the set does not:

- `@uniformdev/context` as a dependency (for the cookie store; the v2 starter has it).
- **Next.js cache components** (`cacheComponents: true`, Next 16+) for
  `lib/search/cachedProjectMapPaths.ts`'s `'use cache'` — or the uncached swap in
  [install.md](install.md#reconcile-the-scaffold), which is the default for a project not already
  running cache components, because enabling them is project-wide.
- A Context manifest at the path `lib/search/enrichmentCategories.ts` imports
  (`@/lib/uniform/manifest.json`): `npx uniform context manifest download --output
  ./lib/uniform/manifest.json`, or change the path. No enrichment categories in the manifest just
  means no boost is ever sent.

Concepts and the Content-API variant of the same idea: `uniform-enrichment-recommendations`.
The search variant differs in one way that matters — ranking runs in the search engine, so it
scales to the whole index rather than a fetched page of entries.

### Related Content (`relatedContent`) with Product Card / Article Card

**Starter-only as of CLI 0.0.10** — neither the definitions nor the files ship. A different mechanism from everything above: **no search request from the site**. `RelatedContent`
is a heading plus an `items` slot rendered as a card grid. Authors drop Uniform's **Loop**
component into the slot, point it at a **Uniform Search data resource** — the integration
registers a `uniformSearch` data connector with two archetypes, `searchQuery` and `curatedList` —
and place a `productCard` / `articleCard` inside the loop with its parameters bound to the loop
item's fields (`title`, `description`, `imageUrl`, `url`, plus `price`/`currency`/`rating` or
`category`/`author`/`publishedDate`). The platform expands the loop during data resolution;
the components only render children. Use this for editorially curated or query-driven lists
that should be cached with the page; use `Recommendations` when the list must be per-visitor.

### Click tracking

`SearchList` wraps each hit in a capture-phase `onClickCapture` calling
`trackClick({ docId, locale })` (present in `@uniformdev/search` 0.0.7) for the integration's
"top clicked" report. Fire-and-forget; never blocks navigation.

### Retrieval and behavior ranking

See [ranking.md](ranking.md).
