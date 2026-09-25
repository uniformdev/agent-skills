# Install

The moves for getting Uniform Search into an existing App Router project, with the checks that
decide whether to continue.

## Prerequisite checks

Run these before changing anything. Report failures and stop; do not proceed "with what is
possible" unless the user says to.

| Check | How | If it fails |
|---|---|---|
| App Router | `app/` exists and `app/uniform/[code]/page.tsx` renders `UniformComposition` | Page Router (`pages/`, `@uniformdev/canvas-next`, `registerUniformComponent`) — the components import `@uniformdev/next-app-router/compat`; stop and say they would need rewriting |
| v2 SDK | `grep '"@uniformdev/next-app-router"' package.json` | Missing — not a Uniform App Router project; point at the `uniform-nextjs-app-router` skill |
| Resolver | `grep -rl "ResolveComponentFunction\|createAdapterResolveComponentFunction" components lib app` | None — the project has no component mapping yet; set that up first |
| Tailwind | `tailwindcss` in `package.json`; a global stylesheet with `@import "tailwindcss"` (v4) or a `tailwind.config.*` (v3) | Absent — markup still works but is unstyled; tell the user and ask before continuing |
| Integration | Ask: "Is the Uniform Search integration installed in the project, and is content indexed?" A populated `NEXT_PUBLIC_UNIFORM_SEARCH_API_URL` is a good sign | Not installed — the custom parameter types will not resolve; the user installs it from the integrations page first |

## Scaffold with the CLI

Determine two inputs first:

- **`<base>`** — the `@/*` alias base from `tsconfig.json` → `compilerOptions.paths["@/*"]`:
  `./*` → `.`; `./src/*` → `src`. The scaffolded files import `@/components/search/…` and
  `@/lib/search/…`, so the base must be where that alias resolves. No `@/*` alias: scaffold to
  `.` and rewrite those specifiers afterwards (they appear in `SearchEngine.tsx`,
  `SearchList.tsx`, `SearchAutocomplete.tsx`).
