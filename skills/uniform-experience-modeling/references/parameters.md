# Parameter design

Parameters are the elements that make up a component, such as a title, image, or alignment setting. They become component props when a composition is rendered. Well-designed parameters reduce mapping code, improve authoring UX, and make AI-assisted editing (Scout, AI quick edits) more reliable.

## Naming and public IDs

- **Name** is editor-facing: non-technical, title-cased prose that an author understands without developer context. "Headline" not `headlineText`, "Call to Action Link" not "CTA href".
- **Public ID** is developer-facing: camelCase, derived from the name, and ideally identical to the corresponding prop of the code component (e.g. prop `imageAlt` → public ID `imageAlt`). Matching IDs let you spread parameter values onto props without mapping logic.
- Public IDs **cannot be changed after creation**. Decide them deliberately before saving, especially when the name and the prop name differ.
- Don't name parameters after placeholder content. `<h1>Hello</h1>` means the parameter is "Headline", not "Hello".
- Avoid enumerating repetition with numbered names (`Category Tag 1`, `Category Tag 2`, …). A trailing number on a repeated field is usually a smell — prefer a single multi-value parameter, a link to a content type, a slot, or a block, unless a small fixed count is genuinely simpler. See [avoid enumerating repetition as numbered parameters](slots.md#avoid-enumerating-repetition-as-numbered-parameters).

## Type matching

Choose the parameter type that matches the prop type of the code component to avoid conversion logic:

| Code component prop | Parameter type | Notes |
|---------------------|----------------|-------|
| `boolean` | Boolean | Configure switch label or segmented control labels |
| String union (`'left' \| 'center' \| 'right'`) | Single select | Option values should equal the union values |
| Subset of string values (`string[]`) | Multi select | Set min/max selections if the code expects bounds |
| `number` | Number | Set integer/decimal and min/max to match what the code accepts |
| URL, route, email, phone | Link | Restrict the allowed link types to what the component handles |
| Image, video, file | Asset | Restrict asset types (e.g. image only); set min/max asset count |
| Plain string | Text | Enable multi-line only if the component renders line breaks |
| Formatted copy | Rich text | Restrict allowed controls to what the component can render |
| `Date` / ISO string | Date or Date/Time | Use Date/Time only when time and timezone matter |

Not every prop needs a parameter — see [component definitions](component-definitions.md) on mapping from code.

### Types to avoid

- **Image URL** — legacy. Use the Asset parameter instead; it integrates with the Asset Library and external DAM sources.
- **JSON data** — authors struggle to edit raw JSON. Use it only as a last resort for developer-managed data, and always provide an expected JSON schema for validation.

## Help text vs guidance

These serve different audiences:

| Setting | Audience | When to use |
|---------|----------|-------------|
| Help text | Human editors | Only when the value or purpose isn't obvious from the name. Max 1 short sentence. Plain text, no markdown. |
| Guidance | Scout and AI quick edits | When AI needs to know the expected format, length, writing style, or constraints. Keep to 1–2 sentences. |

Examples:

- "Title" needs no help text. An image that must be 250x250px does: "Use a square image, at least 250x250px."
- Guidance on a "Headline" parameter: "Short, benefit-driven headline, max 8 words, no trailing punctuation."

Component-level AI intent belongs in the component description (see [component definitions](component-definitions.md)); parameter-level guidance is for value-specific instructions.

## Localization

Enable `localizable` only where localization makes sense:

- **Content-focused parameters** (text, rich text, assets with locale-specific imagery, links to localized pages) — usually localizable.
- **Display or formatting settings** — localizable only when different locales genuinely need different settings (e.g. text alignment for RTL languages, date format preferences).
- **Pure configuration** (variant selection, column count, feature toggles) — usually not localizable.

When enabling localization, set the default localization behavior (localized vs not localized) to the most common case; editors can change the behavior per instance.

## Grouping

- Group related parameters (e.g. all SEO/meta fields, all CTA fields) so editors get a scannable overview.
- Collapse optional or advanced groups by default (`Is collapsed by default?` is checked by default) so the primary content parameters stay prominent.
- Order parameters by editorial importance: primary content first, configuration after, advanced settings last.
- Grouping is purely visual — it doesn't change the API response, so it's safe to add or reorganize groups without code changes. Note that the group's public ID still counts toward parameter ID uniqueness.

## Parameter editors

Several parameter types support alternative editor controls and per-editor configuration. Pick the control that matches how authors think about the setting:

| Type | Editors | When to prefer the non-default |
|------|---------|--------------------------------|
| Single select | Select (default), radio buttons, segmented control, slider | Radio/segmented for 2–5 options that should be visible at a glance (alignment, size presets); slider for ordered scales (XS–XXL); icons for visual concepts like alignment |
| Multi select | Multi select dropdown (default), checkboxes | Checkboxes when the full option list is short and authors benefit from seeing all options |
| Number | Number field (default), slider & number field | Slider for bounded ranges (opacity, columns); add steps for fixed increments |
| Boolean | Switch (default), segmented control | Segmented control when "on/off" is unclear and explicit labels help (e.g. "No"/"Yes", "Hide"/"Show") |
| Text | Single-line (default), multi-line | Multi-line for descriptions or any value where authors enter more than one sentence |

The control and its settings live in the parameter's `typeConfig`. The `mutateComponent` tool that MCP and Scout use already documents the common `typeConfig` fields (`options`, `min`/`max`, `required`); the **editor-control** fields below are not in that tool's schema, so its create action strips them. Set them with an update that patches `typeConfig` (e.g. JSON Patch on `/parameters/<index>/typeConfig/<field>`), and note they only take effect on projects with the enhanced parameter editors enabled.

### Single select

- **Editors:** Select (default), radio buttons, segmented control, slider. Radio/segmented for 2–5 options visible at a glance; slider for ordered scales (XS–XXL); segmented with icons for visual concepts like alignment. Order slider options low to high.
- **Segmented control** options take an optional `icon` per option (giving text-only, icon-only, or icon + text); icons are kept only for the segmented control.

| `typeConfig` field | Values |
|--------------------|--------|
| `editor` | `'select'` (default) \| `'radio'` \| `'segmented-control'` \| `'slider'` |
| `options[].icon` | icon name string, in addition to the documented `text`/`value`; only honored when `editor` is `'segmented-control'` |

### Multi select

- **Editors:** Multi select dropdown (default), checkboxes. Checkboxes when the option list is short and authors benefit from seeing all options.

| `typeConfig` field | Values |
|--------------------|--------|
| `editor` | `'multi-select'` (default) \| `'checkboxes'` |

### Number

- **Editors:** Number field (default), slider & number field. Slider for bounded ranges (opacity, columns). Numbers are integers unless `decimal` is set; `useSteps`/`steps` constrain the slider to fixed increments (e.g. column counts).

| `typeConfig` field | Values |
|--------------------|--------|
| `editor` | `'number-field'` (default) \| `'slider-number-field'` |
| `decimal` | `boolean` — `true` enables decimals |
| `decimalPlaces` | `number` — only when `decimal` is `true` |
| `useSteps` | `boolean` — only with `editor: 'slider-number-field'` |
| `steps` | `number` — increment when `useSteps` is `true` |

### Boolean

The `checkbox` type has no `editor` field — the control follows from the labels: set only `trueLabel` (or neither) for a **switch**; set **both** `trueLabel` and `falseLabel` for a **segmented control** with explicit choices (e.g. "Hide" / "Show"). Use the segmented control when a bare on/off toggle is ambiguous.

| `typeConfig` field | Values |
|--------------------|--------|
| `trueLabel` | `string` — switch label, or the `true` choice |
| `falseLabel` | `string` — the `false` choice; setting both switches the control to a segmented control |

All editor controls support localization and conditional values. See the [parameters guide](https://docs.uniform.app/docs/guides/models/components/parameters).

## Validations

- Keep validations on components limited to the essential parameters — typically just `required` on the one or two parameters without which the component is broken.
- Overly strict validation (aggressive regex, tight min/max, many required fields) slows editors down and causes save friction in the visual editor.
- Strict validation belongs on **content types**, where entries feed many experiences and data integrity matters more.
- When you do use a validation regex, always set a validation message that tells the editor how to fix the input.

## Display name and thumbnail

- Set `Use as display name` on **one** parameter whose value best identifies the component instance in the structure panel and visual editor — typically the title or headline.
- If no parameter produces a meaningful instance name, set it on none; a generic value (e.g. a boolean or a select) as display name is worse than the component name alone.
- On asset parameters, `Use as thumbnail` shows the first asset as the instance thumbnail — useful for image-led components like cards and heroes.
