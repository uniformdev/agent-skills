---
name: uniform-search
description: Adds Uniform Search — faceted search on the Uniform Search integration and the @uniformdev/search package — to an existing Next.js App Router site that already renders Uniform compositions. Scaffolds the search components, helpers, theme tokens and component definitions with the create-uniform-search CLI, then installs the runtime package, wires the components into resolveComponent, checks env vars and Tailwind tokens, opens the page slot, and hands the definitions push to the user. Use when asked to add search, faceted search, a search results page, typeahead or autocomplete, search filters, behavior-ranked or personalized search results and recommendations, semantic vs exact retrieval, or related-content cards to a Uniform site, or to install or wire up the Uniform Search components. Not for Page Router projects or third-party search providers such as Algolia or Coveo.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform Search for Next.js App Router

Uniform Search is a Mesh integration (`uniform-search-integration`) that indexes a project's
entries and compositions into a hosted search service, plus a client package
(`@uniformdev/search`, React bindings at `@uniformdev/search/react`). Authors compose a search
page in the visual editor from a fixed set of search components. The source of those components
and their Uniform definitions is the `create-uniform-search` npm CLI — **run it; never hand-write
the components or the definitions.** The React `type` ids, parameter ids and slot ids must match
the pushed definitions exactly, and the definitions use parameter types only the integration
provides.

What the CLI writes (verified with `create-uniform-search@0.0.6`):

```text
<srcRoot>/components/search/**   React components (client components) + renderers + ui
<srcRoot>/lib/search/**          searchClient (createSearchClient), projectMapClient, typoTolerance
<srcRoot>/styles/search-theme.css  Tailwind v4 @theme block: the mono-* palette the components use
./search-components.json         one CLI "package" file: component definitions, block content
                                 types, the "Uniform Search" category, two component patterns
./uniformsearch.config.js        dedicated CLI config: directory = search-components.json, mode = create
```

What it does **not** do, and this skill covers: install `@uniformdev/search`, add env vars, import
the theme, register the components in the resolver, open the page slot, or (unless told to)
push. Details per step: [references/install.md](references/install.md),
[references/definitions.md](references/definitions.md).

## Sequence

1. **Verify prerequisites, stop if unmet.** `app/` directory; `@uniformdev/next-app-router` in
   `package.json`; a `resolveComponent` (or `createAdapterResolveComponentFunction`) resolver
   and `app/uniform/[code]/page.tsx` rendering `UniformComposition`; Tailwind. Ask the user to
   confirm the Uniform Search integration is installed in the project and content is indexed —
   not detectable from the codebase. A Page Router project (`pages/`, `@uniformdev/canvas-next`)
   is out of scope: say so and stop.
2. **Find the project's default locale** before scaffolding (`uniform-data/locale/*.yaml`, the
   locales REST endpoint, or ask). The CLI authors the definitions package in that locale.
3. **Scaffold with the CLI**, non-interactively, from the directory holding `package.json`:
   ```bash
   npx -y create-uniform-search@latest --dir . --components --no-deploy --no-skill \
     --src-root <base> --locale <locale>
   ```
   `<base>` is the `@/*` alias base from `tsconfig.json` (`.` or `src`); `<locale>` the canonical
   code from step 2 (`en`, `en-US`). `--no-deploy` keeps the push with the user; `--no-skill`
   stops it installing its own copy of a Claude skill next to this one.
4. **Install `@uniformdev/search`** with the project's package manager — the CLI does not.
   Take the latest (0.0.8 adds the ranking exports; 0.0.7 added `trackClick`). Then read what
   you actually got, because the starter is ahead of what is published:
   `search-components.json` lists the component types this CLI version ships, and
   `node_modules/@uniformdev/search/dist/index.d.ts` is the SDK surface you can code against.
   Anything in [references/components.md](references/components.md#newer-components-starter-ahead-of-the-published-cli)
   or [references/ranking.md](references/ranking.md) that is not in both is not available yet —
   do not write it by hand.
5. **Import the theme tokens** — `styles/search-theme.css` — from the global stylesheet
   (Tailwind v4), or merge its palette into `theme.extend.colors.mono` (v3).
6. **Environment variables.** Add the three public variables the client reads
   (`NEXT_PUBLIC_UNIFORM_PROJECT_ID`, `NEXT_PUBLIC_UNIFORM_SEARCH_API_URL`,
   `NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY`) and, for localized projects only,
   `NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE`. Leave unknown values blank; never overwrite a
   populated value; never echo secrets.
7. **Register the search types in the existing resolver** without rewriting it. The scaffolded
   components use the compat (flattened-props) shape and register through
   `createAdapterResolveComponentFunction`; a plain `resolveComponent` delegates to that adapter
   for the search types only. See the gating rule below.
8. **Allow `searchEngine` in the page's content slot** (and `searchAutocomplete` wherever the
   header lives). Slots with an explicit `allowedComponents` list will not offer the new types
   otherwise. Change the project's own `page` definition the way the project normally does:
   Uniform MCP `mutateComponent` when it is connected; otherwise tell the user which slots to
   open in the Uniform UI and move on — never block the rest of the work on this step.
