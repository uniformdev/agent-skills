# Reference: Enrichment-Boosted Recommendations

Deep reference for the `uniform-enrichment-recommendations` skill. Domain-
agnostic — substitute your content type wherever it says "product".

## Concepts and terminology

| Term | Meaning |
| --- | --- |
| Enrichment category | Grouping of interests in Uniform Context. Public ID e.g. `int`, `brand`, `platform`. |
| Enrichment value | A value in a category. Public ID convention `<categoryId>_<value>` (e.g. `int_internet`). |
| Enrichment score | Number on the visitor profile keyed by the value public ID (`int_internet: 50`). Grows with engagement. |
| Enrichment tag (`$enr`) | An enrichment value attached to content so viewing it raises that score. |
| Content field | Field on the content type whose value is matched against the enrichment value. |
| Boost clause | `orderBy` string that re-ranks results: `boost\|fields.<field>:<value>:<weight>`. |

**Alignment rule (most common failure):** enrichment value suffix == stored
content field value. `int_internet` boosts only entries whose target field holds
`internet`.

## Data flow

```
visitor engages with tagged content
  → Uniform tracker raises score   → ufvd cookie: { int_internet: 50, int_mobility: 25 }
  → server reads cookie (CookieTransitionDataStore)
  → boost map: { "int,category": { value:"internet", score:50 }, ... }
  → orderBy: "boost|fields.category:internet:50|fields.category:mobility:25"
  → EntryDeliveryClient.list({ orderBy:[clause] }) → re-ranked entries
```

`ufvd` is the default Uniform tracker cookie holding visitor scores.

## The boostEnrichments option value format

Each multi-select option packs both halves of the alignment rule:

```
"<enrichmentCategoryId>,<contentFieldId>"
```

Examples:

```
"int,category"          # read scores in category `int`, match field `category`
"brand,brand"           # category `brand`, match field `brand`
"platform,promoPlatform"# category `platform`, match field `promoPlatform`
```

At request time the reader: (1) finds every score key starting with the category
ID, (2) takes the value suffix after the first `_`, (3) emits
`fields.<fieldId>:<suffix>:<score>` for each.

## Making scores grow (prerequisite for any effect)

Boosting is meaningless with zero scores. Ensure at least one is in place:

- **Enrichment tags (`$enr`)** on components/compositions/entries — automatic,
  author-managed. The tracker increments the tagged score (up to score cap) when
  the visitor views the content.
- **Programmatic** — `context.update({ enrichments: [{ cat, key, str }] })`
  writes a score under `<cat>_<key>`.
- **Signals** — dashboard-configured behavioral rules (URL, query param, repeat
  visits) that raise scores automatically.

A small "enrichment selector" debug UI that calls `context.update(...)` is
invaluable for testing arbitrary profiles.

## Configuring on a composition (author workflow)

1. Open the composition in the visual editor.
2. Add the recommendation component to a content slot.
3. Set `Content Type`.
4. Set `Relevance` (`boostEnrichments`) — one or more signals.
5. Set `Max Recommendations`.
6. Add a title in the title slot.
7. Publish.

**Default for unprofiled visitors:** no scores → default ordering. For a curated
fallback, pair with Uniform Personalization: a default (no-criteria) variation
shows hand-picked content; the enrichment-boosted variation takes over once
scores accumulate. Personalization picks *which* variation shows; boosting
orders *within* the recommendation query.

## Verifying

1. Confirm scores exist (inspect `ufvd` cookie / Uniform dev tools). Empty is OK
   — boost is skipped by design.
2. Simulate a profile via the debug UI or `context.update`.
3. Temporarily log the generated `orderBy`; expect `boost|fields.<f>:<v>:<n>`.
4. Reload: matching entries should move to the top. Change profile → ordering
   changes.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Ordering never changes | No scores written (not a missing tracker) | In Next.js App Router the tracker ships with `@uniformdev/next-app-router`; the real cause is an empty profile. Confirm content tagged or signals configured, then check `ufvd` actually holds scores. |
| `orderBy` always `undefined` | Empty scores or category prefix mismatch | Match `enrichmentKey` to the value public ID prefix exactly. |
| Clause built, nothing re-ranks | Field value mismatch | Enrichment value suffix must equal stored field value. |
| Matched value truncated | Extra `_` in value public ID | Use `<categoryId>_<value>` only. |
| Works locally, not SSR/edge | Cookie not read server-side | Read `ufvd` from request (`cookies()`) or pass `scoreCookie`. |
| Can't sort on custom field | Content API needs single content type to sort custom fields | Filter to one `type` (templates already do). |

## Notes on the templates

- `search.ts` — pure, no I/O; safe to unit test.
- `getEnrichmentBoostedOrderBy.ts` — Next.js App Router (`'use server'` +
  `cookies()`). For Pages Router/other, pass the cookie value in via
  `serverScoreCookie` from the request.
- `getRecommendations.ts` — single-content-type filter; returns raw entries (map
  to your card props in the component). Add `apiHost`/`edgeApiHost` to
  `EntryDeliveryClient` only if your project uses non-default hosts.
- `RecommendationsServerComponent.tsx` — async server component; swap the card +
  skeleton for the project's UI.
