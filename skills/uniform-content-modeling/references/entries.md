# Entries

## Organizing entries at scale

There are no folders — entries are grouped by content type, and the dashboard filters and searches within that grouping. So naming carries the organizational load (the display name field should produce names that sort and scan well: "2026 Q1 results", not "Results"), and high-volume types need filterable fields (select, date, references) so editors can slice the list — free-text search alone doesn't scale to thousands of entries. If a type accumulates entries serving clearly different purposes, that's a signal to split the type or add a classification field, not to fight the list view.

## Content reuse decision

Three mechanisms reuse content or structure; they are not interchangeable:

| Mechanism | What is reused | Use when | Don't use when |
|-----------|----------------|----------|----------------|
| **Reference field** | Content (the entry itself) | The same content appears in many places and is maintained once; the content has its own lifecycle and publish state | The data is meaningless outside one parent |
| **Block field** | Structure (field schema) | Repeatable rows owned by one entry (specs, opening hours); or the same field group embedded in several types (SEO block) | The content should be shared between entries, filtered, or published independently |
| **Entry pattern** | Defaults and bindings (a blueprint) | Pre-filling field values, override governance, or unifying external data into the entry shape | You want one shared piece of content — a pattern is a template, not content; editing it doesn't update entries already created from it the way a reference does |

Reference and block are the generic "maintain once" vs "same shape, different values" choice. Reach for an **entry pattern** when the requirement is "same starting values or same external-data wiring for new entries".

## Entry patterns

Entry patterns are blueprints for creating entries — they are not reusable entries themselves. Good uses:

- **Field presets**: default values and preconfigured field setups so authors start from a consistent baseline.
- **External data unification**: bind fields to external sources (PIM, legacy CMS, APIs) via pattern data resources and dynamic tokens, so entries combine local and external data behind one schema. External values are fetched at request time, not stored.
- **Override governance**: mark which fields authors may override on entries created from the pattern; locked fields stay centrally managed.

Constraints to design around:

- Block fields cannot be marked overridable — if per-entry variation is needed in a blocks area, keep that data in regular fields or references instead.
- Entry patterns must be published before entries can be created from them, and unpublishing a pattern breaks published entries based on it. Treat pattern publication as part of the model's lifecycle, not an afterthought.

## Localization strategy

Localization is per-field via the `localizable` flag, so model it deliberately. Localize display text, rich text, locale-specific assets, links to localized targets, and SEO fields; don't localize identifiers, factual dates, market-invariant numbers, classification select values, or references (unless markets genuinely reference different entries). For fields where most locales share a value, set the field to not-localized-by-default so authors opt in per entry instead of duplicating values.

The delivery API accepts a locale fallback chain (e.g. `en-US, en`), so missing localized values fall back instead of returning empty — model the chain, don't duplicate content across locales.

### Localized fields vs editions

- **Localized fields** (default): one entry, per-locale values on flagged fields. Use when all markets share the entry's structure and lifecycle.
- **Editions** (enterprise): independent versions of the same entry per market, each with its own structure, field values, and publish lifecycle. Use only when markets need structurally different content or independent publishing schedules — editions multiply maintenance cost.

Localized URLs: the native entry slug field is not localizable. When localized URL paths are required, add a custom slug field (a regular text field) flagged localizable and drive routing off that instead of the native slug.
