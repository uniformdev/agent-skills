# Discovering what you actually have

The CLI, the SDK and the deployed search service move at different speeds, and the skill's
version notes go stale. Before wiring anything, read the installed artifacts. Every command runs
from the source root after step 3 (scaffold) and step 4 (package install).

## 1. What did the CLI write?

```bash
# the component set this CLI version ships — map exactly these type ids, nothing else
node -e 'console.log(require("./search-components.json").components.map(c=>c.id).join("\n"))'

# component files on disk vs. definitions in the package: a file with no definition
# (SearchTotalAmount.tsx) is not mapped; a definition with no file (searchBoxAutocomplete in
# 0.0.7) is not mapped either — map only ids present in both lists
ls components/search/*.tsx | xargs -n1 basename | sed 's/\.tsx$//'

# parameters typed by another integration — strip dex-* unless Design Extensions is installed
grep -o '"type": "dex-[a-z-]*"' search-components.json | sort | uniq -c

# the authored locale — must equal the project's default locale
grep -o '"_locales": \[[^]]*\]' search-components.json | sort -u

# does the project-map client send the key? no hit → CLI 0.0.6, apply the patch in install.md
grep -n "x-api-key" lib/search/projectMapClient.ts

# does the scaffold still gate on a project id? (0.0.6: yes, in SearchEngine.tsx; 0.0.7: no)
grep -rn "NEXT_PUBLIC_UNIFORM_PROJECT_ID" components/search lib/search

# what the scaffold expects from the SDK and the project — every hit is something to reconcile
grep -n "toPredefinedSortParam\|registerPredefinedSort" components/search/SearchSorting.tsx
grep -rn "manifest.json\|'use cache'" lib/search
```

## 2. What does the installed SDK export?

`package.json` is not an exported subpath of `@uniformdev/search`, so read the file, not the module:

```bash
node -e 'console.log(JSON.parse(require("fs").readFileSync("node_modules/@uniformdev/search/package.json","utf8")).version)'

# the whole public surface, one line each
grep -h "^export" node_modules/@uniformdev/search/dist/index.d.ts node_modules/@uniformdev/search/dist/react.d.ts

# the request shape the service accepts (mode, orderBy, enrichmentBoost, projectId are all optional)
awk '/interface SearchParams/,/^}/' node_modules/@uniformdev/search/dist/*.d.ts

# ranking support: 0 hits → older than 0.0.8, retrieval mode and behavior relevancy do not apply
grep -c "resolveEnrichmentBoost\|SearchMode" node_modules/@uniformdev/search/dist/index.d.ts

# predefined sort: 0 hits → SDK < 0.0.10; upgrade it (CLI ≥ 0.0.7's SearchSorting.tsx imports it)
grep -c "toPredefinedSortParam" node_modules/@uniformdev/search/dist/index.d.ts

# click tracking: 0 hits → older than 0.0.7
grep -c "trackClick" node_modules/@uniformdev/search/dist/*.d.ts
```

## 3. Which credential does the project hold?

| `NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY` looks like | It is | Consequence |
|---|---|---|
| `ufs.<keyId>.<secret>` | a managed key minted from **Connect**, scoped to one project | the service fills `projectId` from it and rejects any other project id; `NEXT_PUBLIC_UNIFORM_PROJECT_ID` is optional |
| anything else | the deployment-wide legacy `SEARCH_API_KEY` | the request's own `projectId` is used; the scaffold's `NEXT_PUBLIC_UNIFORM_PROJECT_ID` must be set |
| empty | nothing | `/api/search` may still answer on an unconfigured deployment; `/api/project-map` never does |

```bash
grep -h "^NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY=" .env .env.local 2>/dev/null | sed -E 's/=(ufs\.[^.]*).*/=\1.…/; s/=([^u].{0,3}).*/=\1…/'
```

Never print the full value.

## 4. Does the project already have search?

```bash
grep -rln "@uniformdev/search" --include=*.ts --include=*.tsx . | grep -v node_modules
grep -rn "searchEngine\|SearchProvider" components lib app 2>/dev/null | head
ls search-components.json uniformsearch.config.js 2>/dev/null
```

A hit means a previous install: re-running the CLI overwrites those files (or skips them with
`-y`), and a hand-modified `projectMapClient.ts` or renderer module is lost. Diff before you scaffold.
