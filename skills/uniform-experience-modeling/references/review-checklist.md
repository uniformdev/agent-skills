# Component library review

Audit workflow for reviewing an existing Uniform component library against experience-modeling best practices.

## Workflow

1. **Fetch component definitions.** Use the Uniform MCP tools (or the Canvas API / CLI) to retrieve all component definitions, including parameters, slots, and variants. Fetch component patterns as well — several checks need them.
2. **Fetch context where available.** If the codebase is accessible, locate the corresponding code components to verify prop alignment. If content types exist, note them for content-specific component checks. For granularity checks, sample actual compositions — not just definitions and patterns — to detect repeated manual assemblies and unused atomic components.
3. **Evaluate each component** against the checklist below.
4. **Report findings grouped by severity**, with the component and parameter/slot affected, the violated practice, and a concrete fix suggestion. Note that some fixes (e.g. changing a public ID, converting a block to a slot) require recreating the parameter or component and migrating content — call that cost out.

Suggested severity levels:

- **High** — hurts editors or blocks optimization now: slots with the allow-all-components toggle enabled, blocks holding visual child components, missing required parameter on a broken-without-it component, JSON parameters exposed to authors.
- **Medium** — friction or maintenance risk: prop/ID mismatches requiring mapping code, missing guidance on AI-edited components, over-validation, near-duplicate components, enumerated numbered parameters representing repetition.
- **Low** — polish: missing icons/categories/preview images, suboptimal editor controls, missing display names.

## Checklist

### Component definition

- [ ] Name is non-technical, title-cased prose; not named after placeholder content; no "Component" suffix
- [ ] Public ID is camelCase and corresponds to the code component
- [ ] Icon, category, and preview image are set; component isn't in "Uncategorized"
- [ ] Description exists and explains purpose and usage (it doubles as AI guidance)
- [ ] No near-duplicate components that differ only in visual treatment (should be display variants of one component or component patterns); a deliberate simple-parameters vs flexible-slots pair for one code component is acceptable (see slots vs parameter groups)
- [ ] Content-specific components (e.g. "Recipe Card") are justified by behavior/state or core-domain status — otherwise should be a pattern on an agnostic base component

### Parameters

- [ ] Names are editor-friendly; public IDs match the corresponding code component props
- [ ] No enumerated/numbered parameters representing repetition (`Category Tag 1/2/3`, `Feature Title 1/2`) where the count varies, items need reordering, or the values are a list/taxonomy — prefer a single multi-value parameter, a link to a content type, a slot, or a block (a small, genuinely fixed count kept for simplicity is acceptable)
- [ ] Parameter types match prop types (no avoidable mapping logic)
- [ ] No legacy Image URL parameters (use asset)
- [ ] Help text only where the purpose isn't obvious; max 1 short sentence
- [ ] Guidance set on parameters where AI generates or edits content
- [ ] `localizable` enabled only on content-focused parameters or locale-dependent display settings
- [ ] Related parameters are grouped; optional/advanced groups collapsed by default
- [ ] Editor controls fit the parameter (radio/segmented for few visible options, slider for ranges, checkboxes for short multi-select lists, labeled switch/segmented for booleans)
- [ ] Validations limited to essential parameters; regex validations have messages
- [ ] `Use as display name` set on exactly one representative parameter, or on none if no good candidate exists; `Use as thumbnail` considered for image-led components

### Slots

- [ ] No slot allows all components; allowed components/patterns are deliberately restricted
- [ ] `$personalization` / `$test` allowed in slots whose content should be optimizable
- [ ] Loop component allowed in slots expected to render dynamic lists
- [ ] Min/max counts only where the layout or a deliberate design constraint requires them
- [ ] No blocks holding visual child components (should be slots); block parameters only for non-visual structured data or custom-rendered data arrays
- [ ] Nesting depth stays within 2–3 levels
- [ ] Layout-critical slots have `emptyPlaceholder` implemented in code

### Granularity

- [ ] Layout components (Grid, Tabs, columns) are distinct from content components and categorized accordingly
- [ ] No slots that allow many atomic/layout components without pre-composed patterns offered alongside them (editors forced to assemble common sections from scratch)
- [ ] No multi-component assembly repeated across compositions that should be a component pattern
- [ ] No pre-composed components duplicating what an existing pattern already provides
- [ ] Shared organisms (header, footer) are component patterns, not copies repeated per composition

### Patterns and reuse

See [patterns](patterns.md) for the underlying guidance.

- [ ] Recurring preconfigured child setups are available as component patterns (reduces slot authoring friction)
- [ ] Content type + component combinations use patterns with data resources and dynamic tokens instead of dedicated component definitions
- [ ] Override settings are deliberate: parameters that must stay consistent are locked; no pattern where authors override nearly everything on most instances (should be a plain component or connected to data)
- [ ] No fully locked pattern still containing placeholder copy (every instance renders the placeholder)
- [ ] Slot sections restrict allowed components and min/max counts; none placed inside A/B Test, Personalization, or Localization containers
- [ ] In multi-locale projects, patterns have all locales enabled that their consuming compositions have enabled
- [ ] Parameters whose value is only dynamic tokens are not localizable (the data resource delivers the translated value)

Static patterns (no data resource or dynamic tokens) are a valid modeling choice for reusing fixed content, even when a matching content type exists — only suggest connecting to data when instances are evidently meant to show different content per instance. Pattern data resource changes can't be made by agents — report them as human follow-ups.

## Report format

For each finding:

```text
[High] Hero > slot "content": allows all components
  Fix: restrict to Heading, Rich Text, Button; add $personalization if hero content is personalized.

[Medium] Card > parameter "img_url": image URL type (legacy)
  Fix: add an asset parameter restricted to images; migrate content; remove the legacy parameter.
  Note: public IDs can't be renamed — the replacement parameter needs a new ID and code changes.
```

End the report with a summary table of findings per severity and a suggested remediation order (high-severity, low-migration-cost items first).
