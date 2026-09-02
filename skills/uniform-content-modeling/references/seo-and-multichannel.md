# SEO, answer engines, and multi-channel

Search engines, answer engines, AI agents, and non-web channels consume the same entries. The generic modeling (split title/SEO/short/summary fields with channel-appropriate length limits, plain-text summaries for non-web surfaces, channel-agnostic field naming) applies here as it does anywhere — these are the Uniform-specific points it doesn't cover.

## Shared SEO/OG block type

Model the recurring SEO/OpenGraph field group once as a block type — `seoTitle`, `metaDescription`, `ogTitle`, `ogDescription`, `ogImage` (asset, image only) — and embed it as a block field on every routable type. This reuses the *schema* (one definition, consistent public IDs) while each entry owns its *values*. Two Uniform caveats to design around:

- Block fields **can't be filtered**, so keep any value you query on out of the block.
- Block fields **can't be overridden in entry patterns**.

State length limits in each field's AI guidance so Scout generates compliant values (e.g. "Meta description, 150–160 characters, communicates the page's value to encourage clicks").

## Schema.org and JSON-LD

Use the relevant Schema.org type as a field checklist, model each property you'll emit as an **explicit field** (or reference: `author` → Author entry, `brand` → Brand entry), and let the **frontend serialize JSON-LD** from those fields.

- Never store raw JSON-LD in a JSON field — it duplicates content, drifts from the source fields, and authors can't maintain it.
- Scout populates modeled structured-data fields well, but it should never be asked to invent or store raw JSON-LD markup.
