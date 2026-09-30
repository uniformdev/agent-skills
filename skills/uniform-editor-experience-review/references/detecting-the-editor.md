# Detecting the editor

Two questions, answered differently by each SDK:

- **Is this page inside Canvas at all?** Gate *reachability* on this — `inert`, `pointer-events`,
  link navigation, analytics.
- **Is the author in the Edit tab?** Gate *appearance* on this — placeholders, force-opened
  panels, stopped autoplay, editor-only controls. The Preview tab should look like production.

## App Router (`@uniformdev/next-app-router`)

Every component the resolver maps receives a `context` prop, on the server and — when the
resolved component is a Client Component — on the client too. It is plain serialisable data.

| Field | Meaning |
|---|---|
| `context.isContextualEditing` | `true` when the request was rendered for Canvas, in the Edit **or** Preview tab |
| `context.pageState.previewMode` | `'editor'` in the Edit tab, `'preview'` in the Preview tab, `undefined` outside Canvas |
| `context.state` | The composition state number — editor `63`, draft `0`, published `64` |

How the SDK decides, so you can reason about edge cases: the middleware puts the request in editor
state when draft mode is on **and** the `is_incontext_editing_mode` query parameter is present,
and `isContextualEditing` is `pageState.compositionState === CANVAS_EDITOR_STATE`. `previewMode`
is worked out separately and becomes `'preview'` when Canvas tells the page visual editing is
disabled. That is why `isContextualEditing` stays `true` in the Preview tab.

Name the two gates once, next to the components, so every component reads the same way:

```ts
import type { ComponentProps } from "@uniformdev/next-app-router/component";

type CompositionContext = ComponentProps["context"];

/** Inside Canvas, either tab. Gate reachability on this. */
export const isInCanvas = (context: CompositionContext) => context.isContextualEditing;

/** Edit tab only. Gate placeholders, force-open and stopped motion on this. */
export const isEditTab = (context: CompositionContext) =>
  context.isContextualEditing && context.pageState.previewMode === "editor";
```

`CompositionContext` is not re-exported from `@uniformdev/next-app-router/component`; deriving it
from `ComponentProps` avoids a direct dependency on the shared package.

Used in a component (the empty-state rules behind this are in [empty-states.md](empty-states.md)):

```tsx
export const Button = ({ parameters, component, context }: ComponentProps<ButtonParameters>) => {
  const hasLabel = Boolean(parameters.label?.value?.trim());
  const hasIcon = Boolean(parameters.icon?.value?.length);
  if (!hasLabel && !hasIcon && !isEditTab(context)) return null;

  return (
    <button type="button" className="btn">
      {/* icon rendering omitted */}
      <UniformText component={component} parameter={parameters.label!} placeholder="Button label" />
    </button>
  );
};
```

### Server → client

- A Client Component registered in the resolver gets `context` directly and can call the same
  helpers.
- A client *leaf* inside a server component (a carousel's track, an accordion's toggle) should
  get a boolean prop — `isEditing={isEditTab(context)}` — not the whole `context`. It keeps the
  client payload small and the leaf reusable outside Uniform.
- The value is decided on the server per request, so server and client agree and there is no
  hydration mismatch.
- **Do not** detect the editor during render on the client with `window.self !== window.top`,
  `document.referrer` or the query string. The server rendered without that knowledge, so the
  first client render disagrees with it. If a client-only signal is ever needed, read it in
  `useEffect`.

### When the tab changes

`pageState.previewMode` is decided when the request is rendered. For behaviour that must follow
the tab *live* — a carousel that resumes autoplay the moment the author switches to Preview —
read `previewMode` from the selection hook in
[interactive-components.md](interactive-components.md#app-router-selection-hook), which receives
Canvas's messages directly. Check in your own Canvas whether switching tabs reloads the preview;
if it does, the server value is always current and the hook is only needed for selection.

### Caching

Editor and draft requests are rendered per request. With Next.js `cacheComponents`, the
published branch can sit behind `'use cache'`; the editor and draft branch must not. The App
Router skill's [advanced.md](../../uniform-nextjs-app-router/references/advanced.md) has the page
shape.

## Page Router (`@uniformdev/canvas-react`)

| Need | Read |
|---|---|
| In Canvas | `useUniformCurrentComposition().isContextualEditing` |
| Edit vs Preview tab | `useUniformContextualEditingState().previewMode` — `'editor'`, `'preview'` or `undefined` |
| Selected component | `useUniformContextualEditingState({ global }).selectedComponentReference` |

```tsx
import {
  useUniformContextualEditingState,
  useUniformCurrentComposition,
} from "@uniformdev/canvas-react";

export function useEditorGates() {
  const { isContextualEditing } = useUniformCurrentComposition();
  const { previewMode } = useUniformContextualEditingState();
  return { isInCanvas: isContextualEditing, isEditTab: isContextualEditing && previewMode === "editor" };
}
```

Timing matters more here than on the App Router:

- `isContextualEditing` is `Boolean(contextualComposition)` — it becomes `true` once Canvas has
  pushed a composition to the page, **after** hydration. It is `false` during SSR and on the first
  client render.
- `previewMode` and `selectedComponentReference` arrive over a message channel after mount.
- So there is no hydration mismatch, but editor-only UI appears a moment after the page loads.
  Anything that changes layout will shift once in the editor. That is acceptable there; it is the
  reason not to make production layout depend on these values.

The hook's `global` option changes what `selectedComponentReference` means — see
[interactive-components.md](interactive-components.md#following-the-canvas-selection).

## Two related signals

- **In the playground** (a pattern rendered without a page around it): on the App Router,
  `context.matchedRoute === "composition"`; on the Page Router, the playground route itself. Not
  `context.type`. Details: [playground-tools.md](playground-tools.md#telling-a-component-it-is-in-the-playground).
- **Editor UI that must receive clicks**: in the Edit tab Canvas turns clicks into selections
  unless the target sits inside an element carrying `IS_RENDERED_BY_UNIFORM_ATTRIBUTE` from
  `@uniformdev/canvas`. Details:
  [interactive-components.md](interactive-components.md#in-the-edit-tab-clicks-select).

## Confirm against the installed version

These shapes change between releases. Check them in the project before relying on them.

```bash
# Locate the packages (works with npm, pnpm and yarn layouts)
find node_modules -path '*@uniformdev/next-app-router-shared/dist/index.d.ts' -not -path '*/.cache/*' | head -1
find node_modules -path '*@uniformdev/canvas-react/dist/index.d.ts' | head -1

# App Router: the context every component receives, and the previewMode field
awk '/^type CompositionContext = /,/^};/' <next-app-router-shared>/dist/index.d.ts
awk '/^type PageState = /,/^};/' <next-app-router-shared>/dist/index.d.ts | grep -B5 'previewMode'

# Page Router: the editing-state hook's return type, with JSDoc
awk '/^type UseUniformContextualEditingStateReturnType/,/^};/' <canvas-react>/dist/index.d.ts

# Both: placeholder predicate and the channel primitives
grep -n 'declare const isComponentPlaceholderId\|declare const createCanvasChannel\|declare const isUpdateContextualEditingStateInternalMessage' <canvas>/dist/index.d.ts
```

Use a range match (`awk '/start/,/end/'`), not `grep -A N` — a fixed line count silently cuts a
long type short.
