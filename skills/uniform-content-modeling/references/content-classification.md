# Content classification

Use a **select** for a fixed vocabulary of static labels; use a **reference to a classification content type** the moment terms need author extensibility, metadata, landing pages, hierarchy, or per-locale labels. Pick one mechanism per classification and reuse it across every type that participates.

Default to a select — it is the cheapest mechanism: no extra type, directly filterable, no resolution cost. Promote to a reference-backed classification only when those needs appear. Both can coexist in one model ("Content format" as a select, "Category" as a reference).

## Select fields (controlled vocabulary)

- Option **values** are what the API returns and what filters match — keep them stable, lowercase, hyphenated (`case-study`); option **text** is the author-facing label and can change freely.
- Changing or removing an option value does not update existing entries — treat vocabulary changes as content migrations.
- **Localization is a weak spot**: a select value is a single static text value, so the same term cannot carry per-locale labels. Mapping a value to a translated label is only possible with conditional values (Enterprise only), which adds configuration complexity and isn't easily reusable across types. If terms need translation, prefer a reference-backed classification where each term entry holds localized name and metadata natively.

## Reference-backed classification

Model a small term content type (e.g. "Category"): name (display name, required), slug (required, unique within type), short description, optional image. Then:

- Classify entries with a reference field restricted to that term type.
- Give terms stable slugs — delivery-API filtering on referenced entries matches only id, slug, and name, so the slug is the filter key (`filters.fields.category.slug[eq]=recipes`).
- The term entry doubles as the source for the term's landing page (title, intro copy, SEO fields) and translates like any other entry, so localized labels and metadata resolve per locale without conditional-value workarounds.

## Blocks and free text: anti-patterns for classification

Avoid block fields for author-driven classification: blocks can't be filtered, block values aren't shared between entries, and each parent gets its own copy of the term — the opposite of classification. Free-text classification fields ("Tags" as a text field) are the same anti-pattern (unfilterable in practice due to typos and casing drift). If a model relies on authors hand-picking classification through blocks or free text, flag it for migration to a select or reference.

The exception is blocks that carry array-like data mapped from an external system rather than authored in Uniform — for example an entry pattern that projects a product's categories from a PIM into a repeatable block. Here the block mirrors the source-of-truth structure, isn't author-maintained, and the external system already governs the vocabulary; treat it as data mapping, not classification. If you still need to filter or route on those terms inside Uniform, surface them additionally as a select or reference on the type.

## Hierarchy

Model hierarchy with a single optional **parent** reference on the term type (child → parent, never both directions). Keep hierarchies shallow — two levels covers most navigation, each level adds a resolution hop, and reference resolution maxes out at depth 3. If the hierarchy exists only for navigation (not classification semantics), flatten it: one term level plus the project map for navigation structure.

## Enrichments: visitor classification, not content classification

Enrichments are a Uniform Context classification too, but they classify the *visitor*, not the content. An enrichment is a categorized visitor score dimension (e.g. an "Interests" category with "Gaming", "Photography", "Audio" values); tagging an entry or component with an enrichment value and a strength score raises the viewing visitor's score for that dimension, which then feeds intents, audiences, and personalization.

So an enrichment tag on an entry describes the *visitor interest the content signals*, not the entry's own category or topic. Keep the two separate:

- Use content classification (selects, reference-backed term types) to organize, filter, and route content.
- Use enrichments to score visitors for personalization — don't repurpose them to classify content, and don't expect content classification fields to drive personalization on their own.

The two can mirror each other (a "Photography" category term and a "Photography" enrichment value), but they are different machinery: one is the entry's own classification, the other is input to visitor scoring.
