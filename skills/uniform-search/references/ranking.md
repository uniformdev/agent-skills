# Ranking: retrieval mode and behavior relevancy

Two ranking controls exist in the current search starter. Both need two things: the SDK exports
(`@uniformdev/search` **0.0.8 or later**) and the component code that uses them, which
`create-uniform-search` 0.0.6 does not scaffold. Check both before writing code against them:

```bash
grep -c "resolveEnrichmentBoost\|SearchMode" node_modules/@uniformdev/search/dist/index.d.ts
# 0 → SDK older than 0.0.8; upgrade before anything below can work
ls lib/search/retrieval.ts lib/search/enrichmentCategories.ts 2>/dev/null
# missing → the CLI version did not ship the ranking-aware components; do not write them by hand
```

## Retrieval mode (`retrieval` on Search Engine)

Whether semantic search runs is decided by the deployment, not the site: with it enabled the
endpoint runs hybrid (exact wording plus meaning), without it the same request runs exact-only.
`lib/search/retrieval.ts` therefore maps the `retrieval` parameter to **nothing** by default:

| `retrieval` | Sent to the service | Use when |
|---|---|---|
| unset / `hybrid` | `{}` — the endpoint applies the project default | Almost always. A component configured today keeps working unchanged when semantic search is switched on later |
| `exact` | `mode: 'keyword'` | Meaning-based matches are a bug, not a bonus: SKU or part-number lookup, a redirect table, an autocomplete over a controlled vocabulary |

`exact` is also the only site-side brake: enabling semantic search changes a live site's results
with no deploy, so a placement that must not move pins itself here. The preset merges alongside
the typo-tolerance preset rather than replacing it — the two are independent.

`SearchParams.mode` is `'keyword' | 'semantic' | 'hybrid'` in the SDK source; the starter never
sends `semantic` or `hybrid` explicitly, and neither should new code.

## Behavior relevancy (enrichment boosting)

The integration indexes every `$enr` (Uniform Context enrichment) value on a document into two
locked system fields — `enrichmentTags` (`string[]`, `"<cat>_<key>"` tokens identical to the
Context tracker's score keys) and `enrichments` (raw, stored only). At query time a request can
carry the visitor's reduced scores and ask the engine to rank by them. For the Context side —
what enrichments are, how scores grow, reading the `ufvd` cookie — use the
`uniform-enrichment-recommendations` skill; this section is only the search-side contract.

**Request shape.** `orderBy: 'behavior'` plus a structured boost — never a raw sort string:

```ts
import { resolveEnrichmentBoost } from '@uniformdev/search';
const values = resolveEnrichmentBoost({ scores, categories }); // top value per category, top 3 categories
performSearch({ search: '', orderBy: 'behavior', enrichmentBoost: { values }, /* … */ });
```

`resolveEnrichmentBoost` matches categories by **longest prefix** against the known category ids
— never by splitting a score key on `_`, which mis-parses ids that contain underscores. The
category list comes from the Context manifest (`manifest.project.pz.enr` keys;
`lib/search/enrichmentCategories.ts` imports it from `@/lib/uniform/manifest.json` — **fix that
path** to wherever the target project keeps its manifest). An empty category list or empty
scores means no boost is ever sent, which is safe.

**Where it is wired in the starter.**

- `SearchEngine` reads scores client-side with `useScores` from
  `@uniformdev/next-app-router-client`, reduces them, and passes `enrichmentBoost` to
  `SearchProvider`; the provider attaches it only while the active order-by is `behavior`.
- `SearchSorting` exposes it as an author choice: **Behavior relevancy (Uniform Context)** in the
  sort editor writes the `$behavior` sentinel, which `buildOrderByQuery` maps to `'behavior'`.
- `Recommendations` (server component) does the same from the `ufvd` cookie with a wildcard
  query and no facets — see [components.md](components.md#recommendations).

**Guarantees and traps, all silent.**

- Ranking happens in the engine (`sort_by`), so facet counts, totals and pagination are
  unchanged; an empty or invalid profile falls back to default relevance — it never fails a search.
- **A behavior sort forces keyword retrieval.** With semantic search enabled, selecting it drops
  the vector half of hybrid ranking for that request. Expected, but easy to misread as "semantic
  search stopped working".
- **Documents indexed before `enrichmentTags` existed carry no tags.** The next schema save adds
  the fields in place; a **reindex** is what fills them. Until then the clause is built and
  nothing re-ranks.
- Only the reduced top-N signals leave the browser, never the full score vector; the BFF
  validates every token, clamps scores to 1..100 and keeps at most 3 signals.
- Never cache personalised ordering publicly: `/api/search` is a POST for that reason, and
  anything reading `ufvd` must sit in a dynamic (Suspense) subtree under cache components.
