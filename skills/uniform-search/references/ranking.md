# Ranking: retrieval mode and behavior relevancy

Three ranking controls exist in the current search starter. Each needs two things: the SDK
exports and the component code that uses them, and they are released separately. Check both
before writing code against any of them:

```bash
grep -c "resolveEnrichmentBoost\|SearchMode" node_modules/@uniformdev/search/dist/index.d.ts
# 0 → SDK older than 0.0.8; retrieval mode and behavior relevancy cannot work
grep -c "toPredefinedSortParam" node_modules/@uniformdev/search/dist/index.d.ts
# 0 → SDK ≤ 0.0.9; predefined sort cannot work, and CLI 0.0.7's SearchSorting.tsx will not typecheck (install.md)
ls lib/search/retrieval.ts lib/search/enrichmentCategories.ts 2>/dev/null
# missing → CLI ≤ 0.0.6; the ranking-aware components were not scaffolded — do not write them by hand
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

## Predefined sort (editor-pinned primary ordering)

**SDK: not in 0.0.9; CLI 0.0.7 already codes against it.** The `predefinedSort` parameter on
Search Sort (type `predefinedSortConfig`) lets an editor pin a *primary* sort that belongs to
the default ordering — the first order-by option, or no options at all, which then only breaks
ties. When the visitor picks another option, only that option is sent.

| Mode | Stored value (what the editor writes) | What the engine sorts by |
|---|---|---|
| Field | `{ mode: 'field', field: 'created', direction: 'desc' }` | `created:desc` |
| Behavior relevancy | `{ mode: 'field', field: '$behavior', direction: 'desc' }` | the per-visitor `_eval` from the section above |
| Conditional | `{ mode: 'conditional', direction: 'desc', rules: [{ filterString: 'inStock:=true' }, …] }` | `_eval([(rule1):N, …, (ruleN):1]):desc` — rule order is priority; `asc` puts matches last |

`SearchSorting.tsx` converts the stored value with `toPredefinedSortParam` and registers it with
the provider; the request then carries `predefinedSort` alongside `orderBy`. Server-side, a
field must be sortable in the collection schema and a rule must be a single-line, balanced
Typesense filter; anything invalid is dropped silently, never a request error, and rules with an
unresolved `${token}` are skipped.

Two traps, both silent:

- **One `_eval` per request.** Typesense allows a single conditional clause, so a conditional
  predefined sort wins over a visitor's *Behavior relevancy* choice — the visitor's `_eval` is
  dropped and the response carries a `warnings[]` entry. Read `warnings` when a sort seems ignored.
- **Three `sort_by` clauses total.** Predefined first, visitor sort, then tiebreakers, deduped
  and capped at three; with behavior relevancy in play, `updated:desc` is the one that falls off.
