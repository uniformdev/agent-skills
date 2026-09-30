# Interactive components

Components that show one thing at a time, or change on their own: carousels, sliders, tabs,
accordions, FAQs, modals, drawers, tooltips, hotspots, mega-menu panels, countdowns, autoplaying
video, dismissible banners.

Each of them hides authored content behind interaction. In the editor the author has to reach
every item — to click it, type into it, and drop into its slots. The patterns below, from
lightest to heaviest, are how. The gates (`isInCanvas`, `isEditTab`) are defined in
[detecting-the-editor.md](detecting-the-editor.md).

## In the Edit tab, clicks select

Before choosing a pattern, know what the author can and cannot do in the Edit tab. Canvas's script
listens for clicks on the document in the capture phase, stops them before React sees them, and
turns them into a component selection. So in the Edit tab:

- **The component's own controls do nothing when clicked** — carousel arrows and dots, accordion
  toggles, tab buttons, "read more" links. Links do not navigate either.
- **Focus still fires.** Clicking into an inline-editable text focuses it, and `onFocus` handlers
  run — useful for switching to the tab whose label the author is editing.
- **The Preview tab behaves like production**: clicks work, nothing is selected.
- **Editor UI you add is clickable only inside an element marked with
  `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`** — see [editor-only controls](#editor-only-controls).

That is why reachability in the editor has to come from the patterns below — mounting, forcing
open, following the selection, editor controls — and never from "the author can just click the
arrow".

## Keep every item mounted

The foundation for everything else. Render all slides, panels and tabs, and hide the inactive
ones with CSS (`hidden`, a transform, `opacity` plus `visibility`). Do not unmount them:

```tsx
// Wrong: closed content is not in the DOM, and neither are its editor markers
{isOpen && <div className="panel">{content}</div>}

// Wrong: the slot child — markers included — is dropped for inactive tabs
<UniformSlot slot={slots.tabs}>
  {({ child, _id, key }) => (_id === activeId ? <Fragment key={key}>{child}</Fragment> : <Fragment key={key} />)}
</UniformSlot>

// Right: every item is rendered, inactive ones are hidden
<UniformSlot slot={slots.tabs}>
  {({ child, key, slotIndex }) => (
    <div key={key} role="tabpanel" hidden={slotIndex !== activeIndex}>
      {child}
    </div>
  )}
</UniformSlot>
```

Canvas finds components through markers rendered around each slot child. An unmounted item has
none, so selecting it in the component tree does nothing and the author cannot tell why.

Closed panels hidden with `inert` must drop it while in Canvas — `inert` swallows the clicks an
author uses to select. The navigation skill's
[interaction-and-a11y.md](../../uniform-navigation/references/interaction-and-a11y.md) covers this
for flyouts; the same rule applies to every panel.

## Stop motion in the Edit tab

Anything that moves on its own moves away from the author: autoplay, auto-advance timers,
marquee scrolling, countdowns that redirect, entrance animations that replay on every update.

```tsx
// Server → client: pass the gate, not the raw parameter
<CarouselTrack autoplay={Boolean(parameters.autoplay?.value) && !isEditTab(context)} … />
<video autoPlay={autoplay && !isEditTab(context)} muted playsInline … />
```

- **Pause, do not remount.** If the tab can change while the component is mounted (see
  [detecting-the-editor.md](detecting-the-editor.md#when-the-tab-changes)), stop and start the
  timer or the library's autoplay API in an effect keyed on the tab, rather than recreating the
  carousel.
- **The Preview tab keeps real motion.** That is where the author checks it.
- **Dismissible components** — cookie banners, announcement bars, "don't show again" modals —
  store their dismissed state in cookies or storage. Once an author dismisses one inside the
  preview, it disappears from Canvas too. Ignore the stored state in the Edit tab.

## Force open in the Edit tab

For content that still reads with everything open — accordions, FAQs, disclosures, tooltips,
hotspots, read-more blocks:

```tsx
const isOpen = isEditTab || openIndexes.includes(index);
```

- The author sees and edits every panel at once; the Preview tab behaves like production.
- Without it, a closed panel cannot be opened from the page at all in the Edit tab: clicking the
  toggle selects the item instead of toggling it.
- **Tooltips and hotspots** usually cannot all be open at once without covering each other.
  Open one when it or anything inside it is selected — the next pattern.
- **Modals and drawers** cannot be forced open without covering the page. Either open one when
  it or its content is selected, or in the Edit tab render the dialog's content inline under its
  trigger instead of as an overlay.

## Following the Canvas selection

For components that can show only one item at a time — carousels, tabs, mega-menu categories —
switch to the item that holds whatever the author selected, whether they clicked it in the
component tree or on the page.

### What the selection tells you

`selectedComponentReference`, on both SDKs:

| Field | Meaning |
|---|---|
| `id` | The selected component's `_id` |
| `parentId`, `parentType` | Its immediate parent |
| `slotName`, `componentIndex`, `totalComponents` | Its position in the parent's slot |

Two cases:

- **A slide itself is selected** — `parentId` is the carousel's `_id`, and `componentIndex` is
  the slide index.
- **Something inside a slide is selected** — a heading in slide 3. `parentId` is the slide (or
  deeper), so the carousel needs a map from every descendant id to the slide index it sits in.

```ts
import type { ComponentInstance } from "@uniformdev/canvas";

/** Maps every component id inside each slot item to that item's index. */
export function indexDescendants(items: ComponentInstance[] = []): Record<string, number> {
  const map: Record<string, number> = {};
  const visit = (node: ComponentInstance, index: number) => {
    if (node._id) map[node._id] = index;
    for (const children of Object.values(node.slots ?? {})) children?.forEach((child) => visit(child, index));
  };
  items.forEach((item, index) => visit(item, index));
  return map;
}
```

**Do not reset when the selection leaves.** Selecting something outside the carousel should
leave it on the current slide, not snap back to the first one. Act only when the lookup finds an
index.

### Page Router

`useUniformContextualEditingState` is in the SDK. The `global` option decides what it reports:

| | `selectedComponentReference` is set when |
|---|---|
| `global: false` (default) | The selected component is a **direct child** of the component calling the hook. Anything deeper — a heading inside a slide — reports `undefined` |
| `global: true` | Anything anywhere on the page is selected |

Use `global: true` with the descendant map, which covers both cases:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useUniformContextualEditingState, useUniformCurrentComponent } from "@uniformdev/canvas-react";

const { data } = useUniformCurrentComponent();
const { previewMode, selectedComponentReference: selected } = useUniformContextualEditingState({ global: true });
const isEditTab = previewMode === "editor";

const slides = data?.slots?.slides;
const slideOf = useMemo(() => indexDescendants(slides), [slides]);
const [index, setIndex] = useState(0);

useEffect(() => {
  const target = selected ? slideOf[selected.id] : undefined;
  if (target !== undefined) setIndex(target);
}, [selected, slideOf]);
```

### App Router selection hook

The App Router SDK has no equivalent hook, and `useUniformContextualEditingState` from
`canvas-react` silently reports nothing there. The selection still reaches the page: Canvas's
in-context script — which the App Router SDK loads, as the Page Router one does — posts an
`update-contextual-editing-state-internal` message to the page's own window whenever the
selection or the tab changes, and keeps the latest state on
`window.__UNIFORM_CONTEXTUAL_EDITING__.state`. `canvas-react`'s hook is built on exactly that
message. Listen for it with the public channel API from `@uniformdev/canvas` (add it as a direct
dependency if the project does not have one):

```tsx
"use client";

import { useSyncExternalStore } from "react";
import {
  createCanvasChannel,
  isUpdateContextualEditingStateInternalMessage,
  type UpdateContextualEditingStateInternalMessage,
} from "@uniformdev/canvas";

export type CanvasEditorState = UpdateContextualEditingStateInternalMessage["state"];

let latest: CanvasEditorState | undefined;

function subscribe(onChange: () => void) {
  const channel = createCanvasChannel({ broadcastTo: [window], listenTo: [window] });
  const unsubscribe = channel.on("update-contextual-editing-state-internal", (message) => {
    if (!isUpdateContextualEditingStateInternalMessage(message)) return;
    latest = message.state;
    onChange();
  });
  return () => {
    unsubscribe();
    channel.destroy();
  };
}

const getSnapshot = () => latest ?? window.__UNIFORM_CONTEXTUAL_EDITING__?.state;
const getNothing = () => undefined;
const subscribeToNothing = () => () => {};

/**
 * Canvas tab and selection for App Router client components.
 * Pass `context.isContextualEditing` from the server so this does nothing on the live site.
 */
export function useCanvasEditorState(enabled: boolean): CanvasEditorState | undefined {
  return useSyncExternalStore(enabled ? subscribe : subscribeToNothing, enabled ? getSnapshot : getNothing, getNothing);
}
```

- It returns `undefined` on the server and during hydration, so it never causes a mismatch; the
  state arrives after mount.
- **Say what it depends on**, in a comment where it is defined: the message type is named
  `-internal` and the script that sends it is served by Uniform, not shipped in the SDK, so it
  can change without an SDK release. Keep it in this one file, and make the component still
  usable without it — editor controls (below) are the fallback.
- Check it once in Canvas: select a slide in the component tree and confirm the carousel moves.

The descendant map needs the children's data, which the App Router's `slots` prop does not carry.
If the project passes a composition cache to `<UniformComposition>` (the App Router skill's
[advanced.md](../../uniform-nextjs-app-router/references/advanced.md) covers it), a server
component can read its own subtree and send the map to the client — only while editing:

```tsx
// Carousel.tsx — server component
const slideOf = context.isContextualEditing
  ? indexDescendants(
      compositionCache.getUniformComponent({ compositionId: context._id, componentId: component._id })?.slots
        ?.slides,
    )
  : undefined;

return (
  <CarouselTrack carouselId={component._id} slideOf={slideOf} inCanvas={context.isContextualEditing} …>
    <UniformSlot slot={slots.slides}>{({ child, key }) => <div key={key} className="slide">{child}</div>}</UniformSlot>
  </CarouselTrack>
);
```

```tsx
// CarouselTrack.tsx — client component
const editor = useCanvasEditorState(inCanvas);
const selected = editor?.selectedComponentReference;

useEffect(() => {
  if (!selected) return;
  const target = slideOf?.[selected.id] ?? (selected.parentId === carouselId ? selected.componentIndex : undefined);
  if (target !== undefined) setIndex(target);
}, [selected, slideOf, carouselId]);
```

Without a composition cache, the `parentId` fallback still follows selection of the slides
themselves.

## Editor-only controls

The component's own arrows and dots do nothing when clicked in the Edit tab (see
[above](#in-the-edit-tab-clicks-select)). When following the selection is not enough — authors
who work on the page rather than in the component tree, or a component with no selection
support — render a small picker in the Edit tab, marked so Canvas lets its clicks through:

```tsx
import { IS_RENDERED_BY_UNIFORM_ATTRIBUTE } from "@uniformdev/canvas";

{isEditTab && slideCount > 1 && (
  <div className="editor-slide-picker" {...{ [IS_RENDERED_BY_UNIFORM_ATTRIBUTE]: "" }}>
    {Array.from({ length: slideCount }, (_, i) => (
      <button key={i} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
        {i + 1}
      </button>
    ))}
  </div>
)}
```

- **The attribute is what makes it work.** Without it, every click on the picker is turned into a
  selection and `onClick` never runs. Put it on the picker's container — it covers every
  descendant.
- **Never put it on an element that contains authored content** — the slides themselves. Inside a
  marked element nothing can be selected by click or focus, and Canvas stops redrawing its overlay
  for changes there.
- `slideCount` is the **filtered** count — see
  [slot-placeholders.md](slot-placeholders.md#counting-and-branching-on-slot-contents).
- Place it outside the slides so it is never mistaken for authored content, and style it
  unmistakably as editor UI.
- Editor controls and following the selection work well together: selection for authors who work
  in the tree, controls for those who work on the page.

## Tabs whose labels come from the children

A common shape: the tab bar is rendered by the parent, but each label is a text parameter on the
child tab component. The parent reads the labels from child data — so they print as plain strings,
which the author cannot edit in place.

- **Also switch tabs when a label receives focus** in the Edit tab, so clicking a label to edit it
  shows the matching panel.
- To make the label editable from the parent on the App Router, take the child's **real**
  parameter from the composition cache and pass the child as `component`:

  ```tsx
  const child = compositionCache.getUniformComponent({ compositionId: context._id, componentId: tab._id });
  const label = child?.parameters?.label;

  {label && (
    <UniformText
      component={{ _id: tab._id }}
      // Raw parameters are typed `value: unknown`; this one is the child's text parameter.
      parameter={{ ...label, parameterId: "label" } as ComponentParameter<string>}
      placeholder="Tab label"
    />
  )}
  ```

  The SDK attaches the editing marker to that parameter only while editing, so the label is
  editable in Canvas and plain text on the live site.
- **Never construct the marker yourself.** `_contextualEditing: { isEditable: true }` written into a
  hand-built parameter object makes the label `contentEditable` for every visitor.

## Library specifics

- **Keep the carousel library's instance in state, not only a ref**, so an effect that moves it
  runs again once the instance exists.
- **Loop mode** in libraries that clone slides (Swiper) needs the loop-aware method
  (`slideToLoop`); the plain `slideTo` targets the clones.
- **Scroll-based carousels** can be scrolled by the browser itself — when Canvas brings a selected
  element into view, for instance — without their index state knowing. Derive the index from the
  scroll position, not only from clicks.
- **Page Router `wrapperComponent`** must be defined at module scope — an inline wrapper remounts
  the carousel on every update Canvas pushes and sends it back to the first slide. Pass it the
  active index through a context, since its only props are `items` and `slotName`.

## Rendering one instance twice

Desktop and mobile variants rendered side by side and toggled with CSS, or a card template
repeated for each search result, give Canvas two or more editable regions for one component. Canvas
outlines all of them and an inline edit in one fights the other.

Render once and restyle responsively when the design allows. When it does not, make one copy the
editable one and render the others without editing attributes — on the Page Router by overriding
`UniformCompositionContext` with `isContextualEditing: false` around the copies, a technique that
depends on that exported context's shape, so guard it and note why it is there.
