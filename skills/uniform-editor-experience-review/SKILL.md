---
name: uniform-editor-experience-review
description: Reviews how a Uniform frontend's components behave in the Canvas visual editor and fixes what the review finds — empty buttons, links and images that vanish, missing UniformText and UniformRichText placeholders, empty slots with no drop target, carousels, tabs, accordions and modals that authors cannot reach or that move while they edit, editor-only controls that cannot be clicked, and patterns shown bare in the playground. Reports the findings grouped by fix type, lets the user pick which to apply, then applies them without changing what visitors see. Use when asked to review, audit or improve the editor or authoring experience of a Uniform project; when authors report that components vanish, collapse, cannot be clicked or selected, or slide away in Canvas; when patterns are hard to preview in the playground; or when building a component with empty states, slots or content hidden behind interaction. Covers the Next.js App Router and Page Router SDKs.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Editor experience review for Uniform Canvas

A workflow for one part of a Uniform frontend: how its components behave while authors edit them
in Canvas. Review the components against the checks, report what gets in the author's way, let the
user choose what to fix, and fix it without changing what visitors see.

Canvas renders the real frontend in an iframe. Whatever the page hides cannot be selected or
edited: an empty button, a missing image, a closed accordion panel, an inactive slide, an empty
slot with no height. The review looks for those cases and stays inside the editor experience; it
is not a general code review.

Framework wiring (the preview route, `resolveComponent`, `UniformText` props) is in the
`uniform-nextjs-app-router` and `uniform-nextjs-page-router` skills. The review starts from a page
that already opens in Canvas.

## Two rules

**Production output does not change.** Every editor affordance sits behind a gate, and the gate
matches what the author is doing:

| Signal | True when | Gate on it |
|---|---|---|
| **In Canvas** (`isContextualEditing`) | The page is loaded inside Canvas, in the Edit **or** the Preview tab | Reachability: dropping `inert` and `pointer-events: none` |
| **Edit tab** (`previewMode === 'editor'`) | The author is in the Edit tab (`'preview'` in the Preview tab, `undefined` outside Canvas) | Anything that changes the look: placeholders, force-opened panels, stopped autoplay, editor-only controls |

The Preview tab shows authors the page as visitors will see it. A placeholder or a forced-open
panel gated on `isContextualEditing` alone shows there too, which makes it a finding.

**Everything authored stays reachable.** Every value an author can set needs, in the state it is
authored in, something to click to select it, somewhere to type (text) and a drop target (slots).
Empty, collapsed, closed, inactive and off-screen are all states content is authored in.

## Signals per SDK

