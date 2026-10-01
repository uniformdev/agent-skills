# Interactive components

Components that show one thing at a time, or change on their own: carousels, sliders, tabs,
accordions, FAQs, modals, drawers, tooltips, hotspots, mega-menu panels, countdowns, autoplaying
video, dismissible banners. The gates (`isInCanvas`, `isEditTab`) are defined in
[detecting-the-editor.md](detecting-the-editor.md).

## In the Edit tab, clicks select

In the Edit tab, Canvas's script catches clicks on the document in the capture phase, stops them
before React sees them, and turns them into a component selection:

- **The component's own controls do nothing when clicked**: carousel arrows and dots, accordion
  toggles, tab buttons, "read more" links. Links do not navigate either.
- **Only clicks are caught.** Pointer, touch and keyboard events still reach the component, so a
  swipeable carousel still moves. Focus fires too: clicking into inline-editable text runs
  `onFocus` handlers.
- **The Preview tab behaves like production**: clicks work, nothing is selected.
- **Editor UI you add receives clicks only inside an element marked with
  `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`**. See [editor-only controls](#editor-only-controls).

## Keep every item mounted

Render all slides, panels and tabs, and hide the inactive ones with CSS (`hidden`, a transform,
`opacity` plus `visibility`). Canvas finds components through the markers around each slot child;
an unmounted item has none, so selecting it in the component tree does nothing and the author
cannot tell why.

```tsx
// Wrong: closed content is not in the DOM, and neither are its editor markers
{isOpen && <div>{content}</div>}

// Wrong (App Router UniformSlot): the slot child, markers included, is dropped for inactive tabs
<UniformSlot slot={slots.tabs}>
  {({ child, _id, key }) => (_id === activeId ? <Fragment key={key}>{child}</Fragment> : <Fragment key={key} />)}
</UniformSlot>

// Right (App Router UniformSlot): every item is rendered, inactive ones are hidden
<UniformSlot slot={slots.tabs}>
  {({ child, key, slotIndex }) => (
    <div key={key} role="tabpanel" hidden={slotIndex !== activeIndex}>
      {child}
    </div>
  )}
</UniformSlot>
```

On the Page Router, do the same in a module-scope `wrapperComponent`:
[slot-placeholders.md](slot-placeholders.md#wrapping-slot-items). On the App Router, a client
component that receives `<UniformSlot>` as `children` gets one child per slot item, because
`UniformSlot` returns an array; wrap each one from `Children.toArray(children)`.

A hidden item can be selected in the component tree but not clicked on the page, so pair this
with one of the patterns below. Closed panels hidden with `inert` must also drop it while in
Canvas, because `inert` swallows the clicks an author uses to select; the navigation skill's
[interaction-and-a11y.md](../../uniform-navigation/references/interaction-and-a11y.md) covers this
for flyouts.

## Stop motion in the Edit tab

Autoplay, auto-advance timers, marquee scrolling, countdowns that redirect and entrance animations
that replay on every update all move content away from the author.

```tsx
// Server → client: pass the gate, not the raw parameter
<CarouselTrack autoplay={Boolean(parameters.autoplay?.value) && !isEditTab(context)} … />
<video autoPlay={autoplay && !isEditTab(context)} muted playsInline … />
```

- **Pause, do not remount.** If the tab can change while the component is mounted (see
  [detecting-the-editor.md](detecting-the-editor.md#when-the-tab-changes)), stop and start the
  timer or the library's autoplay API in an effect keyed on the tab, rather than recreating the
  carousel.
- **The Preview tab keeps real motion.**
- **Dismissible components** (cookie banners, announcement bars, "don't show again" modals) keep
  their dismissed state in cookies or storage. Once an author dismisses one inside the preview, it
  disappears from Canvas too. Ignore the stored state in the Edit tab.

## Force open in the Edit tab

For content that still reads with every panel open: accordions, FAQs, disclosures, read-more
blocks.

```tsx
const isOpen = isEditTab || openIndexes.includes(index);
```

Without it, a closed panel cannot be opened from the page in the Edit tab: clicking the toggle
selects the item instead of toggling it.

Tooltips, hotspots, modals and drawers cannot all be open at once without covering the page. Open
one when it, or anything inside it, is selected (the next pattern). A modal can instead render its
content inline under its trigger in the Edit tab.

## Following the Canvas selection

For components that can show only one item at a time (carousels, tabs, mega-menu categories,
tooltips, hotspots, modals), switch to the item that holds whatever the author selected, in the
component tree or on the page.

### What the selection tells you

`selectedComponentReference` is the same object on both SDKs. The fields this pattern uses:

| Field | Meaning |
|---|---|
| `id` | The selected component's `_id` |
| `parentId`, `parentType` | Its immediate parent |
| `slotName`, `componentIndex`, `totalComponents` | Its position in the parent's slot |

Two cases:

- **A slide itself is selected.** `parentId` is the carousel's `_id`, and `componentIndex` is
  the slide index.
- **Something inside a slide is selected**, such as a heading in slide 3. `parentId` is the slide
  or something deeper, so the carousel needs a map from every descendant id to its slide index.
  `walkNodeTree` from `@uniformdev/canvas` builds it:

```ts
import { walkNodeTree, type ComponentInstance } from "@uniformdev/canvas";

/** Maps every component id inside `parent`'s `slotName` slot to the index of the slot item that holds it. */
export function indexDescendants(parent: ComponentInstance | null | undefined, slotName: string) {
  const map: Record<string, number> = {};
  if (!parent) return map;
  walkNodeTree(parent, ({ type, node, ancestorsAndSelf }) => {
    // ancestorsAndSelf[0] is this node and the last entry is `parent`, so the one before it is the slot item.
    const item = ancestorsAndSelf[ancestorsAndSelf.length - 2];
    if (type === "component" && node._id && item?.type === "slot" && item.parentSlot === slotName) {
      map[node._id] = item.parentSlotIndexFn();
    }
  });
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
const { selectedComponentReference: selected } = useUniformContextualEditingState({ global: true });

const slideOf = useMemo(() => indexDescendants(data, "slides"), [data]);
const [index, setIndex] = useState(0);

useEffect(() => {
  const target = selected ? slideOf[selected.id] : undefined;
  if (target !== undefined) setIndex(target);
}, [selected, slideOf]);
```

### App Router selection hook

The App Router SDK has no equivalent hook. `useUniformContextualEditingState` from `canvas-react`
reads a React context the App Router SDK never provides, so it reports `isContextualEditing:
false` and no selection, with no error.

Canvas's in-context script, which both SDKs load, posts an
`update-contextual-editing-state-internal` message to the page's window whenever the selection or
the tab changes, and keeps the latest state on `window.__UNIFORM_CONTEXTUAL_EDITING__.state`.
`canvas-react`'s hook reads the same two. Listen with the channel API from `@uniformdev/canvas`;
if the project does not depend on it directly, add it at the same version as its other
`@uniformdev` packages ([uniform-sdk](../../uniform-sdk/SKILL.md#pin-all-uniform-packages-to-the-same-version)):

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
- **It depends on an internal message.** The type is named `-internal`, and the script that sends
  it is served by Uniform, not shipped in the SDK, so it can change without an SDK release. Say so
  in a comment where the hook is defined, keep it in this one file, and keep the component usable
  if the message changes: the editor controls below still work. The review offers this pattern
  with that trade-off named ([review-and-selection.md](review-and-selection.md#asking-which-fixes-to-apply)).
- Check it once in Canvas: select a slide in the component tree and confirm the carousel moves.

The descendant map needs the children's data, which the App Router's `slots` prop does not carry.
If the project passes a composition cache to `<UniformComposition>` (the App Router skill's
[advanced.md](../../uniform-nextjs-app-router/references/advanced.md) covers it), a server
component can read its own subtree and send the map to the client, only while in Canvas:

```tsx
// Carousel.tsx — server component
const slideOf = context.isContextualEditing
  ? indexDescendants(
      compositionCache.getUniformComponent({ compositionId: context._id, componentId: component._id }),
      "slides",
    )
  : undefined;

return (
  <CarouselTrack carouselId={component._id} slideOf={slideOf} inCanvas={context.isContextualEditing} …>
    <UniformSlot slot={slots.slides}>{({ child, key }) => <div key={key}>{child}</div>}</UniformSlot>
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

For authors who work on the page rather than in the component tree, add a small picker in the Edit
tab and mark it so Canvas lets its clicks through. It adds to following the selection and does not
replace it: with a picker alone, selecting a slide in the component tree still shows nothing.

```tsx
import { IS_RENDERED_BY_UNIFORM_ATTRIBUTE } from "@uniformdev/canvas";

{isEditTab && slideCount > 1 && (
  <div {...{ [IS_RENDERED_BY_UNIFORM_ATTRIBUTE]: "" }}>
    {Array.from({ length: slideCount }, (_, i) => (
      <button key={i} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
        {i + 1}
      </button>
    ))}
  </div>
)}
```

- **Put the attribute on the picker's container.** It covers every descendant. Without it, every
  click on the picker becomes a selection and `onClick` never runs.
- **Never put it on an element that contains authored content**, such as the slides. Inside a
  marked element nothing can be selected by click or focus, and Canvas stops redrawing its overlay
  for changes there.
- `slideCount` is the **filtered** count:
  [slot-placeholders.md](slot-placeholders.md#counting-and-branching-on-slot-contents).
- Place it outside the slides so it is never mistaken for authored content, and style it
  unmistakably as editor UI.

## Tabs whose labels come from the children

A common shape: the parent renders the tab bar from a text parameter on each child tab component,
so the labels print as plain strings the author cannot click to edit. Use one of the navigation
skill's two answers
([interaction-and-a11y.md](../../uniform-navigation/references/interaction-and-a11y.md#in-the-visual-editor)):
render the label through the slot as well, or keep the plain string and tell authors the labels
are edited from the component tree. When the label does render through `UniformText`, also switch
tabs when it receives focus in the Edit tab, so clicking a label to edit it shows its panel.

**Never make the string editable by building the marker yourself.** The SDK attaches
`_contextualEditing` to parameters only in editor renders; `_contextualEditing: { isEditable: true }`
written into a hand-built parameter object makes the label `contentEditable` for every visitor.
