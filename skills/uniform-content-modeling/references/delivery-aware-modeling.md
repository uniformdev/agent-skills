# Delivery-aware modeling

Entries are consumed through the Edge Delivery API, whose filtering, projection, and resolution capabilities are constrained by field type. Decide query requirements before choosing field types — this is the canonical reference for those constraints.

## Filterable vs non-filterable field types

| Filterable | Not filterable |
|------------|----------------|
| Text | Blocks |
| Rich text (first 10,000 characters) | Asset |
| Number | Image URL |
| Date, Date/Time | JSON |
| Single select, Multi select | Link |
| Boolean (checkbox) | |
| References (limited — see below) | |

**Never put data you filter or sort on into a non-filterable field type.** Classification buried in a block or a flag inside a JSON field is invisible to queries — use a select or checkbox instead.

## Reference filtering is shallow

Filtering on a reference field matches only the **referenced entry's id, slug, and name** — never its custom fields, and never references-of-references (no nested reference filtering). Consequences:

- Give classification and shared reference types stable, meaningful slugs; the slug is the filter key: `filters.fields.category.slug[eq]=recipes`.
- To filter parents by an *attribute* of a referenced entry (e.g. "articles whose author is an employee"), denormalize the attribute onto the parent (typically a select kept in sync editorially) or run the query in two steps.

## Cross-type queries

Filtering and sorting on custom fields requires the query to be scoped to a **single content type**. Giving two types the same field public ID does not enable filtering across both in one query. If a unified list across types is a requirement (one "news" feed from Article + Press release), either merge them into one type with a classification select, or accept per-type queries merged in the frontend.

## Resolution depth and payload budgeting

This is the canonical reference for resolution depth.

- References resolve to depth 0–3; default 1. Design entries so a typical detail view works at depth 1 and a list view at depth 0–1; entries beyond the depth come back as stubs. If a view regularly needs depth 3, flatten the model.
- Use projections to keep list payloads small: `select.fields[only]=title,shortTitle,slug` to whitelist, `select.fieldTypes[except]=richText` to drop heavy bodies. Projections recurse into resolved references and blocks.
- Wildcard projection rewards prefix naming: fields named `seoTitle`, `seoDescription` can be selected together with `select.fields[only]=seo*`.
- `select.fields[locales]` returns per-locale value maps for chosen fields — model localized slugs and SEO fields knowing hreflang/alternate generation can pull all locales in one query.

## Sizing context

Entry list queries return at most 1,000 entries per request (default 100) with offset pagination, ordering on filterable fields, and free-text search. For high-volume types, filterable classification and date fields are what make large collections navigable.

## Pre-flight checklist for a new type

Before finalizing fields, list the list pages and feeds that will consume the type and make every filter/sort they need a filterable field directly on the type; confirm the card/list rendering projects without rich text or deep references; and check what the detail view needs at depth 1 and what hreflang/SEO tooling needs across all locales.
