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
in Canvas. Review the components against the checks, report what breaks the editor experience,
let the user choose what to fix, and fix it — without changing what visitors see.

Canvas renders the real frontend in an iframe and lets authors click, type and drop into it.
Anything the page hides — an empty button, a missing image, a closed accordion panel, the slide
that is not showing, an empty slot that collapses to nothing — is something an author cannot
select or edit. That is what the review looks for. It is not a general code or architecture
review: stay inside the editor experience.

Framework wiring — the preview route, `resolveComponent`, `UniformText` props — is in the
`uniform-nextjs-app-router` and `uniform-nextjs-page-router` skills. This skill assumes that
wiring works and the page already opens in Canvas.

## The two rules everything else follows

**Production output does not change.** Every editor affordance sits behind a gate, and the gate
has to match what the author is doing. Canvas has an Edit tab and a Preview tab, and the SDK gives
you a separate signal for each question:

| Signal | True when | Gate on it for |
|---|---|---|
| **In Canvas** — `isContextualEditing` | The page is loaded inside Canvas, **in either tab** | Keeping things *reachable*: dropping `inert`, removing `pointer-events: none`, not navigating away on click, not writing analytics or enrichment scores from the author's session |
| **Edit tab** — `previewMode === 'editor'` | The author is in the Edit tab (`'preview'` in the Preview tab, `undefined` outside Canvas) | Anything that *changes the look*: placeholders, force-opened panels, stopped autoplay, editor-only controls |

The Preview tab exists so authors can see the page as visitors will. Placeholders and
force-opened panels there defeat it. Gating those on `isContextualEditing` alone is the common
mistake — it is true in Preview too.

**Everything authored stays reachable.** For every value an author can set there must be, in the
state it is authored in, something to click to select it, somewhere to type (text), and a drop
target (slots). Empty, collapsed, closed, inactive and off-screen are all states content is
authored in.

## Signals per SDK

