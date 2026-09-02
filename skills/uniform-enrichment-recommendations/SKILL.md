---
name: uniform-enrichment-recommendations
description: >-
  Add personalized, relevance-ranked content recommendations to a Uniform +
  React/Next.js project by boosting Content API results with Uniform Context
  enrichment scores. Use when a user wants visitor-personalized recommendations,
  dynamic product/article/promotion lists ranked by interest, enrichment-based
  content ranking, or mentions enrichment boosting, boost orderBy, or the `ufvd`
  cookie with Uniform.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform Enrichment-Boosted Recommendations

Add a feature that re-ranks a Uniform Content API query by the current visitor's
**enrichment scores** (their interest profile from Uniform Context), so each
visitor sees the same content pool ordered by what is most relevant to them.
Works for any content type (products, articles, promotions, events, ...).

## How it works (read first)

1. Uniform Context accumulates visitor **enrichment scores** in the `ufvd`
   cookie, keyed `<categoryId>_<value>` → number (e.g. `int_internet: 50`).
2. On the server, those scores are converted into a Content API **boost clause**
   passed to `orderBy`: `boost|fields.<field>:<value>:<weight>`.
3. `EntryDeliveryClient.list({ orderBy: [clause] })` re-ranks the result set.
4. No scores → no clause → graceful fallback to default ordering.

**Critical alignment rule:** the enrichment value's suffix (after the first
`_`) must equal the value stored in the content field you boost on. Enrichment
`int_internet` only boosts entries whose target field holds `internet`. If they
don't match, nothing re-ranks. Validate this before writing code.

For the full conceptual reference, terminology, and troubleshooting, read
[references/reference.md](references/reference.md).

## Prerequisites — verify before implementing

Stop and confirm each. If one is missing, set it up or tell the user it's
required first.

- [ ] **Uniform Context available.** `@uniformdev/context` provides the scoring
      engine. In Next.js App Router it ships bundled with
      `@uniformdev/next-app-router` and the tracker/provider is wired by the SDK
      (e.g. `UniformComposition` + `clientContextComponent`), so a separate
      `@uniformdev/context` install or hand-rolled `<UniformContext>` is **not**
      required — do not flag the feature as broken just because you can't find one.
      The server-side boost reads the `ufvd` cookie directly and falls back to
      default ordering when no scores are present, so the component works
      regardless. (Live per-visitor re-ranking still needs scores to actually
      accumulate — see the score-growth note below.)
- [ ] **Content client deps available** (`@uniformdev/canvas`).
- [ ] **API key + project ID** in env (commonly `UNIFORM_API_KEY`,
      `UNIFORM_PROJECT_ID`) with read-entries permission.
- [ ] **A target content type** exists with a field whose values can match
      enrichment value suffixes (the alignment rule above).
- [ ] Detect the framework (Next.js App Router vs Pages vs other React). The
      cookie read differs; templates assume Next.js App Router (`cookies()` from
      `next/headers`). Adapt for other setups.

## Workflow

Copy this checklist and track progress:

```
- [ ] Step 1: Confirm prerequisites + detect framework/conventions
- [ ] Step 2: Confirm enrichment categories + content field alignment in Uniform
- [ ] Step 3: Add the three frontend layers (helpers, score reader, fetch)
- [ ] Step 4: Build/render the component (async server component or Suspense)
- [ ] Step 5: Register the Uniform component definition + component pattern (MCP)
- [ ] Step 6: Wire boostEnrichments param, then verify re-ranking
```

### Step 1 — Confirm prerequisites and conventions

Run the prerequisite checklist. Inspect the repo to match its conventions:
where utilities live (e.g. `src/utils`), how Uniform components are registered
(the component resolver/mapping), and the cookie/SSR approach. Reuse existing
patterns; do not introduce a new structure.

### Step 2 — Confirm enrichments and content alignment in Uniform

Use the **Uniform MCP tools** (never edit `uniform-data` YAML/JSON directly) to:

- `getOptimizationData` — list enrichment categories and value public IDs.
- Inspect the target content type's fields (`getDefinition`/`searchEntries`).

Confirm the alignment rule for each enrichment you intend to use: enrichment
value suffix == stored content field value. If enrichments don't exist yet,
create them (`mutateEnrichment`) and tell the user content must be tagged so
scores actually accumulate (see references/reference.md §"make scores grow").

### Step 3 — Add the three frontend layers

Adapt the templates in `templates/` to the project's paths, naming, and content
type. Keep names generic unless the user specifies otherwise.

1. `templates/search.ts` — pure helpers (`getEnrichmentAndFieldKey`,
   `getEnrichmentKeysWithScore`, `getOrderByClause`). No I/O.
2. `templates/getEnrichmentBoostedOrderBy.ts` — reads `ufvd` from the request
   cookie via `CookieTransitionDataStore`, builds the boost map, returns the
   `orderBy` clause (or `undefined`).
3. `templates/getRecommendations.ts` — calls the Content API with
   `orderBy: [clause]`, filtered to a single content type.

### Step 4 — Build and render the component

Use `templates/RecommendationsServerComponent.tsx`. Because the fetch is async
and per-visitor, render as an async server component, or wrap in `<Suspense>`
with a skeleton so it doesn't block first paint. Map raw entries to your card UI.

### Step 5 — Register the Uniform component (MCP)

Use the Uniform MCP tools to create the component definition and a component
pattern (follow project rules: always create a pattern, allow overridability,
configure new slots with `allowAllComponents=true`). Parameters:

- `contentType` (select) — one option per recommendable content type.
- `boostEnrichments` (multi-select) — each option value is
  `"<enrichmentCategoryId>,<contentFieldId>"`, e.g. `"int,category"`.
- `maxRecommendations` (number).
- presentation params + a title slot as needed.

Then register the code component in the project's component resolver/mapping and
run `npm run uniform:pull` (or `pnpm`) to sync serialized data to disk.

### Step 6 — Wire params and verify

Pass `boostEnrichments`, `contentType`, `maxRecommendations` from the Uniform
component into `getRecommendations`. Then verify (see references/reference.md §Verifying):
simulate a visitor profile, log the generated `orderBy`, confirm matching
entries move to the top, change the profile, confirm ordering changes.

## Guardrails

- Use `orderBy` boost, not `filters`, so visitors still see a full set, just
  re-ranked. Use `filters` only to hard-exclude.
- The score reader must run server-side (it reads cookies). In Next.js App
  Router use `'use server'` + `cookies()`; elsewhere pass the cookie explicitly.
- Enrichment value public IDs: `<categoryId>_<value>` with no extra underscores
  (the parser keeps only the segment after the first `_`).
- Never hand-edit Uniform `uniform-data` files; use MCP, then `uniform:pull`.
- Always create a code component for the Uniform component definition (incl.
  matching slots) or the visual editor preview breaks.