9. **Check the definitions package, then hand the push to the user.** Confirm the locale the CLI
   wrote, strip the Design Extensions parameters if that integration is not installed (recipe
   in definitions.md), and give the user the push command. **Do not run the push.**
10. **Verify** with `npx tsc --noEmit` (and `next build` if the project builds without live
    credentials). Then tell the user what to do in Uniform: push, add a **Search Engine** to a
    page, drop **Search Box** / **Search Results** / **Facet Container** + **Search Facet**s into
    its slots, configure **Query By** and **Facet by field**, preview.

## Decision rules

- **The CLI is the source of the code and the definitions.** Its templates are synced from the
  Uniform search starter; a hand-written component drifts from the definitions immediately, and
  a hand-written definition cannot use the integration's parameter types correctly.
- **Definitions ship as a vendored CLI package, not through MCP and not in `uniform-data/`.**
  They are a fixed set that must match the scaffolded React code, and `serialization.mode:
  'create'` makes the push additive and idempotent — creates what is missing, never updates or
  deletes. Keeping them out of the project's own sync directory keeps them out of its
  `mirror`/`createOrUpdate` semantics. The `uniform-sdk` rule against editing serialized Uniform
  data is about the project's `uniform-data/`; the only edits to this package file are the
  locale (done by the CLI) and the optional parameter strip.
- **The push mode lives in the config file.** `uniform sync push` has no `-m/--mode` flag;
  `uniformsearch.config.js` sets it. Verified against `@uniformdev/cli` 20.73.
- **Adapter gating.** `createAdapterResolveComponentFunction` never returns `undefined` for an
  unknown type — it returns a "Not implemented" component — so it cannot be chained as a
  fallback after the project's resolver. Gate on the search type set first, then fall through
  to the existing logic. If the project already uses the adapter, just add the mappings.
- **Ranking is configured by authors, not in code.** Retrieval mode is the `retrieval` select on
  Search Engine (leave it unset unless meaning-based matches are wrong for that placement);
  behavior relevancy is a sort option in Search Sort. For per-visitor lists without a search
  page use `Recommendations`; for curated or query-driven lists cached with the page use
  `RelatedContent` + a Loop over a Uniform Search data resource. Enrichment concepts live in the
  `uniform-enrichment-recommendations` skill — link, do not restate.
- **Page size is configured on Search Pagination; order-by on Search Sort.** `SearchEngine`'s
  `orderBy`/`pageSizes` props are deprecated compatibility inputs; never model new content on them.
- **Search components are client components by design.** Search state is React context. Do not
  remove `'use client'` to match the project's RSC components.

## Traps whose failure is silent

- **Locale in the package.** Patterns are authored in one locale (`_locales` and `locales` keys).
  The CLI rewrites them to `--locale`, or to the project default it detects from
  `UNIFORM_API_KEY`/`UNIFORM_PROJECT_ID` when the flag is omitted, or to `en` when neither is
  available. A pattern whose locale is not the project's default pushes fine and is then not
  usable — check the CLI's "Set search content locale to …" line.
- **Locale casing.** Search collections are keyed by a **lowercased** locale (`en-us`); Uniform
  content lookups need the **canonical** one (`en-US`). The components lowercase where they
  talk to search and nowhere else — keep that split if you touch them.