| Need | App Router (`@uniformdev/next-app-router`) | Page Router (`@uniformdev/canvas-react`) |
|---|---|---|
| In Canvas | `context.isContextualEditing` — on the `context` prop every resolved component receives | `useUniformCurrentComposition().isContextualEditing` |
| Edit vs Preview tab | `context.pageState.previewMode` at render; live changes through the selection hook | `useUniformContextualEditingState().previewMode` |
| Selected component | **No SDK hook.** A small channel hook — [interactive-components.md](references/interactive-components.md#app-router-selection-hook) | `useUniformContextualEditingState({ global }).selectedComponentReference` |
| Empty-slot placeholder | `resolveEmptyPlaceholder` on `<UniformComposition>` and `<UniformPlayground>` | `emptyPlaceholder` on each `<UniformSlot>` |
| Default text placeholder | None — pass `placeholder` on each `UniformText` | `contextualEditingDefaultPlaceholder` on `<UniformComposition>` |
| Is this slot item a placeholder? | `isComponentPlaceholderId` from `@uniformdev/canvas` | Same |
| Rendered in the playground | `context.matchedRoute === "composition"` — not `context.type` | The playground route itself |
| Editor UI that must receive clicks | Inside an element with `IS_RENDERED_BY_UNIFORM_ATTRIBUTE` from `@uniformdev/canvas` | Same |

Server → client passing, hydration, and how to confirm these against the installed version:
[references/detecting-the-editor.md](references/detecting-the-editor.md).

## The review workflow

### 1. Scope

- **Which SDK** — the column of the table above that applies.
- **What to review** — every component type the resolver maps (`resolveComponent`, or the
  component registry on the Page Router), the stylesheets that lay out their slots, plus the
  composition and playground routes.
- **What exists already** — editor gates, a placeholder component, an empty-slot resolver, a
  playground frame. Fixes reuse these rather than adding a parallel set.
- **What the user asked for** — a review only, a review then a choice, or "fix everything". It
  decides step 4.

### 2. Review

Go component by component, running the checks in
[references/review-checks.md](references/review-checks.md) — one grep per gap, so you find
candidates instead of reading every file, then read each candidate. Record a finding only when you
can say what the author experiences:

| Field | Example |
|---|---|
| Check ID | `E1` |
| Component and location | Button · `components/Button.tsx:21` |
| What the author experiences | A freshly dropped button vanishes and cannot be selected |
| Fix type | Keep empty components visible |
| Live-site bug? | No — it only affects editing |

Findings that change what visitors get today — a hand-built editing marker, a visually hidden raw
value — are live-site bugs. Say so.

### 3. Report

Group the findings **category → fix type → component**, with the four categories Empty states,
Slots, Interactive and Playground. The template and its rules are in
[references/review-and-selection.md](references/review-and-selection.md). List the components
with no findings, so the user can see they were reviewed.

### 4. Choose

Offer the **fix types** — not individual findings — for selection, recommended ones pre-marked:

- With a multi-select question tool (Claude Code's `AskUserQuestion`): one question per category,
  one option per fix type, in a single call.
- Without one: a numbered checklist the user answers with numbers, `recommended` or `all`.
- **Skip the question** when the user already said to apply everything: apply the recommended set.
- **Stop after the report** when the user asked for a review only. Change no code.

Exact question shapes, limits and fallbacks: [review-and-selection.md](references/review-and-selection.md#asking-which-fixes-to-apply).

### 5. Apply

Foundations first, and only those a selected fix needs — the gate helpers, the App Router
empty-placeholder resolver, the App Router selection hook. Then each selected fix type across the
components it lists, with the patterns in the references below. Leave unselected findings
untouched.

### 6. Verify and report

1. Typecheck or build.
2. **Prove production is unchanged**: render a published page before and after and diff the HTML.
   Nothing an editor gate controls may appear in it.
3. **Check in Canvas** — the Edit tab, the Preview tab, and a pattern in the playground — with the
   checklist in [review-checks.md](references/review-checks.md#check-in-canvas). If you cannot
   open Canvas yourself, say so and hand the user the checklist.
4. Close with what was applied, what was left open, and what still needs a human in Canvas.

### Building a new component

The same checks apply while writing one — the short list is in
[review-checks.md](references/review-checks.md#checklist-for-a-new-component). The expensive gaps
(a carousel that cannot show slide 3, an accordion whose closed content is not in the DOM) are
structural; retrofitting them costs more than getting them right first.

## Decision rules

**Hide an empty component only when every authorable part is empty — and never in the editor.**
A button with an icon and no label is not empty. A card with a title and no image is not empty.
In production, return `null` rather than an empty wrapper that holds layout space. In the editor,
render it with placeholders so the author has something to fill.
→ [empty-states.md](references/empty-states.md)

**Placeholders take the space the real content would.** An image placeholder takes the configured
width and height, or the aspect ratio the image slot has in the layout. A slot placeholder takes
the height a typical child would, and a horizontal slot needs a width too. A zero-height
placeholder is a drop target nobody can hit; one far larger than real content makes the editor
misrepresent the layout.
→ [empty-states.md](references/empty-states.md), [slot-placeholders.md](references/slot-placeholders.md)

**Turn a slot placeholder off only when the slot is optional and the layout has no room for it**
— a media slot on a card variant with no media column, say. The cost is real: the author gets no
drop target in the page and has to add to that slot from the component tree.
→ [slot-placeholders.md](references/slot-placeholders.md)

**Keep hidden content mounted and hide it with CSS.** A closed panel, an inactive tab, a slide
that is not current: render it, hide it visually. Unmounting it — `{isOpen && content}`, or
returning an empty fragment for inactive slot items — removes it from the DOM together with the
markers Canvas uses to find components, so selecting it in the component tree does nothing.
→ [interactive-components.md](references/interactive-components.md)

**For content behind interaction, use the lightest pattern that makes every item reachable:**

| Pattern | Use for | Cost |
|---|---|---|
| Force open in the Edit tab | Accordions, FAQs, tooltips, hotspots, disclosures — anything that still reads with every panel open | The Edit tab is taller than production |
| Follow the Canvas selection | Carousels, tabs, mega-menu categories — anything where only one item can be visible | Needs the selection signal; the App Router needs a small hook |
| Editor-only controls | Authors who work on the page rather than in the component tree; components with no selection support | Extra UI in the Edit tab, marked so Canvas lets its clicks through |
| Stop motion in the Edit tab | Autoplay, auto-advancing timers, countdown redirects, scroll-driven animation | None |

Most interactive components need two. A carousel needs *stop motion* and *follow selection*, plus
*editor controls* when it has no visible arrows. An accordion needs *force open* or *follow
selection*.
→ [interactive-components.md](references/interactive-components.md)

**Frame patterns in the playground; test breakpoints with preview viewports.** A playground-only
frame gives a pattern its component label and a sensible container width. Its width selector
narrows a container, so it tests container layouts — media-query breakpoints follow the preview's
own width and are tested with Canvas's preview viewports, which should match the design system.
→ [playground-tools.md](references/playground-tools.md)

## Traps and things that do not exist

- **There is no `useIsEditMode`, `<EditorOnly>` or `withPlaceholder`** in any Uniform package.
  Read the signal from the table above and branch on it.
- **In the Edit tab, clicks select — they do not click.** Canvas stops every click on the page
  before React sees it and turns it into a component selection. The component's own arrows,
  toggles and links do nothing there, and editor-only controls work only inside an element with
  `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`. Never put that attribute on an ancestor of authored content:
  inside it, nothing can be selected.
- **The App Router has no playground decorators.** `decorators` exists only on the Page Router's
  `UniformPlayground`, and is marked experimental there. On the App Router the playground page
  wraps `<UniformPlayground>` in a client frame.
- **`useUniformContextualEditingState` does nothing under the App Router SDK.** It imports from
  `@uniformdev/canvas-react` (installed as a dependency of `@uniformdev/next-app-router`),
  type-checks, and returns `isContextualEditing: false` for ever, because the App Router SDK never
  provides the composition context the hook reads. No error, no warning.
- **The App Router `UniformSlot` has no `emptyPlaceholder` prop.** That is the Page Router API.
  The App Router resolves every placeholder centrally through `resolveEmptyPlaceholder`, and its
  option types are not exported by name — derive them from
  `UniformCompositionProps['resolveEmptyPlaceholder']`.
- **Empty slots are not empty in the editor.** They contain a placeholder item, so
  `slot.items.length` is at least 1 while editing. Filter with `isComponentPlaceholderId` — the
  navigation skill has the full recipe in
  [slot-data-access.md](../uniform-navigation/references/slot-data-access.md#technique-4--detect-emptiness-without-counting).
- **Canvas wraps every slot child in `<template>` marker elements while editing.**
  `:first-child`, `:last-child`, `:nth-child`, `> * + *`, `space-y-*` and `divide-*` count them
  as siblings, so spacing and borders shift in the editor only — look in the stylesheets as well
  as the class names. Space slot children with `gap` on a flex or grid parent.
- **`UniformText` renders nothing when the parameter object is missing**, and wrapping it in a
  value check — `title?.value && <UniformText … />` — removes the edit target exactly when it is
  needed. Always render it and let `placeholder` cover the empty case.
- **The `UniformText` placeholder is not in your markup.** It is a `data-uniform-placeholder`
  attribute Canvas draws. `render` is not applied to the value while editing: the App Router never
  applies it in the editor, and the Page Router skips it while the field has focus. Do not put
  anything the author needs to see into `render`.
- **The App Router `UniformRichText` never shows its placeholder.** The SDK marks only `text`
  parameters as editable, and `UniformRichText` gates both its placeholder and its empty-value
  output on that mark, so an empty rich-text field renders nothing in Canvas. Render your own
  Edit-tab hint. The Page Router `UniformRichText` does show its placeholder.
- **Never hand-build `_contextualEditing`.** A parameter object constructed with
  `_contextualEditing: { isEditable: true }`, to make a child's text editable from its parent,
  is `contentEditable` on the live site too. The SDK attaches that key only in editor state, and
  the text components trust whatever they receive.
- **Rendering one instance twice gives Canvas two editable regions for it** — desktop and mobile
  navigation rendered side by side, or a template repeated per list item. Both get outlined and an
  inline edit fights itself. Render once and restyle responsively where the design allows.
- **An `sr-only` `UniformText`**, used to make a non-visual value editable (a video URL, a
  markdown source), reads the raw value to screen readers in production. Render it in the Edit
  tab only.
- **Editor and draft renders must not be cached.** With `cacheComponents` on the App Router, keep
  the draft and editor branch outside `'use cache'` — the App Router skill's
  [advanced.md](../uniform-nextjs-app-router/references/advanced.md) covers the page shape.
- **A "component not found" fallback must not render in production.** Return `null` there, or
  gate the message on `isContextualEditing`.

## Framework specifics

- **Text, rich text, slot and asset APIs** — props, imports and the Server/Client Component
  split: the App Router skill's [components.md](../uniform-nextjs-app-router/references/components.md)
  and the Page Router skill's [components.md](../uniform-nextjs-page-router/references/components.md).
  Note the App Router `UniformText` is a Client Component: function props such as `placeholder`
  as a function or `render` cannot be passed to it from a Server Component.
- **Flyouts and mega menus** — `inert`, focus and keyboard handling, and why closed panels must
  stay clickable in the editor: the navigation skill's
  [interaction-and-a11y.md](../uniform-navigation/references/interaction-and-a11y.md).
- **Slot placeholders in the content model** — when a slot is layout-critical enough to need
  one: the `uniform-experience-modeling` skill's slot guidance.

## Resources

- [Detecting the editor](references/detecting-the-editor.md) — both signals on both SDKs, Edit
  vs Preview, passing the flag to client components, hydration, verifying against the install
- [Empty states](references/empty-states.md) — hide-when-empty guards, image and video
  placeholders, `UniformText` and `UniformRichText` placeholders, editing non-visual values, links
- [Slot placeholders](references/slot-placeholders.md) — `resolveEmptyPlaceholder` versus
  `emptyPlaceholder`, sizing recipes, labelled placeholders, marker-safe spacing
- [Interactive components](references/interactive-components.md) — carousels, tabs, accordions,
  modals, tooltips: stopping motion, keeping panels mounted, editor controls, following selection
- [Playground tools](references/playground-tools.md) — the playground-only pattern frame on both
  SDKs, clickable editor UI, preview viewports, detecting the playground
- [Review checks](references/review-checks.md) — the check catalog with IDs and fix types, the
  greps that find each gap, the Canvas verification pass, the new-component checklist
- [Reporting and selection](references/review-and-selection.md) — the findings report, the
  checkbox question and its text fallback, when not to ask, applying the selection