- **`<locale>`** — the project's default locale, canonical casing (`en`, `en-US`). See
  [definitions.md](definitions.md#locale).

Then, from the directory holding `package.json`:

```bash
npx -y create-uniform-search@latest --dir . --components --no-deploy --no-skill \
  --src-root <base> --locale <locale>
```

Flags that matter: `--components` installs the code and the package; `--no-deploy` leaves the
push with the user (with creds in `.env` and no flag, non-interactive mode still does not deploy,
but say it explicitly); `--no-skill` stops it installing its own `.claude/skills/add-uniform-search`
copy next to this skill; `--locale` skips the API detection; `--dry-run` previews the file list.
Without `-y`, existing files are overwritten in non-interactive mode; with `-y` they are skipped.

Verified output with `create-uniform-search@0.0.10` (templates identical from 0.0.7) on the v2
starter: 33 files —
`components/search/**` (10 components incl. `Recommendations.tsx`, `SearchFilters/`,
`renderers/`, `ui/`), `lib/search/*.ts` (6: `searchClient`, `projectMapClient`, `typoTolerance`,
`retrieval`, `enrichmentCategories`, `cachedProjectMapPaths`), `styles/search-theme.css`, plus
`search-components.json` and `uniformsearch.config.js` at the root, and a
`Set search content locale to "<locale>"` line. The CLI runtime and flags are unchanged since
0.0.6; only the templates moved. The scaffolded files import `react`, `next/navigation`,
`next/headers`, `next/cache`, `@uniformdev/search`, `@uniformdev/search/react`,
`@uniformdev/next-app-router/{compat,component}`, `@uniformdev/next-app-router-client`,
`@uniformdev/context`, their own `@/components/search` / `@/lib/search` paths — and one file the
project must provide: `@/lib/uniform/manifest.json` (see Reconcile below).

## Runtime package

The CLI does not install it. Detect the package manager from the lockfile and install
`@uniformdev/search` (peer: React ≥ 18). `getHighlightMatch`, which the scaffolded
`ui/Highlighted.tsx` imports, exists from `0.0.3`; `trackClick` from `0.0.7`; the ranking
exports (`resolveEnrichmentBoost`, `SearchParams.mode`) from `0.0.8`; `0.0.9` is the same code
with `projectId` documented as optional; `0.0.10` adds the predefined-sort exports that CLI
≥ 0.0.7's `SearchSorting.tsx` imports. Install the latest — an older pin fails typecheck.

## Theme tokens

The components use `mono-50 … mono-900` utility classes. The CLI writes the palette to
`<base>/styles/search-theme.css` but does not wire it:

- **Tailwind v4** — `@import "../styles/search-theme.css";` (path relative to the global
  stylesheet) after `@import "tailwindcss";`, or paste its `@theme` block into the global
  stylesheet.
- **Tailwind v3** — add the ten values under `theme.extend.colors.mono` in `tailwind.config.*`.
- If the project already has a neutral scale it wants to reuse, alias `mono` to it instead.

## Environment variables

The client (`lib/search/searchClient.ts`) reads two **public** variables; one more is optional and
only for localized projects. The CLI adds none of them:

```dotenv
NEXT_PUBLIC_UNIFORM_SEARCH_API_URL=      # base URL of the deployed search service, e.g. https://acme.search.uniform.app
NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY=      # project-scoped search key, ufs.… — generated from Connect in the Uniform Search dashboard
NEXT_PUBLIC_UNIFORM_DEFAULT_LOCALE=      # localized projects only, e.g. en-US; leave unset otherwise
```

The client posts to `${NEXT_PUBLIC_UNIFORM_SEARCH_API_URL}/api/search` with the key in an
`x-api-key` header — the base URL, not the `/api/search` path, goes in the variable.

**Where the key comes from.** The user opens the Uniform Search tool in their Uniform project and
presses **Connect** in the status strip; the drawer shows the search URL and mints a search-only
key for that project. The full key is shown once. It is safe in client code: it can query the
index and report result clicks for its own project, nothing else. **Rotate** in the same drawer
issues a new key and keeps the old one working for 24 hours. Deployments provisioned before the
drawer existed also accept a deployment-wide `SEARCH_API_KEY` value (legacy, being retired).

**The project id is not part of the contract any more.** A `ufs.…` key identifies its project, and
the service fills `projectId` in from the key. Nothing scaffolded by 0.0.7 reads
`NEXT_PUBLIC_UNIFORM_PROJECT_ID`. If the project already defines it (an older scaffold, or its own
use), it must equal the project the key was minted for — a value naming any other project turns
every search into a 401. Never set it from a guess.

Check `.env`, `.env.local` and `.env.example`. Add missing keys with an empty value and a comment
saying where the value comes from. The CLI push the user runs later uses the standard
`UNIFORM_API_KEY` / `UNIFORM_PROJECT_ID`, which an integrated project already has.

## Reconcile the scaffold

Run `npx tsc --noEmit` right after scaffolding and installing the SDK. What it reports depends
on which CLI and SDK versions met; every case below was hit on the v2 starter and each fix was
typechecked and built (`@uniformdev/next-app-router` 20.73, `@uniformdev/search` 0.0.10; the
strip recipe on 0.0.9).

### `SearchSorting.tsx`: `'@uniformdev/search'` has no exported member `toPredefinedSortParam`

CLI ≥ 0.0.7 ships a Search Sort that registers an editor-pinned *predefined sort*; the SDK exports
it needs arrived in `@uniformdev/search` 0.0.10 (four errors on anything older:
`toPredefinedSortParam`, `PredefinedSortValue`, `registerPredefinedSort`,
`unregisterPredefinedSort`). **The fix is the SDK upgrade** — `npm install @uniformdev/search@latest`,
then `grep -c toPredefinedSortParam node_modules/@uniformdev/search/dist/index.d.ts` ≥ 1. Only
when the project is pinned to an older SDK and cannot move, strip the feature; the component
keeps its visitor-facing order-by exactly as before, and the `predefinedSort` parameter is
simply ignored:

```bash
node -e '
const fs=require("fs");const f="components/search/SearchSorting.tsx";let s=fs.readFileSync(f,"utf8");
const cuts=[
 "import { toPredefinedSortParam, type PredefinedSortValue } from \x27@uniformdev/search\x27;\n",
 "  /**\n   * Editor-defined predefined sort (`predefinedSortConfig`): a field, behavior relevancy or\n   * conditional `_eval` rules. Applied with the default ordering only (the first order-by\n   * option, or none); when the visitor picks another option, only that option is used.\n   */\n  predefinedSort?: PredefinedSortValue;\n",
 "    registerPredefinedSort,\n    unregisterPredefinedSort,\n",
 "  // The predefined sort applies even when there are no visitor options (nothing rendered);\n  // the provider drops it while the visitor has a non-default option selected.\n  useEffect(() => {\n    registerPredefinedSort(id, toPredefinedSortParam(predefinedSort));\n    return () => unregisterPredefinedSort(id);\n  }, [id, predefinedSort, registerPredefinedSort, unregisterPredefinedSort]);\n\n",
];
for(const c of cuts){ if(!s.includes(c)) throw new Error("anchor not found — different CLI version; edit by hand"); s=s.replace(c,""); }
s=s.replace("({ orderBy, predefinedSort })","({ orderBy })");
fs.writeFileSync(f,s);
'
```

Tell the user the predefined-sort editor on Search Sort has no effect until the SDK is upgraded
and the strip is reverted (re-run the CLI over the file).

### `enrichmentCategories.ts`: cannot find module `@/lib/uniform/manifest.json`

Behavior boosting reads the enrichment category ids from the Context manifest. The v2 starter
fetches its manifest at runtime and keeps no copy; download one (standard CLI credentials):

```bash
npx uniform context manifest download --output ./lib/uniform/manifest.json
```

A project that keeps its manifest elsewhere: change the import path in
`lib/search/enrichmentCategories.ts` instead. A manifest with no `project.pz.enr` yields an
empty category list, which disables boosting without error — so when the download cannot run
(no `UNIFORM_API_KEY` / `UNIFORM_PROJECT_ID` in the environment, or placeholder values), write
the smallest valid manifest and tell the user to replace it with a real download:

```bash
mkdir -p lib/uniform && [ -f lib/uniform/manifest.json ] || echo '{"project":{}}' > lib/uniform/manifest.json
```

Add a `uniform:manifest` npm script (`uniform context manifest download --output
./lib/uniform/manifest.json`) so the file is refreshed when enrichments change.

### `'use cache'` in `cachedProjectMapPaths.ts`: build fails without `cacheComponents`

`next build` stops with *To use "use cache", please enable the feature flag `cacheComponents`*.
Two ways out, and the second is the default for a project that does not already run cache
components — switching them on is project-wide (the v2 starter's `/playground/[code]` then fails
to prerender because it reads request data outside `<Suspense>`):

1. The project already has `cacheComponents: true` → nothing to do.
2. Otherwise swap the cached helper for the direct fetch and delete it:

```bash
node -e '
const fs=require("fs");const f="components/search/Recommendations.tsx";let s=fs.readFileSync(f,"utf8");
const a="import { getCachedPathsByNodeId } from \x27@/lib/search/cachedProjectMapPaths\x27;";
const b="import { fetchPathsByNodeId } from \x27@/lib/search/projectMapClient\x27;\nconst SEARCH_API_URL = process.env.NEXT_PUBLIC_UNIFORM_SEARCH_API_URL ?? \x27\x27;";
const c="  const pathsByNodeId = locale ? await getCachedPathsByNodeId(locale) : {};";
const d="  const pathsByNodeId = locale && SEARCH_API_URL ? await fetchPathsByNodeId(SEARCH_API_URL, locale) : {};";
if(!s.includes(a)||!s.includes(c)) throw new Error("anchor not found"); fs.writeFileSync(f,s.replace(a,b).replace(c,d));
' && rm lib/search/cachedProjectMapPaths.ts
```

`fetchPathsByNodeId` keeps an in-process map per locale, so the cost is one extra request per
server process, not per visitor.

### CLI 0.0.6 only: `projectMapClient.ts` sends no key

`/api/project-map` (node-id → path map for composition hits) requires `x-api-key` and fails
closed; the 0.0.6 scaffold's `lib/search/projectMapClient.ts` calls it bare, gets a 401, logs it
to the browser console and returns `{}` — every composition hit then renders without a link.
0.0.7 fixed this. On a 0.0.6 scaffold add the header (run from the source root):

```bash
node -e '
const fs=require("fs");const f="lib/search/projectMapClient.ts";let s=fs.readFileSync(f,"utf8");
const from="    const res = await fetch(url);";
const to="    const apiKey = process.env.NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY;\n    const res = await fetch(url, { headers: apiKey ? { \x27x-api-key\x27: apiKey } : {} });";
if(!s.includes(from)) throw new Error("anchor not found — the CLI version already sends the key?");
fs.writeFileSync(f,s.replace(from,to));
'
grep -n "x-api-key" lib/search/projectMapClient.ts   # → one hit
```

If the anchor is not found, the scaffold already sends the key (0.0.7 or newer) and nothing is
needed.

## Register the components

The scaffolded components use the compat shape — `ComponentProps` from
`@uniformdev/next-app-router/compat`, parameter values spread onto props — so they are registered
through `createAdapterResolveComponentFunction` with `mode: 'adapted'`. The type ids are fixed by
the definitions; keep them exactly. Map only types that have a definition in
`search-components.json` (`SearchTotalAmount.tsx` is scaffolded but has none):

```ts
import { createAdapterResolveComponentFunction } from "@uniformdev/next-app-router/compat";
import type { ComponentType } from "react";
import SearchEngine from "@/components/search/SearchEngine";
import SearchBox from "@/components/search/SearchBox";
import SearchAutocomplete from "@/components/search/SearchAutocomplete";
import SearchList from "@/components/search/SearchList";
import SearchPagination from "@/components/search/SearchPagination";
import SearchSorting from "@/components/search/SearchSorting";
import FacetContainer from "@/components/search/FacetContainer";
import SearchFacet from "@/components/search/SearchFacet";

const adapted = (type: string, component: ComponentType<any>) =>
  ({ type, mode: "adapted" as const, component });

export const searchMappings = {
  searchEngine: adapted("searchEngine", SearchEngine),
  searchBox: adapted("searchBox", SearchBox),
  searchAutocomplete: adapted("searchAutocomplete", SearchAutocomplete),
  searchList: adapted("searchList", SearchList),
  searchPagination: adapted("searchPagination", SearchPagination),
  searchSorting: adapted("searchSorting", SearchSorting),
  facetContainer: adapted("facetContainer", FacetContainer),
  searchFacet: adapted("searchFacet", SearchFacet),
};
```

CLI ≥ 0.0.7 also ships `Recommendations.tsx` with a `recommendations` definition — map it
(`recommendations: adapted("recommendations", Recommendations)`) once the reconcile step above is
done; it is a server component, and the adapter wraps it fine. Map only ids that have **both** a
definition and a file: the 0.0.7 package defines `searchBoxAutocomplete` without shipping the
component (leave it unmapped), and `SearchTotalAmount.tsx` ships without a definition. A future
CLI may add `RelatedContent`, `ProductCard`, `ArticleCard`; map them the same way when both
halves are present.

**Project already uses the adapter** (`createAdapterResolveComponentFunction({ mappings })`):
spread `searchMappings` into its `mappings`. Done.

**Project uses a plain `resolveComponent`** (the v2 starter shape — a `ResolveComponentFunction`
returning `{ component }`): keep it, and delegate to an adapter for the search types only.
`createAdapterResolveComponentFunction` returns a "Not implemented" component for anything it
does not know, so it must be gated, not chained:

```ts
const resolveSearchComponent = createAdapterResolveComponentFunction({ mappings: searchMappings });

export const resolveComponent: ResolveComponentFunction = (args) => {
  if (args.component.type in searchMappings) return resolveSearchComponent(args);
  // …the project's existing mapping, unchanged…
  return { component: componentMap[args.component.type] ?? DefaultNotFoundComponent };
};
```

Do not convert the project's existing components to adapted mode to "make it uniform" — that
rewrites working code for no gain. This wiring typechecks and builds on the v2 starter with
`@uniformdev/next-app-router` 20.73; no `transpilePackages` entry is needed.

## Allow the types in slots

Definitions with an explicit `allowedComponents` list (the v2 starter's `page.content` allows
only `hero` plus `$personalization`/`$test`/`$localization`) will not offer the new types to
authors. Add `searchEngine` to the page content slot, and `searchAutocomplete` to wherever the
header lives, using the project's normal path for its own definitions — the Uniform MCP
(`mutateComponent`) when it is connected; otherwise tell the user which slots to open in the
Uniform UI and continue with the remaining steps — do not stop to ask for MCP access. This is a
change to a definition the project owns, so it does not go in the search package.

## Verify

```bash
npx tsc --noEmit
```

Then `next build` if the project builds without live Uniform credentials. Typical failures and
their cause: unresolved `@/components/search/...` → wrong `--src-root` for the alias;
`Cannot find module '@uniformdev/search'` → runtime package not installed; `no exported member
'toPredefinedSortParam'` → SDK older than 0.0.10, upgrade it (see Reconcile); `Cannot find module
'@/lib/uniform/manifest.json'` → download the manifest; `To use "use cache"` at build → take the
uncached path; `mono-*` classes with no effect → theme file not imported; search returns 401 →
a `NEXT_PUBLIC_UNIFORM_PROJECT_ID` naming a different project than the key; composition hits
have no links and the console shows `project map fetch failed: 401` → a 0.0.6 scaffold without
the header patch.