- **Locale from the URL is `xx-yy` only.** `SearchEngine` reads the locale from the first path
  segment only when it matches `/^[a-z]{2}-[a-z]{2}$/i`. A two-letter locale such as `en` (the
  v2 starter's default) is never read from `/en/...`, and `/` has no segment at all — in both
  cases a localized project needs `NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE` or the request targets a
  collection that does not exist and returns nothing. Non-localized projects must leave it unset
  (they use the suffix-less collection).
- **`type` parameter collision.** `SearchFacet` has a `type` parameter (`select` /
  `multiSelect` / `range`). The compat adapter spreads the reserved `ComponentProps.type` last,
  so the prop is always `"searchFacet"`; the component reads the facet type from
  `component.parameters.type.value` instead. Do not "simplify" that.
- **Integration-provided parameter types.** `filterByConfig`, `queryByConfig`, `facetByConfig`,
  `sortByConfig`, `entryUrlMapping` resolve only when `uniform-search-integration` is installed.
  The 0.0.6 package's `searchBox` additionally carries six presentation parameters typed by the
  Design Extensions integration (`dex-*`) that the component never reads — strip them unless
  Design Extensions is installed.
- **`--yes` skips existing files.** Re-running the CLI with `-y` leaves an earlier copy in place;
  without it, existing files are overwritten in non-interactive mode.
- **Behavior relevancy has two silent preconditions.** Documents indexed before the
  `enrichmentTags` field existed carry no tags — a reindex is what fills them, a schema save
  alone does not — and selecting the behavior sort forces keyword retrieval for that request, so
  hybrid/semantic ranking is off while it is active. Both look like "boosting does nothing".
- **`Recommendations` is a server component with its own prerequisites** — `@uniformdev/context`,
  Next.js `cacheComponents`, and the manifest import path in `lib/search/enrichmentCategories.ts`.
  Copying it into a project without them fails at build time or, for the manifest path, at
  runtime with an empty category list.
- **Public env vars are inlined at build time.** The client reads `NEXT_PUBLIC_*`; a value
  added after the build is not picked up until the next build.

## What does not exist

- **No `searchPageSize` / `SearchPageSize` component or type.** Page size moved into
  `SearchPagination`.
- **No definition for `searchTotalAmount`.** The CLI copies `SearchTotalAmount.tsx` as a
  ready-made result-count component, but the package has no definition for it; map it only if
  you also create one.
- **No demo page or composition in the package.** Authors build the page; there is no
  `searchDemoPage` type to map.
- **No `SearchProvider` in `layout.tsx`.** `SearchEngine` provides it; `SearchAutocomplete` needs none.
- **No server subpath in `@uniformdev/search`.** Exports are `.` and `./react` only; the search
  request is a browser-side `POST` with a public key.
- **The CLI does not install `@uniformdev/search`, write env vars, or edit the resolver.** Its
  "Next steps" note lists what it left for you.
- **Not scaffolded by `create-uniform-search` 0.0.6** (the current release): the
  `searchBoxAutocomplete`, `recommendations`, `relatedContent`, `productCard` and `articleCard`
  definitions and components, `lib/search/retrieval.ts`, `enrichmentCategories.ts`,
  `cachedProjectMapPaths.ts`, and the `retrieval` parameter on Search Engine. The SDK side
  (`resolveEnrichmentBoost`, `EnrichmentBoost`, `SearchParams.mode`, the `enrichmentBoost`
  request field, the `behavior` order-by) **is** published in `@uniformdev/search` 0.0.8. Until a
  newer CLI ships the components, the SDK exports alone give you nothing to map — verify with
  the checks in ranking.md before relying on either half.

## Resources

- [Install](references/install.md) — prerequisite checks, the CLI invocation and what it writes,
  package install, theme tokens, env vars, resolver wiring for both resolver shapes, slot allowance, verification
- [Definitions](references/definitions.md) — what the package contains, the dedicated config, locale
  detection, the Design Extensions parameter strip, the push hand-off, what the author does in Uniform afterwards
- [Components](references/components.md) — how the scaffolded components behave at runtime: provider and
  slots, self-registration, renderers, autocomplete, typo tolerance, highlighting, localization, and the
  newer set the starter ships ahead of the CLI (search-box autocomplete, recommendations, related content + cards)
- [Ranking](references/ranking.md) — retrieval mode (hybrid vs exact) and behavior relevancy (enrichment
  boosting): the request contract, where it is wired, and the two silent preconditions
