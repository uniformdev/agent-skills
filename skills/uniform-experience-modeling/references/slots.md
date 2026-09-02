# Slot design

Slots are named areas of a component that hold child components. In code terms, a slot maps to `children` or a child-component prop. Slots are for nested or repeated UI components; blocks are for data and content (see "Blocks vs slots" below).

How many components a slot allows follows from the project's granularity strategy — see [component granularity](component-granularity.md). For naming child components that live in slots, see [component naming](component-naming.md).

## Single vs multiple slots

How many components a slot allows is separate from how many slots a component has. **Default to a single slot** — it keeps authoring simple and flexible and lets authors order children freely. Add slots when the layout renders regions in fixed, distinct positions, or when governance requires guaranteeing specific content in a specific position (see [Slots as governance](#slots-as-governance) below).

The deciding test: **does which slot a child sits in determine where or how it renders?**

- **One author-ordered flow → single slot.** A `Section` whose children stack in author-chosen order needs only a single slot.
- **Fixed regions in distinct positions → one slot per region.** A `Card` with a header and footer, or a two-column layout, renders each region separately in code, so each region is its own slot. Regions that differ in allowed components or count constraints also belong in separate slots.

## Slots as governance

Beyond layout, multiple slots are a **governance and consistency** tool: they let you enforce that certain content always appears in a specific position. A landing page that should always open with a hero can model a dedicated `hero` slot (with a min count and a tight allowed-components list) separate from its main slot — the structure guarantees the opener rather than relying on authors to remember it.

Combined with patterns, slots give you adjustable editorial guardrails:

- **Pattern overrides** lock down a pattern's preconfigured children so authors can tweak allowed fields but can't restructure the layout — consistency by default.
- **Slot sections in patterns** open a slot back up where flexibility is wanted, letting authors add their own children alongside the pattern's locked content.

Use this to tune how much freedom each slot gives: lock the slots that protect brand or layout consistency, open the slots where authors need room to compose.

## Slot naming

A slot name should describe the slot's **structural role** — where its children render or how they behave — rather than the content that happens to fill it.

### How to choose a slot name

1. **Name the slot's structural job**, then map it to a name — reuse the term the design system or code already uses if one exists, otherwise draw from the palette below.
2. **Drop any parent prefix** (the slot is already scoped to its parent): `content`, not `sectionContent`.
3. **Run the litmus test:** *if this slot held completely different children, would the name still make sense?* If it only fits today's content (`teamMembers`, `blogPosts`), use the structural equivalent (`items`, `content`).

#### Common slot names

A non-exhaustive palette, not an approved list — pick a clearer name when the role calls for one:

| Slot name | Structural role |
|-----------|---------|
| `content` | Generic free-content flow (single, author-ordered) |
| `items` | Multiple same-type children (accordion items, carousel items) |
| `header` / `footer` | Structural top/bottom region |
| `media` / `aside` | A fixed region in a multi-region layout |
| `trigger` | Element that opens/activates the parent |

## Restrict allowed components

Avoid the allow-all-components toggle (`allowAllComponents: true`). It overwhelms editors with irrelevant choices and allows compositions the design system never intended. A long but explicit allow-list is acceptable — granular setups legitimately need wide lists; what to avoid is the toggle itself, not the length of the list.

For every slot:

1. **List only the components and component patterns that make sense** for that slot. A Hero's "CTAs" slot allows "Button" — not "Hero", "Accordion", or arbitrary layout components.
2. **Allow the built-in optimization components where optimization is expected.** If the slot's content should be personalized or A/B tested, add `$personalization` and/or `$test` to the allowed components. Without them, marketers cannot optimize the slot later.
3. **Allow the Loop component where children render dynamically.** If the slot is expected to render multiple children from a data resource (e.g. product variants, related articles), allow the Loop component.
4. **Decide pattern handling.** With `patternsInAllowedComponents: false`, any pattern based on an allowed component is allowed — the common, flexible default. Set it to `true` and list patterns explicitly (`$p:<pattern-id>`) only when you must lock the slot to specific curated patterns.

## Min and max counts

Set minimum/maximum component counts only when the layout or a deliberate design constraint requires it:

- A two-column layout component may require exactly 2 children in its columns slot.
- A "CTAs" slot might cap at 2 buttons to protect the design.
- Leave counts open everywhere else — unnecessary minimums block authors from saving work in progress.

If the layout breaks visually when a required slot is still empty during editing, implement an `emptyPlaceholder` on `UniformSlot` in code (see [component definitions](component-definitions.md)).

## Slots vs parameter groups

For nested code components (e.g. a CTA button inside a Hero), there are two modeling options:

| | Parameter group on parent | Slot with child components |
|---|---|---|
| Example | "CTA Button" group with link + link text parameters on Hero | "CTAs" slot allowing Button components |
| Authoring effort | Low — fields are right there | Higher — editor must place a component (or use a pattern) |
| Extensibility | Fixed — one button, fixed fields | Open — more buttons, different component definitions, patterns |
| Personalization / A/B testing | Not possible per nested element | Possible (`$personalization`, `$test` in the slot) |
| Reuse via patterns | Only with the whole parent | Child components/patterns reusable independently |
| Code mapping | Props on the parent code component | Children rendered via `UniformSlot` |

Guidance:

- **Default to a slot when requirements are unclear** — it keeps options open. Restrict the allowed components and patterns tightly.
- **Use a parameter group when simplicity wins**: the nested element is always present, always singular, and will never need independent optimization or extension.
- **Offset slot authoring friction with patterns**: provide component patterns with preconfigured, overridable children (e.g. a "Hero with CTA" pattern) so editors don't assemble from scratch.
- **Two definitions for one code component is legitimate** in some cases: a simple definition with grouped parameters for everyday use, and a flexible definition with slots for advanced scenarios. Use sparingly — every extra definition adds catalog noise.

## Composition parameters vs content slots

Composition definitions share the same structure as components (parameters + slots), so the parameter-vs-slot decision applies at the page level too:

- **Reserve composition parameters for global, page-level data that never needs personalization or reuse** — page-level OpenGraph/SEO metadata that describes the whole page, canonical URL, page-level feature flags. These describe the page as a whole, not its visible experience. Structured data scoped to a specific component (e.g. schema.org for a Product or Recipe) belongs in a block on that component instead — see Blocks vs slots below.
- **Put experience content in components placed in the composition's content slot**, not in composition parameters. A hero's headline belongs to a Hero component in the slot — where it can be personalized, A/B tested, reordered, and reused — not to a `heroTitle` parameter on the composition.

A good test: if an author would ever want to optimize, move, or reuse the value, it belongs in a component in a slot, not on the composition.

## Blocks vs slots

Blocks model repeatable sets of fields inside a component or entry; they are data/content focused, while slots are for nested or repeated UI components. **On components, avoid blocks and use slots instead.**

Slots are preferable because components placed in slots:

- render automatically without custom block-rendering code using the `UniformSlot` component,
- can be personalized and A/B tested,
- support visibility conditions,
- can be overridden per pattern instance (block parameters cannot be overridden in patterns),
- can be added to via slot sections in patterns.

Legitimate exceptions where a block parameter on a component is acceptable:

- **Non-visual structured data scoped to a specific component** — metadata or configuration options that no visual component represents, attached to one component (e.g. schema.org structured data for that component). Page-level SEO/Open Graph that describes the whole page belongs in composition parameters instead — see Composition parameters vs content slots above.
- **Arrays of structured data with custom rendering** — the component implements rendering logic that slots cannot express (e.g. chart data points). Loops can connect a block field to an array from a data resource (enable the Loop component in the block field's allowed types).

| Use case | Slot | Block | Parameter group |
|----------|------|-------|-----------------|
| Repeatable visual child components (cards, buttons, accordion items) | yes | no | no |
| Non-visual repeatable structured data (metadata, config arrays) | no | yes | no |
| Single, fixed set of related fields, no repetition | no | no | yes |
| Children that need personalization, A/B testing, or visibility rules | yes | no | no |

See the [blocks guide](https://docs.uniform.app/docs/guides/models/blocks) for full details, including block usage on content types (where blocks are the right tool for repeatable owned content).

## Avoid enumerating repetition as numbered parameters

Don't represent a repeatable thing as a fixed series of numbered parameters (`Category Tag 1` / `Category Tag 2` / `Category Tag 3`) — common in AI-generated definitions. It caps the count, can't be reordered, and forfeits personalization, A/B testing, and Loop-driven dynamic data population. A trailing number on a repeated field is the smell.

Model the repetition explicitly:

- **Slot** (most flexible, usually right) — allow a small, restricted subset of components, often one (a `Tag` component). Keeps the count open and children reorderable, personalizable, A/B testable, and Loop-drivable.
- **Multi select parameter** — for simple lists of scalar values the component just renders (`Category Tags`), or a parameter linking to a content type when the values are managed content.
- **Block** — for repeatable non-visual structured data (see the [Blocks vs slots](#blocks-vs-slots) table above).

A small, genuinely fixed count kept as numbered parameters for simplicity is acceptable; a fixed set of *distinct* fields (a CTA's link + link text) is a parameter group, not repetition.
