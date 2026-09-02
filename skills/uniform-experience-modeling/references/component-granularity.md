# Component granularity

What kinds of components make up a Uniform component library, and how granular the building blocks exposed to editors should be.

## Components mirror the design system

Uniform components are the individual building blocks that make up a digital experience like a website. They correlate strongly to the component library or design system used to render the experience: when a design system exists, the Uniform component library should follow its structure and vocabulary rather than invent a parallel one.

## Atomic design as a lens

Atomic design is not a Uniform product concept and not a prescription to replicate one-to-one. Use it as a lens for assessing the granularity of a component inventory, and as a translation layer for the vocabulary designers, frontend developers, and agencies bring (e.g. a Storybook organized as atoms/molecules/organisms).

| Atomic design level | Examples | In Uniform |
|---------------------|----------|------------|
| Atoms | Button, Tag, Chip, Quote, Image, Text Block | Component definitions — but often better as parameters or code-only (see caveat below) |
| Molecules | Accordion (+ Accordion Items), Form, Image Gallery (+ Images) | Component definitions with slots for their child components |
| Organisms | Hero, Section, Header, Footer | Component definitions; reusable configurations as [component patterns](https://docs.uniform.app/docs/guides/patterns/component-patterns) |
| Templates | Product detail layout, article page layout | [Composition patterns](https://docs.uniform.app/docs/guides/patterns/composition-patterns) — Uniform has no "template" in its vocabulary |
| Pages | The actual pages/screens | Compositions, created from composition patterns (or composition types directly) |

Two precision points:

- **Organisms vs patterns.** An organism (Header, Hero) is a component *definition*; a specific reusable *configuration* of it (e.g. "the global header") is expressed as a component pattern based on that definition. Note that patterns can't be the root component of a composition, so header/footer patterns are placed in slots of the composition's root component.
- **Not every design-system component needs a Uniform component definition.** The lower the atomic level, the more likely the element should stay in code or be a parameter group on a parent rather than become its own Uniform component: a Tag may be rendered from entry data, an icon may be a parameter on its parent. A single CTA inside a Hero *can* be a "CTA" parameter group when it never needs to be multiplied, reordered, or optimized independently — but model it as a restricted slot when it does; this is a genuine judgment call, decided in slots vs parameter groups in [slots](slots.md). This extends the "not every prop needs a parameter" principle one level up.

Don't surface atomic-design vocabulary to editors: "atoms/molecules/organisms" is architect language. Component categories should use editor terms like "Layout", "Content", "Navigation", or "Building blocks".

## Where each design-system element lives

Use this table to classify a design-system inventory element by element:

| Design-system element | Uniform representation |
|-----------------------|------------------------|
| Purely stylistic or internal element (divider, focus ring, skeleton loader) | Code-only — no Uniform counterpart |
| Element always embedded in one parent, singular, never optimized independently (an icon paired with a Stat value) | Parameter group on the parent component |
| Element editors place, configure, and reuse independently (Card, Accordion, Image Gallery) | Component definition |
| Reusable preconfigured instance of a component (global header, legal disclaimer, author bio) | Component pattern |
| Reusable page scaffold with shared structure and slot sections (product detail layout) | Composition pattern |
| An actual page or screen | Composition |

## Modeling workflow

When asked to model a design system or component library in Uniform:

1. **Inventory** the design system / code components (Storybook, component library, codebase).
2. **Classify** each element using the table above.
3. **Elicit the non-discoverable factors before choosing a granularity strategy.** Editor experience and training, brand-consistency requirements, appetite for editorial flexibility, and governance needs cannot be inferred from a project or codebase — ask the user, don't decide unilaterally.
4. **Propose** the component list with categories, slot restrictions, and pattern candidates for review.

## Layout components

Alongside content components, projects commonly need layout-specific components that control how child components in slots are placed within a component: Grid, Two-up Layout, Tabs, Columns. They're typically used within molecules or organisms and carry layout configuration (column count, gap, alignment) as parameters while their slots hold the content. Restrict their slots deliberately like any other (see [slots](slots.md)).

## Granular vs pre-composed

A central modeling decision is how many granular atomic and layout components to expose to editors versus offering pre-composed molecule/organism-level components and component patterns:

- **Granular (atomic + layout components):** maximum editorial flexibility — but complexity and responsibility shift to editors. Design decisions, design consistency, and responsive sizing become editorial concerns, and editors may not be trained for them.
- **Pre-composed (molecules, organisms, component patterns):** easier to use, fewer ways to break the design, and the code component can bake in optimizations for variations and responsive behavior. The cost is flexibility.

Both approaches can coexist in the same project: default to pre-composed components and patterns for everyday authoring, and reserve granular atomic components for exceptions and one-off experimentation.

### Implementing a mixed approach

- **Slot restrictions** — pre-composed setups keep allowed-component lists tight; granular setups inevitably widen them. This is an application of the "restrict slots deliberately" principle, not an exception: even a wide slot should list its components explicitly.
- **Categories** — park granular atomic and layout components in an "Advanced" or "Building blocks" category so the everyday catalog stays scannable (see [component definitions](component-definitions.md)).
- **Component patterns with overrides** — the bridge between both worlds: granular definitions underneath, pre-composed authoring on top. A "Hero with CTA" pattern assembles the atoms once; editors override only what the pattern allows.

### Decision summary

| Situation | Approach |
|-----------|----------|
| Editors are marketers/content authors without design-system training | Pre-composed components and patterns |
| Strict brand-consistency requirements | Pre-composed, with tight slot restrictions and pattern overrides |
| Experienced editors who need layout freedom | Granular, with layout components and curated patterns to reduce assembly friction |
| Frequent experimentation or one-off landing pages | Mixed — pre-composed defaults plus granular components in an "Advanced" category |
| Design system still evolving, requirements unclear | Start pre-composed; granularity can be added later more easily than it can be taken away |

## Related guidance

- [Component scope](component-scope.md) — whether a component should be content-agnostic or content-specific
- [Slots](slots.md) — slot restrictions and slots vs parameter groups; how many components a slot allows follows from the granularity strategy
- [Patterns](patterns.md) — pattern strategy, override design, and slot sections for the pattern candidates identified here
