# Uniform Component Naming Guide

Guidance for choosing good component names. Use it to derive a name when modeling a component definition in Uniform.

Casing and metadata rules live in [component definitions](component-definitions.md); the rationale for keeping components content-agnostic lives in [component scope](component-scope.md). This guide is only about picking the name itself.

## Name by structural role, not content

**A name should describe what the component *is* structurally, never the content it happens to show.**

The litmus test: *"If this component were filled with completely different content, would the name still make sense?"*

- `Hero` works for any prominent opener — `Welcome Hero` assumes the content's purpose.
- `Grid` works for any multi-column collection — `Team Members` assumes what the items are.

Structural names keep the catalog small, let one component serve many content types, and match how design systems are built. When content-specific behavior is genuinely warranted, that is a scope decision, not a naming one — see [component scope](component-scope.md).

## Defer to the existing vocabulary first

Before inventing a name, check whether the design system or codebase already names the component. **If it does, use that name.** Uniform components should mirror the design system's structure and vocabulary rather than introduce a parallel one (see [component granularity](component-granularity.md)).

The guidance below is for greenfield modeling and for breaking ties when no established name exists. Do not rename an existing, well-understood component just to match a "canonical" word.

## How to choose a name

1. **Identify the structural or layout role.** What does this component *do* to its content — open a page, collect items, overlay, navigate, input data?
2. **Reuse an established name** from the design system or code component if one exists (step above).
3. **Pick the shortest unambiguous structural noun** for the role. Prefer `Hero` over `Hero Section`, `Grid` over `Grid Section` — a redundant `Section`/`Component` suffix adds nothing.
4. **One layout pattern = one component.** If two sections are structurally identical and differ only in content, they are the same component — not two names. If they differ in structure, the names should differ.
5. **Run the litmus test.** If the name only makes sense for today's content, replace it with the structural equivalent.

## Qualify variants by layout, not content

When a component has a real structural variant, qualify it with a **layout descriptor** rather than a content descriptor. For example a `Simple` prefix for a slot-free minimal variant, `Fixed` for a locked layout, `Flexible` for a parameter-configurable layout (`Simple Header`, `Fixed Hero`, `Flexible Hero`). Never qualify by content (`Team Grid`, `Pricing Card`) — that is content leaking back into the name.

## Common structural names

A non-exhaustive, non-mandatory palette to draw from when no established name exists. Treat these as inspiration, not an approved list — invent a clearer structural name when the role calls for one, and always defer to the design system's own vocabulary.

Examples are shown as the title-cased prose name (the Name field) followed by its camelCase public ID — see [component definitions](component-definitions.md) for the casing rules.

| Role | Example names (Name → `publicId`) |
|------|-----------------------------------|
| Elements | Button → `button`, Link → `link`, Icon → `icon`, Image → `image`, Heading → `heading`, Text → `text`, Rich Text → `richText`, Badge → `badge`, Tag → `tag`, Avatar → `avatar` |
| Content blocks | Card → `card`, Tile → `tile`, Quote → `quote`, Stat → `stat`, Testimonial → `testimonial`, Button Group → `buttonGroup` |
| Layout containers | Container → `container`, Box → `box`, Flex → `flex`, Grid → `grid` |
| Page sections | Section → `section`, Hero → `hero`, Cover → `cover`, Banner → `banner`, Callout → `callout`, Marquee → `marquee` |
| Collections | List → `list`, Carousel → `carousel`, Slider → `slider`, Bento Grid → `bentoGrid`, Timeline → `timeline`, Table → `table` |
| Navigation & chrome | Header → `header`, Footer → `footer`, Nav → `nav`, Sidebar → `sidebar`, Breadcrumb → `breadcrumb`, Tabs → `tabs` |
| Overlays & disclosure | Modal → `modal`, Drawer → `drawer`, Popover → `popover`, Tooltip → `tooltip`, Dropdown → `dropdown`, Accordion → `accordion` |
| Forms & input | Form → `form`, Search Bar → `searchBar`, Filter → `filter`, Fieldset → `fieldset` |
| Page compositions | Page → `page`, Article → `article`, Landing Page → `landingPage`, Category Page → `categoryPage`, Profile Page → `profilePage` |

## Child component naming

Some components exist only as direct children inside a parent's slot. Name them with a **parent prefix** so the relationship is clear: `{Parent} {Role}`, where Role is what it does inside the parent.

- `Accordion Item` inside `Accordion`, `Table Row` inside `Table`, `Flex Item` inside `Flex`, `Navigation Item` inside `Navigation Group`.
- A child component should only be allowed in its intended parent's slot. Don't create one if the parent can already accept a generic component via an open slot.

## Related guidance

- [Component definitions](component-definitions.md) — id/name casing, metadata, and mapping from code components.
- [Component scope](component-scope.md) — content-agnostic vs content-specific components and the patterns for content-specific variations.
- [Component granularity](component-granularity.md) — mirroring the design system and the atomic-design lens.
