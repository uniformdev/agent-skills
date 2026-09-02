# Content model review

Audit workflow for reviewing an existing Uniform content model against content-modeling best practices.

## Workflow

1. **Fetch the model.** Use the Uniform MCP tools (or the Canvas API / CLI) to list all content types and block types (`listDefinitions`), then fetch each definition in full (`getDefinition`) — fields, typeConfig, slug settings, display name and thumbnail fields. Fetch entry patterns too.
2. **Fetch context where available.** Sample entries from high-volume types to spot drift (free-text classification values, empty required-in-practice fields, near-duplicate classification terms). Note which list pages and queries the frontend runs, if the codebase is accessible.
3. **Evaluate each type** against the checklist below. Copy the checklist and track progress per type.
4. **Report findings grouped by severity**, with the type and field affected, the violated practice, and a concrete fix. Call out migration cost: public IDs and a reference field's single/multi choice can't be changed after creation, so fixes there mean a new field plus content migration.

Suggested severity levels:

- **High** — breaks consumers or queries now: filter/sort data in non-filterable field types (blocks, JSON, asset, link), classification as free text or blocks, unrestricted reference fields, missing required display name field, raw JSON-LD stored in entries.
- **Medium** — integrity and maintenance risk: missing AI guidance on AI-populated fields, missing char limits on SEO fields, inconsistent public IDs across types, reference chains exceeding depth 2, mirrored bidirectional relationships, junk-drawer types.
- **Low** — polish: missing thumbnail fields, missing slug regex, suboptimal localizable flags, naming convention drift.

## Checklist

### Type design

- [ ] Each type covers one domain concept; no junk-drawer type with mostly optional fields
- [ ] Type names are singular, author-facing nouns; descriptions explain purpose (doubles as AI guidance)
- [ ] Data embedded in components/compositions that is reused, queried, or multi-channel has been promoted to a content type — and vice versa, one-off page content isn't over-modeled as entries
- [ ] Block types used only for owned repeatable structure or schema reuse, never for shared/queryable content
- [ ] No presentation concerns in fields (layout, styling, variant, placement-named fields like `heroText`)

### Fields and validation

- [ ] Display name field set and required; thumbnail field set on image-led types
- [ ] Public IDs are camelCase, consistent across types (`summary` everywhere, not `abstract` in one type), with shared prefixes for related groups (`seo*`)
- [ ] Required only where every consumer breaks without the field
- [ ] SEO/title fields have character limits matching channel constraints; regex validations have messages
- [ ] Rich text controls restricted to what consuming channels render
- [ ] AI guidance present on fields Scout or AI quick edits will populate, stating format, length, intent
- [ ] `localizable` on content fields (text, assets, slugs where needed), not on dates, references, or classification values

### Classification

- [ ] Every classification uses select (fixed vocabulary) or a reference-backed term type (extensible, metadata, landing pages) — no free-text tags, no classification in blocks
- [ ] One mechanism per classification across all participating types
- [ ] Select option values are stable and machine-friendly; multi-selects and tag references have a max
- [ ] Term types have required, stable slugs (the delivery filter key)
- [ ] Hierarchies are child → parent only, ≤2 levels, no mirrored parent ↔ child references

### Relationships

- [ ] Every reference field restricts allowed content types
- [ ] Cardinality matches reality; multi-references have max where consumers render bounded lists
- [ ] Shared reference types (Author, Brand, Category…) are lean and leaf-like; no shared reference type referencing other shared reference types without need
- [ ] No reference chains that force resolution depth 3 for common views
- [ ] No mirrored relationships maintained on both sides; reverse lookups derived via queries

### Delivery readiness

- [ ] All filter/sort fields use filterable types directly on the type (not blocks, JSON, asset, link)
- [ ] No reliance on filtering custom fields of referenced entries (only id/slug/name work)
- [ ] Cross-type unified feeds are either one type with a classification select or knowingly merged client-side
- [ ] Routable types have slugs enabled, required, unique within type, with a format regex

### SEO and multi-channel

- [ ] Routable types carry SEO fields (ideally via a shared SEO/OG block type) and a plain-text summary/TL;DR
- [ ] Articles and similar types reference an Author shared reference type and carry explicit `datePublished`/`dateModified`
- [ ] FAQs are a content type attached via multi-reference, not blocks
- [ ] Structured data is modeled as explicit fields; no raw JSON-LD stored in entries

### Entries and patterns

- [ ] High-volume types have filterable fields so editors can slice the entry list
- [ ] Entry patterns used for presets, override governance, or external-data unification — not as a substitute for shared content (that's a reference)
- [ ] No per-entry-variable data inside pattern block fields (blocks aren't overridable)
- [ ] Sampled entries show no vocabulary drift (near-duplicate terms, inconsistent select usage)

## Report format

For each finding, give the type and field, the violated practice, and a concrete fix. Flag migration cost where it applies — public IDs and a reference field's single/multi choice can't be changed in place, so the fix is "add the new field, migrate values, then remove the old one". End with a summary of findings per severity and a remediation order (high-severity, low-migration-cost items first).
