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

What the CLI writes (33 files):

```text
<srcRoot>/components/search/**   React components (client) + Recommendations (server) + renderers + ui
<srcRoot>/lib/search/**          searchClient, projectMapClient, typoTolerance, retrieval,
                                 enrichmentCategories, cachedProjectMapPaths
<srcRoot>/styles/search-theme.css  Tailwind v4 @theme block: the mono-* palette the components use
./search-components.json         one CLI "package" file: component definitions, block content
                                 types, the "Uniform Search" category, two component patterns
./uniformsearch.config.js        dedicated CLI config: directory = search-components.json, mode = create
```

What it does **not** do, and this skill covers: install `@uniformdev/search`, add env vars, import
the theme, make the scaffold compile on the target project, register the components in the
resolver, open the page slot, or (unless told to) push.

## Sequence

1. **Verify prerequisites, stop if unmet.** `app/` directory; `@uniformdev/next-app-router` in
   `package.json`; a `resolveComponent` (or `createAdapterResolveComponentFunction`) resolver
   and `app/uniform/[code]/page.tsx` rendering `UniformComposition`; Tailwind. Ask the user to
   confirm the Uniform Search integration is installed in the project and content is indexed —
   not detectable from the codebase. A Page Router project (`pages/`, `@uniformdev/canvas-next`)
   is out of scope: say so and stop. Checks: [install.md](references/install.md#prerequisite-checks).
2. **Find the project's default locale** before scaffolding (`uniform-data/locale/*.yaml`, the
   locales REST endpoint, or ask). The CLI authors the definitions package in that locale:
   [definitions.md](references/definitions.md#locale).
3. **Scaffold with the CLI**, non-interactively, from the directory holding `package.json`:
   ```bash
   npx -y create-uniform-search@latest --dir . --components --no-deploy --no-skill \
     --src-root <base> --locale <locale>
   ```
   `<base>` is the `@/*` alias base from `tsconfig.json` (`.` or `src`); `<locale>` the canonical
   code from step 2 (`en`, `en-US`). `--no-deploy` keeps the push with the user; `--no-skill`
   stops it installing its own copy of a Claude skill next to this one.
4. **Install `@uniformdev/search`** (latest) with the project's package manager — the CLI does
   not. Then read what you actually got — `search-components.json` for the type ids, the
   scaffolded files for what they import — with [discovery.md](references/discovery.md).
5. **Import the theme tokens** — `styles/search-theme.css` — from the global stylesheet
   (Tailwind v4), or merge its palette into `theme.extend.colors.mono` (v3).
6. **Environment variables.** Two public variables (`NEXT_PUBLIC_UNIFORM_SEARCH_API_URL`,
   `NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY`) plus, for localized projects only,
   `NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE`. The key is project-scoped and identifies the project;
   there is no project id in the contract. Leave unknown values blank; never overwrite a
   populated value; never echo secrets. Where the key comes from:
   [install.md](references/install.md#environment-variables).
7. **Reconcile the scaffold.** Run `npx tsc --noEmit` before wiring anything. On the v2 starter
   two things the CLI cannot supply are missing — a local Context manifest for
   `enrichmentCategories.ts`, and either `cacheComponents` or an uncached swap for the
   `'use cache'` helper. One tested recipe each:
   [install.md](references/install.md#reconcile-the-scaffold).
8. **Register the search types in the existing resolver** without rewriting it. The scaffolded
   components use the compat (flattened-props) shape and register through
   `createAdapterResolveComponentFunction`; a plain `resolveComponent` delegates to that adapter
   for the search types only — the gating rule below, code in
   [install.md](references/install.md#register-the-components). Map only ids that have both a
   definition in the package and a file on disk.
9. **Allow `searchEngine` in the page's content slot** (and `searchAutocomplete` wherever the
   header lives). Slots with an explicit `allowedComponents` list will not offer the new types
   otherwise. Change the project's own `page` definition the way the project normally does:
   Uniform MCP `mutateComponent` when it is connected; otherwise tell the user which slots to
   open in the Uniform UI and move on — never block the rest of the work on this step.
10. **Check the definitions package, then hand the push to the user.** Confirm the locale the CLI
    wrote, strip the Design Extensions parameters if that integration is not installed, give the
    user the push command. **Do not run the push.** [definitions.md](references/definitions.md).
11. **Verify** with `npx tsc --noEmit` (and `next build` if the project builds without live
    credentials). Then tell the user what to do in Uniform: push, add a **Search Engine** to a
    page, drop **Search Box** / **Search Results** / **Facet Container** + **Search Facet**s into
    its slots, configure **Query By** and **Facet by field**, preview.

## Decision rules

- **The CLI is the source of the code and the definitions.** A hand-written component drifts from
  the definitions immediately, and a hand-written definition cannot use the integration's
  parameter types correctly.
- **Definitions ship as a vendored CLI package, not through MCP and not in `uniform-data/`.**
  They are a fixed set that must match the scaffolded React code, and `serialization.mode:
  'create'` makes the push additive and idempotent — creates what is missing, never updates or
  deletes. Keeping them out of the project's own sync directory keeps them out of its
  `mirror`/`createOrUpdate` semantics. The `uniform-sdk` rule against editing serialized Uniform
  data is about the project's `uniform-data/`; the only edits to this package file are the
  locale (done by the CLI) and the optional parameter strip.
- **The push mode lives in the config file.** `uniform sync push` has no `-m/--mode` flag;
  `uniformsearch.config.js` sets it.
- **Adapter gating.** `createAdapterResolveComponentFunction` never returns `undefined` for an
  unknown type — it returns a "Not implemented" component — so it cannot be chained as a
  fallback after the project's resolver. Gate on the search type set first, then fall through
  to the existing logic. If the project already uses the adapter, just add the mappings.
- **Take the uncached path unless the project already runs cache components.** Enabling
  `cacheComponents` is project-wide: every route that reads request data outside `<Suspense>`
  stops prerendering (the v2 starter's playground route does).
- **Ranking is configured by authors, not in code.** Retrieval mode is the `retrieval` select on
  Search Engine (leave it unset unless meaning-based matches are wrong for that placement);
  behavior relevancy is a sort option in Search Sort, and an editor-pinned primary sort is its
  `predefinedSort` parameter. For per-visitor lists without a search page use `Recommendations`.
  Enrichment concepts live in the `uniform-enrichment-recommendations` skill — link, do not restate.
- **Page size is configured on Search Pagination; order-by on Search Sort.** `SearchEngine`'s
  `orderBy`/`pageSizes` props are deprecated compatibility inputs; never model new content on them.
- **Search components are client components by design.** Search state is React context. Do not
  remove `'use client'` to match the project's RSC components.

## Silent failures to check for

Each is explained once, in the reference it links to.

- Package authored in a locale that is not the project's default → pushes fine, patterns unusable.
  [definitions.md](references/definitions.md#locale)
- Locale casing: search collections want `en-us`, Uniform lookups want `en-US`; and the engine
  reads a locale from the URL only when it looks like `xx-yy`, so `/en/...` and `/` need
  `NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE`. [components.md](references/components.md#localization)
- `SearchFacet`'s `type` parameter collides with the reserved `ComponentProps.type`; the
  component reads `component.parameters.type.value` — keep that.
  [components.md](references/components.md#the-type-parameter-on-searchfacet)
- Integration-provided parameter types resolve only where `uniform-search-integration` is
  installed; `searchBox` carries Design Extensions (`dex-*`) parameters nobody reads — strip them.
  [definitions.md](references/definitions.md#strip-the-design-extensions-parameters)
- A `NEXT_PUBLIC_UNIFORM_PROJECT_ID` naming any project but the key's own turns every search into
  a 401. [install.md](references/install.md#environment-variables)
- `/api/project-map` fails closed; a client without `x-api-key` gets 401 in the browser console
  and every composition hit renders without a link.
  [components.md](references/components.md#result-renderers)
- `searchBoxAutocomplete` is defined in the package but the CLI ships no component for it — do
  not map it, do not write it. [components.md](references/components.md#newer-components-starter-ahead-of-the-published-cli)
- Behavior relevancy: documents indexed before `enrichmentTags` existed need a **reindex**, and
  the behavior sort forces keyword retrieval. Both look like "boosting does nothing".
  [ranking.md](references/ranking.md#behavior-relevancy-enrichment-boosting)
- Re-running the CLI with `-y` skips existing files; without it they are overwritten.
  [install.md](references/install.md#scaffold-with-the-cli)
- `NEXT_PUBLIC_*` values are inlined at build time; a value added after the build needs a rebuild.

## What does not exist

- **No `searchPageSize` / `SearchPageSize` component or type.** Page size moved into
  `SearchPagination`.
- **No definition for `searchTotalAmount`.** The CLI copies `SearchTotalAmount.tsx` as a
  ready-made result-count component, but the package has no definition for it; map it only if
  you also create one.
- **No `SearchBoxAutocomplete.tsx`, `RelatedContent`, `ProductCard` or `ArticleCard`** in the
  scaffold, and no click tracking in `SearchList` (`trackClick` is in the SDK; the scaffolded list
  does not call it). They exist in the Uniform search starter only.
- **No demo page or composition in the package.** Authors build the page; there is no
  `searchDemoPage` type to map.
- **No `SearchProvider` in `layout.tsx`.** `SearchEngine` provides it; `SearchAutocomplete` needs none.
- **No server subpath in `@uniformdev/search`.** Exports are `.` and `./react` only; the search
  request is a browser-side `POST` with a public key.
- **The CLI does not install `@uniformdev/search`, write env vars, or edit the resolver.** Its
  "Next steps" note lists what it left for you.

## Resources

- [Discovery](references/discovery.md) — read what the CLI wrote, what the installed SDK exports, which
  credential the project holds and whether search is already there, before wiring anything
- [Install](references/install.md) — prerequisite checks, the CLI invocation, package install, theme tokens,
  env vars and the search key, reconciling the scaffold, resolver wiring for both resolver shapes, slot
  allowance, verification
- [Definitions](references/definitions.md) — what the package contains, the dedicated config, locale
  detection, the Design Extensions parameter strip, the push hand-off, what the author does in Uniform afterwards
- [Components](references/components.md) — how the scaffolded components behave at runtime: provider and
  slots, self-registration, renderers, autocomplete, typo tolerance, highlighting, localization, and what
  the starter has that the scaffold does not
- [Ranking](references/ranking.md) — retrieval mode (hybrid vs exact), behavior relevancy (enrichment
  boosting) and the editor-pinned predefined sort: request contracts, where each is wired, silent preconditions
