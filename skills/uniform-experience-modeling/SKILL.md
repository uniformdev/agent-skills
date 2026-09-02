---
name: uniform-experience-modeling
description: Best practices for experience modeling in Uniform — designing component definitions with well-chosen parameters, slots, editors, and naming, deciding between slots and parameters, blocks and slots, content-agnostic and content-specific components, choosing component granularity (atomic building blocks vs pre-composed components), and using component and composition patterns well (overrides, pattern data resources, slot sections, localization). Use when creating or updating Uniform component definitions or patterns, mapping code components (React, etc.) or a design system to Uniform components, or reviewing an existing component library for best-practice violations.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform experience modeling

Experience modeling is the process of building Uniform component definitions that represent the experience layer of a digital product: how content is displayed and how authors compose it. It contrasts with content modeling, which defines display-agnostic structured content (content types and entries). This skill encodes best practices for building component sets that are easy to author, easy to maintain, and map cleanly to code components.

## Key principles

### Components map to code components

A Uniform component typically maps to a frontend code component. Parameters map to props; slots map to children or child-component props. Not every prop needs to be exposed — hardcode props that editors should not manage. Align parameter public IDs and types with the corresponding props to avoid mapping logic.

### Choose the right component granularity

Components correlate strongly to the design system rendering the experience, and atomic design is a useful lens: atoms and molecules map to component definitions (or parameters — not every design-system component needs a Uniform component), organisms to definitions plus component patterns, templates to composition patterns, pages to compositions. Balance granular atomic and layout components (flexible, but shifts design decisions, design consistency, and responsive handling to editors) against pre-composed components and patterns (easier, more guard rails); both can coexist, with granular components reserved for exceptions and experimentation.

### Design for editors first

Names, help text, grouping, and editor controls exist for non-technical authors. Use non-technical names, write help text only when the purpose isn't obvious, group related parameters, collapse advanced settings, and pick the editor control (radio, segmented control, slider, switch, checkboxes) that matches how authors think about the setting.

### Restrict slots deliberately

Never enable the allow-all-components toggle on a slot. Allow only the components and patterns that make sense, plus the built-in Personalization and A/B Test components where optimization is expected, and the Loop component where children are rendered dynamically from data. An explicit allow-list may still be wide for granular setups — what to avoid is the allow-all toggle, not a long list.

### Prefer slots over parameter groups and blocks for nested UI

Slots keep nested elements flexible: extensible, personalizable, A/B testable, and reusable via patterns. Use parameter groups when simplicity matters more, and blocks only for non-visual structured data. When requirements are unclear, default to a restricted slot.

### Keep composition parameters for global page data

Reserve composition parameters for global, page-level data (e.g. SEO/OpenGraph metadata); experience content belongs in components in the composition's content slot.

### Keep components content-agnostic

Prefer "Card" over "Recipe Card" — the component is a display container. Create content-specific variations with component patterns — either static (fixed, reused content) or connected to a data resource that wires entry fields to the base component's parameters. Only create content-specific components for core domain objects or use-case-specific behavior.

### Use patterns deliberately

A pattern reuses exact content (static), a preset configuration, or a connection to data — choose which intent it serves. Override settings are the governance dial: lock what must stay consistent, open only what instances legitimately vary, and reserve extension points with restricted slot sections.

### Validate sparingly

Keep validations on components limited to essential parameters. Strict validation belongs on content types, where data integrity matters more than authoring speed.

## Resources

See `references/` for detailed guidance:
- [Component definitions](references/component-definitions.md) — Component metadata, descriptions as AI guidance, display variants, mapping from code components
- [Component naming](references/component-naming.md) — A method for choosing structural (not content-based) names, deferring to the existing design system, layout-qualifier variants, and child component naming conventions
- [Component granularity](references/component-granularity.md) — Atomic design as a lens, classifying design-system elements, layout components, granular vs pre-composed balance
- [Parameters](references/parameters.md) — Naming, type matching, help text and guidance, localization, grouping, editors, validations, display name
- [Slots](references/slots.md) — Single vs multiple slots, slot naming, restricting slots, optimization and Loop components, slots vs parameter groups, composition parameters vs content slots, blocks vs slots
- [Component scope](references/component-scope.md) — Content-agnostic vs content-specific components, patterns for content-specific variations
- [Patterns](references/patterns.md) — Pattern strategy, overrides, pattern data resources, slot sections, editions, localization
- [Review checklist](references/review-checklist.md) — Audit workflow and checklist for reviewing an existing component library