| Need | App Router (`@uniformdev/next-app-router`) | Page Router (`@uniformdev/canvas-react`) |
|---|---|---|
| In Canvas | `context.isContextualEditing`, on the `context` prop every resolved component receives | `useUniformCurrentComposition().isContextualEditing` |
| Edit vs Preview tab | `context.pageState.previewMode` at render; live changes through the selection hook | `useUniformContextualEditingState().previewMode` |
| Selected component | **No SDK hook.** A small channel hook: [interactive-components.md](references/interactive-components.md#app-router-selection-hook) | `useUniformContextualEditingState({ global }).selectedComponentReference` |
| Empty-slot placeholder | `resolveEmptyPlaceholder` on `<UniformComposition>` and `<UniformPlayground>` | `emptyPlaceholder` on each `<UniformSlot>` |
| Default text placeholder | None; pass `placeholder` on each `UniformText` | `contextualEditingDefaultPlaceholder` on `<UniformComposition>` |
| Is this slot item a placeholder? | `isComponentPlaceholderId` from `@uniformdev/canvas` | Same |
| Rendered in the playground | `context.matchedRoute === "composition"`, not `context.type` | The playground route itself |
| Editor UI that must receive clicks | Inside an element with `IS_RENDERED_BY_UNIFORM_ATTRIBUTE` from `@uniformdev/canvas` | Same |

Passing the flag to client components, timing on each SDK, and confirming these shapes against the
installed version: [detecting-the-editor.md](references/detecting-the-editor.md).

## The review workflow

### 1. Scope

- **Which SDK**: the column of the table above that applies.
- **What to review**: every component type the resolver maps (`resolveComponent`, or the
  component registry on the Page Router), the stylesheets that lay out their slots, and the
  composition and playground routes.
- **What exists already**: editor gates, a placeholder component, an empty-slot resolver, a
  playground frame. Fixes reuse these rather than adding a parallel set.
- **What the user asked for**: a review only, a review then a choice, or "fix everything". It
  decides step 4.

### 2. Review

Run the checks in [review-checks.md](references/review-checks.md) component by component. Each
check's grep finds candidates; read every candidate before recording it. Record a finding only when
you can say what the author experiences, and mark the ones that change what visitors get today (a
hand-built editing marker, a visually hidden raw value) as live-site bugs.

### 3. Report

Group the findings by category, then fix type, then component, and list the components with no
findings so the user can see they were reviewed. Template and rules:
[review-and-selection.md](references/review-and-selection.md#the-report).

### 4. Choose

Offer the **fix types**, not individual findings, with the recommended ones pre-selected. Skip the
question when the user already said to apply everything; stop after the report when they asked for
a review only. Question shapes and the text fallback:
[review-and-selection.md](references/review-and-selection.md#asking-which-fixes-to-apply).

### 5. Apply

Foundations the selection needs first, then each selected fix type with the patterns in the
references below. Unselected findings stay untouched:
[review-and-selection.md](references/review-and-selection.md#applying-the-selection).

### 6. Verify and report

1. Typecheck or build.
2. Render a published page before and after the fixes and diff the HTML. Nothing an editor gate
   controls may appear in it: [review-checks.md](references/review-checks.md#production-is-unchanged).
3. Check the Edit tab, the Preview tab and a pattern in the playground with the
   [Canvas checklist](references/review-checks.md#check-in-canvas). If you cannot open Canvas
   yourself, say so and hand the user the checklist.
4. Close with what was applied, what was left open, and what still needs a human in Canvas.

## Building a new component

Use the [new-component checklist](references/review-checks.md#checklist-for-a-new-component). A
carousel that cannot show slide 3 costs more to retrofit than to build right.

## Decision rules

- **Hide an empty component only when every authorable part is empty, and never in the Edit
  tab.** A button with an icon and no label is not empty; a button with a link and no label is.
  → [empty-states.md](references/empty-states.md#hide-when-empty-guards)
- **Placeholders take the space the real content would**: media at its size or aspect ratio, a
  slot at the height of a typical child, a horizontal slot with a width as well.
  → [empty-states.md](references/empty-states.md#image-and-video-placeholders),
  [slot-placeholders.md](references/slot-placeholders.md#sizing)
- **Turn a slot placeholder off only when the slot is optional and the layout has no room for
  it.** → [slot-placeholders.md](references/slot-placeholders.md#sizing)
- **Keep hidden content mounted and hide it with CSS.** An unmounted panel, tab or slide has no
  editor markers, so selecting it in the component tree does nothing.
  → [interactive-components.md](references/interactive-components.md#keep-every-item-mounted)
- **For content behind interaction, use the lightest pattern that makes every item reachable:**

  | Pattern | Use for | Cost |
  |---|---|---|
  | Force open in the Edit tab | Accordions, FAQs, tooltips, hotspots, disclosures: anything that still reads with every panel open | The Edit tab is taller than production |
  | Follow the Canvas selection | Carousels, tabs, mega-menu categories: anything where only one item can be visible | Needs the selection signal; the App Router needs a small hook |
  | Editor-only controls | Authors who work on the page rather than in the component tree; components with no selection support | Extra UI in the Edit tab, marked so Canvas lets its clicks through |
  | Stop motion in the Edit tab | Autoplay, auto-advancing timers, countdown redirects, scroll-driven animation | None |

  Most interactive components need two. A carousel needs *stop motion* and *follow selection*,
  plus *editor controls* when it has no visible arrows. An accordion needs *force open* or
  *follow selection*. → [interactive-components.md](references/interactive-components.md)
- **Frame patterns in the playground, and check breakpoints with Canvas preview viewports.** The
  frame's width selector narrows a container, so media queries do not respond to it.
  → [playground-tools.md](references/playground-tools.md)

## Silent failures to check for

Each is explained once, in the reference it links to.

- In the Edit tab Canvas turns every click into a selection. A component's own arrows and toggles
  do nothing, and editor-only controls work only inside `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`, which
  must never wrap authored content.
  [interactive-components.md](references/interactive-components.md#in-the-edit-tab-clicks-select)
- Empty slots hold a placeholder item while editing, so `items.length` is at least 1. Filter with
  `isComponentPlaceholderId`. [slot-placeholders.md](references/slot-placeholders.md#counting-and-branching-on-slot-contents)
- Canvas wraps slot children in `<template>` markers, which `:first-child`, `space-y-*`,
  `divide-*` and `> * + *` count as siblings, so spacing shifts in the editor only. Space with
  `gap`. [slot-placeholders.md](references/slot-placeholders.md#spacing-that-survives-the-editor-markers)
- `UniformText` inside a value check, or given a missing parameter, renders no edit target. Its
  `render` prop is not applied while editing.
  [empty-states.md](references/empty-states.md#uniformtext-placeholders)
- The App Router `UniformRichText` never shows its placeholder in Canvas; the Page Router one shows
  it only for an empty rich-text value.
  [empty-states.md](references/empty-states.md#uniformrichtext-placeholders)
- A hand-built `_contextualEditing` makes text `contentEditable` for every visitor.
  [interactive-components.md](references/interactive-components.md#tabs-whose-labels-come-from-the-children)
- An `sr-only` `UniformText` reads raw values to screen readers in production.
  [empty-states.md](references/empty-states.md#values-that-are-not-visible)
- One instance rendered twice, such as desktop and mobile copies, gives Canvas two editable
  regions that fight each other.
  [interactive-components.md](references/interactive-components.md#rendering-one-instance-twice)
- Editor and draft renders cached behind `'use cache'`.
  [detecting-the-editor.md](references/detecting-the-editor.md#caching)
- A "component not found" fallback that renders on the live site.
  [empty-states.md](references/empty-states.md#component-not-found)

## What does not exist

- **No `useIsEditMode`, `<EditorOnly>` or `withPlaceholder`** in any Uniform package. Read the
  signal from the table above and branch on it.
- **No playground decorators on the App Router.** `decorators` exists only on the Page Router's
  `UniformPlayground`, and is marked experimental there.
  [playground-tools.md](references/playground-tools.md#app-router)
- **No `emptyPlaceholder` on the App Router `UniformSlot`.** The App Router resolves every
  placeholder centrally through `resolveEmptyPlaceholder`.
  [slot-placeholders.md](references/slot-placeholders.md#app-router-one-resolver-for-the-project)
- **No selection hook in the App Router SDK.** `useUniformContextualEditingState` from
  `canvas-react` imports and type-checks there, then reports `isContextualEditing: false` for ever.
  [interactive-components.md](references/interactive-components.md#app-router-selection-hook)

## Framework specifics

- **Text, rich text, slot and asset APIs**: the App Router skill's
  [components.md](../uniform-nextjs-app-router/references/components.md) and the Page Router
  skill's [components.md](../uniform-nextjs-page-router/references/components.md).
- **Flyouts and mega menus** (`inert`, focus and keyboard handling): the navigation skill's
  [interaction-and-a11y.md](../uniform-navigation/references/interaction-and-a11y.md).
- **Slot placeholders in the content model**: the `uniform-experience-modeling` skill's slot
  guidance.

## Resources

- [Detecting the editor](references/detecting-the-editor.md): both signals on both SDKs, passing
  the flag to client components, tab changes, caching, verifying against the install
- [Empty states](references/empty-states.md): hide-when-empty guards, image and video
  placeholders, `UniformText` and `UniformRichText` placeholders, non-visual values, links
- [Slot placeholders](references/slot-placeholders.md): `resolveEmptyPlaceholder` versus
  `emptyPlaceholder`, sizing, labelled placeholders, marker-safe spacing, wrapping slot items
- [Interactive components](references/interactive-components.md): carousels, tabs, accordions,
  modals, tooltips; stopping motion, keeping items mounted, editor controls, following selection
- [Playground tools](references/playground-tools.md): the playground-only pattern frame on both
  SDKs, widths versus preview viewports, detecting the playground
- [Review checks](references/review-checks.md): the check catalog with IDs and fix types, the
  greps that find each gap, the production diff, the Canvas checklist, the new-component checklist
- [Reporting and selection](references/review-and-selection.md): the findings report, the
  checkbox question and its text fallback, when not to ask, applying the selection
