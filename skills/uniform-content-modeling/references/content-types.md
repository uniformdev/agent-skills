# Content type design

Default: model domain objects (article, product, person, location, FAQ) as content types; model page structure and visual configuration as components. If data isn't reused, queried independently, or multi-channel, it probably belongs in the experience layer rather than its own type.

## Content type vs block type

A block type defines a repeatable structure that lives **inside** a parent entry (specs rows, opening hours, an SEO field group). Blocks share the parent's lifecycle, cannot be referenced from other entries, and cannot be filtered or queried independently. Default to a content type; use a block type only when the data is meaningless outside its parent or when you want to reuse a field *schema* (not field *values*) across several content types.

## Naming and public IDs

Public IDs are camelCase and **immutable after creation** — decide them deliberately (`seoTitle`, not `field1`), keep them consistent across types (if "Article" has `summary`, "Case study" should too, not `abstract`), and give related fields a shared prefix (`seoTitle`, `seoDescription`) so API consumers can project them with a wildcard (`seo*`).

## Display name and thumbnail

- Set the display name (`entryName`) to the one text field that best identifies an entry in lists — usually the title. Make that field required; entries without it are unidentifiable in the dashboard and in search results.
- Set the thumbnail field on types with a primary image. It makes entry lists scannable.

## Slug strategy

Slugs identify entries in URLs and delivery API filters.

- Default slug uniqueness to **within the type** — global uniqueness creates cross-team collisions unless types genuinely share a URL namespace. Enable and require slugs for routable types or types referenced by slug; leave them optional/disabled for embed-only types (FAQ items, testimonials).
- Add a regex validation (e.g. `^[a-z0-9]+(?:-[a-z0-9]+)*$`) with a message — the API does not normalize slugs.
- Slugs identify the *entry*; the project map owns the *URL structure*. Don't encode folder paths into slugs — compose URLs from project map nodes plus the slug as the last path segment.

## Validation philosophy

Put stricter validation on content types than components: components stay loose for authoring speed, but content types feed many experiences and channels, so bad data multiplies.

- **Require** the display name field and any field every consumer depends on. Leave genuinely optional fields optional — required-everything trains authors to enter junk.
- **Restrict reference fields to allowed content types, always** — an unrestricted reference lets authors link anything and makes the content difficult to render and audit.
- **Constrain editors**: restrict rich text controls to what every consuming channel can render, not just the web; restrict link and asset fields to expected types.

## Field-level AI guidance

Guidance is the field-level instruction Scout and AI quick edits use when generating values. Write it on every field AI will populate:

- 1–2 sentences stating format, length, and intent: "Meta description optimized for search engines, 150–160 characters, clearly communicating the page's value to encourage clicks."
- Encode constraints validation can't express: tone, point of view, what to avoid ("No marketing superlatives; cite the product's measurable benefit").
- Guidance is for AI; help text is for human editors. A field can need one, both, or neither.

Type-level intent (what the type is for, how entries are used) belongs in the content type description — it also serves as AI guidance when agents decide which type to use.
