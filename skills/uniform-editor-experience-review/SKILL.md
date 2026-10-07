---
name: uniform-editor-experience-review
description: Audits and fixes Uniform frontend components in the Canvas visual editor (Next.js App Router and Page Router). Resolves authoring friction—such as disappearing empty states, missing slot and text placeholders, and unreachable interactive elements (carousels, tabs, accordions, modals)—without altering the visitor experience. Use when auditing Uniform editor UX, troubleshooting authoring issues in Canvas, or building components with empty states, slots or hidden content.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Editor experience review for Uniform Canvas

Review how a project's components behave while authors edit them in Canvas, report what gets in
their way, let the user choose what to fix, and apply the fixes. Canvas renders the real page in
an iframe, so whatever the page hides cannot be selected on the page: an empty button, a closed
panel, an inactive slide, an empty slot with no height.

The preview routes, `resolveComponent` and the component APIs are in the
`uniform-nextjs-app-router` and `uniform-nextjs-page-router` skills, if they are installed.

## Editor signals

| Need | App Router (`@uniformdev/next-app-router`) | Page Router (`@uniformdev/canvas-react`) |
|---|---|---|
| **In Canvas**, Edit or Preview tab. Gate reachability on it: dropping `inert` and `pointer-events: none` | `context.isContextualEditing` | `useUniformContextualEditingState().isContextualEditing` |
| **Edit tab** only. Gate anything that changes the look on it: placeholders, forced-open panels, stopped motion, editor-only controls | `context.pageState.previewMode === "editor"` | `useUniformContextualEditingState().previewMode === "editor"` |
| Selected component | [Channel hook](references/interactive-components.md#app-router-selection-hook) | `useUniformContextualEditingState({ global: true }).selectedComponentReference` |
| Empty-slot placeholder | `resolveEmptyPlaceholder` on `<UniformComposition>` and `<UniformPlayground>` | `emptyPlaceholder` on each `<UniformSlot>` |
| Default text placeholder | `placeholder` on each `UniformText` | `contextualEditingDefaultPlaceholder` on `<UniformComposition>` and `<UniformPlayground>` |

The live site must look the same after the review: every editor affordance sits behind one of the
first two gates ([expected differences](references/review-checks.md#the-live-site-looks-the-same)).
The Preview tab shows authors the page as visitors see it, so a look-changing affordance gated on
"in Canvas" alone is a finding (F3).

Reading the signals, passing them to client components and checking them against the installed
version: [detecting-the-editor.md](references/detecting-the-editor.md).

## The review workflow

1. **Scope.** Find the SDK, the component types the resolver maps, the stylesheets that lay out
   their slots, and the composition and playground routes. Note the editor helpers the project
   already has, and whether the user wants a review only, a review and a choice, or everything
   fixed. If the app can render a published page, save its HTML now for step 6.
2. **Review.** Run every check in [review-checks.md](references/review-checks.md) over the whole
   app, stylesheets included (S6 and I6 usually live in CSS), then read each hit.
3. **Report** by category, fix type and component:
   [review-and-selection.md](references/review-and-selection.md#the-report).
4. **Choose.** Ask which fix types to apply, with the recommended ones marked, unless the user has
   already decided: [review-and-selection.md](references/review-and-selection.md#asking-which-fixes-to-apply).
5. **Apply** the foundations the selection needs, then the selected fix types and nothing else:
   [review-and-selection.md](references/review-and-selection.md#applying-the-selection).
6. **Verify.** Typecheck or build, compare the published page with the HTML from step 1
   ([review-checks.md](references/review-checks.md#the-live-site-looks-the-same)), run the
   [Canvas checklist](references/review-checks.md#check-in-canvas), and write the
   [closing report](references/review-and-selection.md#the-closing-report).

## Building a new component

Apply the decision rules and silent failures below, then run the
[Canvas checklist](references/review-checks.md#check-in-canvas) on the component.

## Decision rules

- **Hide an empty component only when nothing a visitor would see is set, and never in the Edit
  tab.** An existing guard keeps its live-site condition and only gains the Edit-tab gate.
  → [empty-states.md](references/empty-states.md#hide-when-empty-guards)
- **Placeholders take the space the real content will take**: media at its size or aspect ratio,
  a slot at the height of a typical child, a slot in a row with a width as well. Turn a slot
  placeholder off only when the slot is optional and the layout has no room for it.
  → [empty-states.md](references/empty-states.md#image-and-video-placeholders),
  [slot-placeholders.md](references/slot-placeholders.md#sizing)
- **Keep hidden items mounted and hide them with CSS.** An unmounted panel, tab or slide has no
  editor markers, so selecting it in the component tree does nothing.
  → [interactive-components.md](references/interactive-components.md#keep-every-item-mounted)
- **For content behind interaction, use the lightest pattern that makes every item reachable:**

  | Pattern | Use for | Cost |
  |---|---|---|
  | Force open in the Edit tab | Accordions, FAQs, disclosures, read-more blocks | The Edit tab is taller than the live page |
  | Follow the Canvas selection | Carousels, tabs, mega-menu categories, tooltips, hotspots, modals | On the App Router, a small hook on an internal Canvas message |
  | Editor-only controls | In addition to following the selection, for authors who work on the page rather than in the component tree | Extra UI in the Edit tab |
  | Stop motion in the Edit tab | Autoplay, auto-advancing timers, countdown redirects, scroll-driven animation | None |

  → [interactive-components.md](references/interactive-components.md)
- **Frame patterns in the playground, and check breakpoints with Canvas preview viewports.** The
  frame's width selector narrows a container, so media queries do not respond to it.
  → [playground-tools.md](references/playground-tools.md)

## Silent failures to check for

- While editing, the SDK wraps each slot child in `<template>` markers. `:first-child`,
  `space-y-*`, `divide-*` and `> * + *` count them, so spacing shifts in the editor only. Space
  with `gap`. [slot-placeholders.md](references/slot-placeholders.md#spacing-that-survives-the-editor-markers)
- Empty slots hold a placeholder item while editing, so `items.length` is at least 1. Filter with
  `isComponentPlaceholderId`. [slot-placeholders.md](references/slot-placeholders.md#counting-and-branching-on-slot-contents)
- `UniformText` inside a value check, or given a missing parameter, renders no edit target.
  [empty-states.md](references/empty-states.md#uniformtext-placeholders)
- The App Router `UniformRichText` never shows its placeholder in Canvas.
  [empty-states.md](references/empty-states.md#uniformrichtext-placeholders)
- In the Edit tab Canvas turns clicks into selections. Editor-only UI receives clicks only inside
  `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`, which must never wrap authored content.
  [interactive-components.md](references/interactive-components.md#in-the-edit-tab-clicks-select)
- A hand-built `_contextualEditing` makes text `contentEditable` for every visitor.
  [interactive-components.md](references/interactive-components.md#tabs-whose-labels-come-from-the-children)
- A visually hidden (`sr-only`) `UniformText` reads raw values to screen readers on the live site.
  [empty-states.md](references/empty-states.md#values-that-are-not-visible)

## What does not exist

- **No `useIsEditMode`, `<EditorOnly>` or `withPlaceholder`** in any Uniform package. Read the
  signals above and branch on them.
- **No `emptyPlaceholder` on the App Router `UniformSlot`.** Empty slots go through
  `resolveEmptyPlaceholder`; the `uniform-nextjs-app-router` skill, if installed, has the API.
  [slot-placeholders.md](references/slot-placeholders.md)
- **No selection hook in the App Router SDK**, and `canvas-react`'s
  `useUniformContextualEditingState` is silently inert there. Use the
  [channel hook](references/interactive-components.md#app-router-selection-hook).
- **No playground decorators on the App Router.** `decorators` exists only on the Page Router's
  `UniformPlayground`. [playground-tools.md](references/playground-tools.md#app-router)

## Resources

- [Detecting the editor](references/detecting-the-editor.md): both signals on both SDKs, passing
  them to client components, tab changes, checking the installed version
- [Empty states](references/empty-states.md): hide-when-empty guards, media placeholders,
  `UniformText` and `UniformRichText` placeholders, values that are not visible, links
- [Slot placeholders](references/slot-placeholders.md): `resolveEmptyPlaceholder` and
  `emptyPlaceholder`, sizing, counting slot items, spacing around the markers, wrapping slot items
- [Interactive components](references/interactive-components.md): clicks in the Edit tab, keeping
  items mounted, stopping motion, forcing open, following the selection, editor-only controls
- [Playground tools](references/playground-tools.md): the playground-only pattern frame on both
  SDKs, frame widths versus preview viewports
- [Review checks](references/review-checks.md): the check catalog and fix types, the live-site
  comparison, the Canvas checklist
- [Reporting and selection](references/review-and-selection.md): the findings report, asking which
  fixes to apply, applying the selection, the closing report
