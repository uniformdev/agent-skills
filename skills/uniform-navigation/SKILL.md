---
name: uniform-navigation
description: Model and build header navigation in Uniform — authored, reorderable nav items, dropdown flyouts, mega-menu panels with a category rail and promo area, and mobile drawers. Covers modeling the component chain, the slot-data techniques a parent needs to read its own children, variant-driven layout, and the interaction and accessibility layer. Use when adding a navigation bar, header, navbar, mega menu, flyout, or dropdown menu to a Uniform project, restructuring navigation so editors can author and reorder menu items, adding a mobile navigation drawer, or reviewing a navigation implementation for authoring or accessibility problems.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform navigation and mega menus

Navigation in Uniform is a chain of small components, authored and reordered in the visual
editor. The hard part is that **a slot hands a parent already-rendered, opaque children** —
so a menu shell that needs its children's *labels*, to draw a category rail or a mobile
section heading, cannot get them by reading the slot. Everything here follows from that.

## Workflow

### 1. Discover before you model

Never assume the project is greenfield, and never assume which component library it uses.
Find out which of these you are in — the answer changes every later step. See
[references/discovery.md](references/discovery.md) for the greps.

| What you find | Do |
|---|---|
| Navigation components already exist | **Extend them.** Add the panel/category level; keep existing IDs |
| A header exists but is flat (links only) | Add the flyout + panel levels beneath it |
| Nothing exists | Model the full chain from scratch |

Also determine, before writing any parameter: **is the Design Extensions integration
installed?** If it is not, `dex-*` parameter types produce values your code has no resolver
for. Use plain `select` / `text` / `asset` / `link` types instead.

### 2. Model the chain, not a component

Navigation is a chain of small components, each slot allowing only the next level. Menu
depth is a consequence of **which components a slot allows** — never a depth parameter, and
never numbered parameters (`link1`, `link2`).

```text
header
└── (center slot)  → link | flyout
    └── flyout                            ← trigger + panel shell; variant switches layout
        ├── (panel slot)  → link | group | category
        │   └── category                  ← rail label + its own panel
        │       └── (panel slot) → group | link | image | rich text | layout
        │           └── group             ← labelled column of links
        │               └── (links slot) → link
        └── (aside slot)  → promo content
```

Full slot policy, naming, and the pattern layer: [references/modeling.md](references/modeling.md).

### 3. Wire the parent → child data path *first*

Before any layout work, prove the shell can read its children. This is where navigation
builds fail, and the failure is silent. See
[references/slot-data-access.md](references/slot-data-access.md).

The shape, framework-neutral:

- The **rail** (labels) comes from raw child component instances, read server-side.
- The **panel** (content) comes from rendering the slot normally and filtering to the
  active child by `_id`.

Never rebuild children from raw data — read labels from it, render children through the slot.

### 4. Branch layout on variant, not on a parameter

A dropdown, a full-bleed mega panel, and a master-detail mega panel are the same component
in different layouts. Use a display **variant** for the layout switch and let the presence
of categories pick the sub-shape:

| Variant | Categories present | Layout |
|---|---|---|
| default | — | absolute panel anchored to the trigger |
| mega | none | full-bleed panel, edge to edge |
| mega | one or more | rail + panel, plus optional aside |

Full-bleed panels must be positioned below the header, not below the trigger. Measure the
header's bottom edge on resize and scroll rather than hard-coding a height.

### 5. Build the interaction layer

Hover intent with asymmetric delays, Escape to close, focus management, and `inert` on
closed panels. Do not ship a keyboard-reachable closed menu.
[references/interaction-and-a11y.md](references/interaction-and-a11y.md).

### 6. Compose into a pattern

Assemble the header once as a **component pattern**, then place it in the page composition's
header slot — typically inside a **composition pattern** so every page inherits it. Which
parameters to lock and which to open is a project decision, not a rule; make the trade
explicit rather than defaulting to locking everything.

That header slot is one you did not create. Confirm it accepts a *pattern*, not just your
header component — `patternsInAllowedComponents` reads backwards and blocks patterns when
set to `true`. See [references/modeling.md](references/modeling.md).

## Framework specifics

This skill is framework-neutral by design. How a parent reads child data, and whether that
code is a server or client component, is your framework SDK's business:

- **Next.js App Router** — [uniform-nextjs-app-router](../uniform-nextjs-app-router/SKILL.md),
  whose `references/advanced.md` documents the composition cache
- **Next.js Page Router** — [uniform-nextjs-page-router](../uniform-nextjs-page-router/SKILL.md)

General slot, parameter, naming, and pattern rules live in
[uniform-experience-modeling](../uniform-experience-modeling/SKILL.md); this skill does not
restate them.

## Guardrails

- **Repetition is a slot.** Numbered parameters (`link1`, `linkText2`) cap the count, block
  reordering, and forfeit personalization and A/B testing on individual menu items. The
  general rule is in
  [uniform-experience-modeling](../uniform-experience-modeling/references/slots.md).
- **Render editable labels with `UniformText`**, not as a raw string, or the editor cannot
  edit them inline. This bites on a category rail specifically: the label there is read from
  slot data, and printing that string produces a label nothing can click. Either render the
  rail label through the slot as well, or state plainly that the rail is edited from the
  component tree.
- **A parent must never rebuild its children** from raw slot data. It loses personalization,
  A/B tests, patterns, and editor affordances. Read metadata from raw data; render children
  through the slot.
- **Never enable allow-all on a navigation slot.** A promo/aside slot is the one place a wide
  allow-list is defensible — still enumerate it rather than toggling allow-all.
- **Editor placeholder items are real slot items.** Checking `items.length` to decide whether
  a region has content is always true in the editor. Filter out placeholder entries first.
- **A curated menu is authored as components; the project map drives *derived* navigation**
  — breadcrumbs, a sitemap, a section index. Nav items should still link *to* project map
  nodes. Entries behind a data resource are a valid third option when the menu genuinely
  mirrors content already modeled that way. All three, and when each is right:
  [references/modeling.md](references/modeling.md).

## Resources

- [Discovery](references/discovery.md) — find the existing navigation surface, the design
  system, and the token layer before changing anything
- [Modeling](references/modeling.md) — the component chain, slot policy, parameters, depth,
  and the pattern layer
- [Slot data access](references/slot-data-access.md) — the mechanism: how a shell reads its
  own children, the four techniques, and the silent failures
- [Interaction and accessibility](references/interaction-and-a11y.md) — hover intent, focus
  management, `inert`, the rail's correct ARIA pattern, mobile
