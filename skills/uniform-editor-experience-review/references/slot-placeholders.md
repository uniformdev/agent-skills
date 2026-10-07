# Slot placeholders

## What an empty slot is in the editor

While editing, Canvas puts a **placeholder item** into every empty slot: a component instance
whose `_id` starts with `placeholder`. The SDK renders something for it and wraps it in the same
markers as any other slot child. In the Edit tab, Canvas hides what you rendered and draws its own
drop target over its box, with a minimum size and a label naming the parent component and the
slot.

So the placeholder only has to reserve the space the first item will take. With no box at all
there is no drop target, and a box with no height gets a target drawn over the content below it.

The two SDKs put the placeholder in different places:

| | App Router | Page Router |
|---|---|---|
| Where | `resolveEmptyPlaceholder` on `<UniformComposition>` **and** `<UniformPlayground>` — once, centrally | `emptyPlaceholder` on each `<UniformSlot>` |
| Input | `{ parentComponent, component, slotName, slotIndex }` | — (you are already in the parent) |
| Returns | `{ component: ComponentType \| null }` | A React node, or `null` |
| Not provided | Placeholder items go through `resolveComponent` like any other component, so whatever it returns for an unmapped type renders in every empty slot | Placeholder items go through `resolveRenderer`, and whatever it returns renders in every empty slot |
| Turned off | `{ component: null }` | `emptyPlaceholder={null}` |

The API itself is covered under "Empty slots in the editor" in the `uniform-nextjs-app-router` and
`uniform-nextjs-page-router` skills, if installed. This file covers sizing.

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

// Parent component type → slot name → placeholder, filled in from the project's component
// definitions and sized per the table below. Each entry is one of:
//   box({ minHeight: … })                    a vertical slot
//   box({ width: …, height: … })             a slot in a row
//   { component: () => <tr style={…} /> }    a slot inside table markup
//   { component: null }                      an optional slot the layout has no room for
const bySlot: Record<string, Record<string, Placeholder>> = {};

// Anything unlisted gets roughly the height of a typical child in the project.
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
- **Only the size matters.** Canvas hides the rendered element in the Edit tab, so use the
  project's styling system for dimensions and skip colours, borders and text.

## Page Router: per slot

```tsx
// A vertical slot: about the height of a typical child
<UniformSlot name={slotName} emptyPlaceholder={<div style={{ minHeight: 120 }} />} />
// A slot in a row: a width as well as a height
<UniformSlot name={slotName} emptyPlaceholder={<div style={{ width: 200, height: 52 }} />} />
// An optional slot the layout has no room for
<UniformSlot name={slotName} emptyPlaceholder={null} />
```

The SDK renders `emptyPlaceholder` only while editing, and only in place of what the resolver
rendered for the placeholder item: if `resolveRenderer` returns nothing for it, the slot gets no
drop target at all.

## Sizing

| Slot shape | Placeholder |
|---|---|
| Vertical content area (page body, section content) | Full width, the height of a typical child; a page body can take most of the viewport |
| Horizontal row (buttons, logos, cards in a row) | Fixed width **and** height, so it occupies a position in the row. Width 100% in a row squeezes its siblings |
| Grid cell | The grid's row height; the grid gives the width |
| Inside table or list markup | An element valid in that parent — `<tr>` in `<tbody>`, `<li>` in `<ul>`. A `<div>` there is invalid nesting: the browser moves it out of the table and React reports a hydration error |
| Media slot | The media's aspect ratio |
| Optional slot with no room in this layout | Off (`null`). The author then adds to it from the component tree, with no drop target on the page |

## Counting and branching on slot contents

Because the placeholder is a real item, anything that counts or tests a slot sees it:

- **Filter before counting** with `isComponentPlaceholderId` from `@uniformdev/canvas`, the
  predicate the SDKs use themselves. It handles an item without an `_id` and matches both id
  forms, `placeholder` and `placeholder_…`; a hand-rolled `startsWith("placeholder_")` misses the
  first. Guard the item itself too, since slot items are nullable:
  `items.filter((item) => item && !isComponentPlaceholderId(item._id))`.
- **A layout that hides an empty region** (an aside column, an actions bar) must still show it in
  the Edit tab, or the author cannot drop the first item in: `hasContent || isEditTab(context)`.
- **Carousel dots, "1 of N" counters and grid column counts** use the filtered count. The
  placeholder itself should render as one slide-sized drop target.

## Spacing that survives the editor markers

While editing, the SDK wraps every slot child in a pair of `<template>` elements (start and end
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
