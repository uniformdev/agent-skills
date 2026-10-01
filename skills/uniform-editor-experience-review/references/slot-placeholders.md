# Slot placeholders

## What an empty slot is in the editor

While editing, Canvas puts a **placeholder item** into every empty slot: a component instance
whose `_id` starts with `placeholder`. The SDK renders something for it, wraps it in the same
markers as any other slot child, and Canvas draws its drop target over whatever you rendered.

So the drop target is exactly as big as your placeholder. A slot whose placeholder renders
nothing, or a zero-height `<div>`, is a slot the author cannot drop into from the page.

The two SDKs put the placeholder in different places:

| | App Router | Page Router |
|---|---|---|
| Where | `resolveEmptyPlaceholder` on `<UniformComposition>` **and** `<UniformPlayground>` — once, centrally | `emptyPlaceholder` on each `<UniformSlot>` |
| Input | `{ parentComponent, component, slotName, slotIndex }` | — (you are already in the parent) |
| Returns | `{ component: ComponentType \| null }` | A React node, or `null` |
| Not provided | Placeholder items go through `resolveComponent` like any other component, so whatever it returns for an unmapped type renders in every empty slot | The SDK's default rendering |
| Turned off | `{ component: null }` | `emptyPlaceholder={null}` |

There is no `emptyPlaceholder` prop on the App Router `UniformSlot`.

## App Router: one resolver for the project

Keep it next to `resolveComponent`, keyed by parent component type and then slot name, with a
sized default for everything unlisted. Pass it to both the composition route and the playground
route, because patterns are edited in the playground.

```tsx
import type { CSSProperties } from "react";
import type { UniformCompositionProps } from "@uniformdev/next-app-router";

// The option and result types are not exported by name; derive them.
type ResolveEmptyPlaceholder = NonNullable<UniformCompositionProps["resolveEmptyPlaceholder"]>;
type Placeholder = ReturnType<ResolveEmptyPlaceholder>;

const box = (style: CSSProperties): Placeholder => ({
  component: () => <div style={{ width: "100%", ...style }} />,
});

const bySlot: Record<string, Record<string, Placeholder>> = {
  page: { header: box({ height: 160 }), content: box({ minHeight: "60vh" }), footer: box({ height: 160 }) },
  buttonGroup: { buttons: box({ width: 200, height: 52 }) }, // a row: needs a width
  table: { rows: { component: () => <tr style={{ height: 64 }} /> } }, // must be valid in <tbody>
  card: { media: { component: null } }, // this layout has no media area
};

export const resolveEmptyPlaceholder: ResolveEmptyPlaceholder = ({ parentComponent, slotName }) =>
  bySlot[parentComponent.type]?.[slotName] ?? box({ minHeight: 80 });
```

```tsx
<UniformComposition
  code={code}
  resolveRoute={resolveRouteFromCode}
  resolveComponent={resolveComponent}
  resolveEmptyPlaceholder={resolveEmptyPlaceholder}
/>
```

- **Variants.** `parentComponent` is the full instance, so `parentComponent.variant` is there when
  a slot's shape depends on the parent's variant (a media slot that only exists in the
  two-column variant).
- **The placeholder component receives the usual component props**, including `context`, so it
  can use the Edit-tab gate for labels (below).
- Use the project's styling system; the inline styles are only to keep the example neutral.

## Page Router: per slot

```tsx
<UniformSlot name="content" emptyPlaceholder={<div style={{ minHeight: 120 }} />} />
<UniformSlot name="buttons" emptyPlaceholder={<div style={{ width: 200, height: 52 }} />} />
<UniformSlot name="media" emptyPlaceholder={null} />
```

The SDK renders `emptyPlaceholder` only while editing; visitors never see it.

## Sizing

| Slot shape | Placeholder |
|---|---|
| Vertical content area (page body, section content) | Full width, the height of a typical child; a page body can take most of the viewport |
| Horizontal row (buttons, logos, cards in a row) | Fixed width **and** height, so it occupies a position in the row. Width 100% in a row squeezes its siblings |
| Grid cell | The grid's row height; the grid gives the width |
| Inside table or list markup | An element valid in that parent — `<tr>` in `<tbody>`, `<li>` in `<ul>`. A `<div>` there is invalid nesting: the browser moves it out of the table and React reports a hydration error |
| Media slot | The media's aspect ratio |
| Optional slot with no room in this layout | Off (`null`). The author then adds to it from the component tree, with no drop target on the page |

## Labelled placeholders

A size-only placeholder relies on Canvas's own drop-target UI. When a slot's purpose is not
obvious from its position (a row of actions under a form, a footer column), a short label helps:
a dashed outline and muted text such as "Add buttons or links".

Keep labels short, and keep them out of the Preview tab: on the App Router, render the label only
when `isEditTab(context)`; on the Page Router, only when the hook's `previewMode === "editor"`.

## Counting and branching on slot contents

Because the placeholder is a real item, anything that counts or tests a slot sees it:

- **Filter before counting.** `isComponentPlaceholderId` from `@uniformdev/canvas`, never a
  hand-rolled prefix test. The full recipe is in the navigation skill's
  [slot-data-access.md](../../uniform-navigation/references/slot-data-access.md#technique-4--detect-emptiness-without-counting).
- **A layout that hides an empty region** (an aside column, an actions bar) must still show it in
  the Edit tab, or the author cannot drop the first item in: `hasContent || isEditTab(context)`.
- **Carousel dots, "1 of N" counters and grid column counts** use the filtered count. The
  placeholder itself should render as one slide-sized drop target.

## Spacing that survives the editor markers

While editing, every slot child is wrapped in a pair of `<template>` elements (start and end
markers). They render nothing, but CSS sibling logic counts them:

| Breaks in the editor | Why |
|---|---|
| `:first-child` / `:last-child` / `:nth-child` margin or border resets | The first child is now a `<template>` |
| `space-y-*`, `space-x-*`, `divide-*`, `> * + *` | Margins and borders attach to or skip the markers |
| Child-count selectors (`:only-child`, `:nth-last-child(2)`) | Every item adds at least two marker siblings |

Put `gap` on a flex or grid parent instead. It spaces the rendered boxes and ignores elements
that render nothing. If a border-between-items design needs sibling selectors, draw the border on
each item and hide the first with a class computed from the item's index, not from `:first-child`.

## Wrapping slot items

- **App Router**: `UniformSlot`'s `children` render function receives `{ child, _id, key,
  slotName, slotIndex }`. `child` already includes the markers; wrap it whole and use the `key`
  given. `_id` identifies placeholder items if the wrapper needs to style them differently.
- **Page Router**: `wrapperComponent` receives the rendered `items`. Define it at module scope,
  not inside the parent's render. Canvas pushes a new composition whenever the author changes
  something, and a wrapper defined inline is a new component type on every render, so everything
  under it remounts and loses its state (a carousel jumps back to slide 1). It receives only
  `items` and `slotName`, so state it needs from the parent, such as the active index, goes
  through a React context the parent provides around the `UniformSlot`.
