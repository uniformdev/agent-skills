---
name: uniform-content-modeling
description: Best practices for content modeling in Uniform — designing content types with well-chosen fields, validations, and naming, deciding what belongs in structured content vs the experience layer, modeling content classification (categories, tags, taxonomies), modeling relationships between entries with references, designing content for discoverability across search and answer engines and multi-channel delivery, and organizing entries for reuse and localization. Use when creating or updating Uniform content types or entries, migrating structured content from another CMS into Uniform, or reviewing an existing content model for best-practice violations.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform content modeling

Content modeling defines display-agnostic content types and the entries created from them. Experience modeling defines how content is displayed and composed via component definitions and patterns. Keep the two separate: this skill is about building content models that are reusable across presentations and channels.

## Key principles

### Model content, not presentation

Display concerns (layout, styling, variants) belong in component definitions and patterns, not content types.

### Model classification once, deliberately

Classify with select fields or references to a classification content type — never free text. Pick one mechanism per classification and reuse it across types.

### Model for findability

Fields you filter or sort on must use filterable field types. Blocks, asset, image URL, JSON, and link fields cannot be filtered by the Edge Delivery API — decide query requirements before choosing field types.

### Borrow from Schema.org

Use Schema.org types as field checklists, model explicit fields, and let the frontend serialize JSON-LD. Only store raw JSON-LD when a Mesh integration or AI agent like Scout computes it.

## Gotchas

Uniform facts that defy reasonable assumptions — know these before changing a model:

- **Field public IDs are immutable after creation.** A rename means a new field plus content migration, so decide IDs deliberately and keep them consistent across types.
- **A reference field's single/multi choice cannot be changed after setup.** Default to a multi reference with plural naming and a `max: 1` validation; relaxing a max later is a validation change, switching single → multi is a re-model.
- **Filtering on a reference field matches only the referenced entry's id, slug, and name** — never its custom fields. Slugs on referenced types are the filter key.
- **Block fields cannot be filtered and cannot be marked overridable in entry patterns.** Keep queryable or per-entry-variable data out of blocks.
- **The native entry slug field is not localizable.** Localized URL paths need a custom localizable text field driving routing.
- **Changing or removing a select option value does not update existing entries.** Treat vocabulary changes as content migrations.

## Resources

Read the reference file for the task at hand:
- [Content types](references/content-types.md) — read when creating or updating a content type or block type: naming, public IDs, slugs, display name, validation philosophy, field-level AI guidance
- [Entries](references/entries.md) — read when organizing entries at scale, choosing a reuse mechanism (reference vs block vs entry pattern), using entry patterns, or planning localization
- [Relationships](references/relationships.md) — read before adding a reference field or designing shared types (Author, Brand, Category): reference vs embed, cardinality, graph hygiene, publishing behavior
- [Content classification](references/content-classification.md) — read when modeling categories, tags, or taxonomies: select vs reference decision, hierarchies, anti-patterns, enrichments vs content classification
- [SEO and multi-channel](references/seo-and-multichannel.md) — read when modeling SEO/OpenGraph fields, structured data, or content for answer engines and non-web channels
- [Delivery-aware modeling](references/delivery-aware-modeling.md) — read before choosing field types for any type that will be filtered, sorted, or listed: filterability, projection, resolution depth
- [Review checklist](references/review-checklist.md) — read when asked to audit or review an existing content model: workflow, per-type checklist, report format
