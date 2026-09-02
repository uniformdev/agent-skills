# Patterns

How and when to use [component patterns](https://docs.uniform.app/docs/guides/patterns/component-patterns) and [composition patterns](https://docs.uniform.app/docs/guides/patterns/composition-patterns) and their related features — overrides, pattern data resources, slot sections — plus localization and edition strategy. Entry patterns are out of scope here (they belong to content modeling). For feature mechanics, see the [patterns documentation](https://docs.uniform.app/docs/guides/patterns).

**Agent capabilities.** AI tooling (Uniform MCP, Scout) can create and edit patterns, set parameter values and override settings, fill slot sections on pattern instances, and enable locales. It cannot create or change data sources, data types, or data resources, convert a component to a pattern, or unlink a pattern — treat those as recommendations for a human to execute.

## Choosing the pattern strategy

A pattern serves one or more of three intents, which can be combined in a single pattern:

| Intent | Examples | Typical configuration |
|--------|----------|-----------------------|
| Shared exact content (static) | Global header, promotional banner with finalized copy, legal disclaimer | No data resource; few or no overrides |
| Reusable configuration preset | "Hero with CTA" starting point with preset design settings and structure | Overridable parameters with default values |
| Connected to data | "Product Card" connecting entry fields to a generic Card's parameters | Pattern data resource + dynamic tokens; per-instance selection |

Static vs connected to data is a deliberate choice: static patterns are valid even when a matching content type exists. Connect the pattern to data when each instance should display different content; keep it static when the content is intentionally identical everywhere.

Use a component pattern for a reusable building block placed in slots across compositions; use a composition pattern when whole pages share a centrally managed structure that editors create compositions from.

## Designing overrides

Override settings are the governance dial of a pattern: a locked parameter is a consistency guarantee, an overridable parameter is a starting-point default.

- Decide overridability per parameter deliberately. Lock what must stay consistent (brand copy, design settings); open only what instances legitimately vary.
- Enable "Hide read-only parameters" so authors only see what they can change.
- Audit signals: a pattern where authors override nearly every parameter on most instances is not really shared content — it should be a plain component, or a pattern connected to data (data resource changes are a human task). Conversely, a fully locked pattern still containing placeholder copy is unfinished: every instance renders the placeholder.

## Auditing pattern data resources

Agents cannot change data resources, so evaluate existing setups and recommend changes as human follow-ups. The override configuration of each pattern data resource should match its intent:

| Configuration | Fits when |
|---------------|-----------|
| Overridable, with default | General case — instances pick their own content, and the default keeps the pattern preview functional |
| Overridable, selection required (no default) | An explicit per-instance choice matters and a default risks shipping wrong content |
| Static (not overridable) | Every instance must reference the same content, e.g. legal copy sourced from a CMS |
| Optional | Enrichment data that only some instances need |

Prefer patterns whenever components consume external data: authors pick content visually on the pattern instance instead of navigating JSON to map values.

## Slot sections

Slot sections reserve the places where pattern instances may add components; everything else in a pattern's slots is fixed.

- Add a slot section only where instances legitimately need extra content: generic container patterns (e.g. a two-column section with empty sections) or fixed children plus an extensible area (e.g. a product accordion allowing custom items).
- Restrict every slot section deliberately: allowed components/patterns and min/max counts, like any slot.
- Name slot sections by purpose ("Custom items", "Regional content") so authors know what belongs there.
- Known limitation: slot sections placed inside A/B Test, Personalization, or Localization containers are not supported. Placing those containers *inside* a slot section is fine if allowed.

## Patterns and editions

[Editions](https://docs.uniform.app/docs/guides/composition/editions) are independent versions of a composition for markets or campaigns. The key principle: use composition patterns plus slot sections to balance consistency and edition-specific flexibility — shared, centrally translated components live in the pattern, and slot sections mark where edition-specific content goes.

- Keep editions limited to content that is unique to that edition; everything shared belongs in patterns.
- Patterns themselves have no editions, and publishing a pattern change rolls it out across all editions at once.

## Localization

- Centralize shared translations in patterns: enable locales on the pattern and translate its content once; all instances (and editions) inherit the translations.
- Enabling a locale on a pattern has no effect until the pattern is used on a composition with that locale enabled. In multi-locale projects, enable all locales on a pattern that its consuming compositions have enabled.
- Pattern data resources can have per-locale values and data mappings (e.g. locale-driven entry selection). Evaluate these during audits; setting them up is a human task.
- Parameters whose value consists only of dynamic tokens should not be localizable — the translated value is delivered by the connected data resource.

## Lifecycle and governance

- Editing and publishing a pattern affects every instance. Check the pattern's usages before unpublishing or deleting it — published compositions referencing a missing pattern break.
- Unlinking a pattern forks an independent copy for one-off divergence; agents cannot unlink, so recommend it as a human action when an instance has outgrown its pattern.
