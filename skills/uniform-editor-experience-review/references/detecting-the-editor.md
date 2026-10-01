# Detecting the editor

How to read the two signals on each SDK: *in Canvas* (either tab) and *Edit tab*. Which one gates
what is in [SKILL.md](../SKILL.md#editor-signals).

## App Router (`@uniformdev/next-app-router`)

Every component the resolver maps receives a `context` prop, on the server and, when the resolved
component is a Client Component, on the client too. It is plain serialisable data.

| Field | Meaning |
|---|---|
| `context.isContextualEditing` | `true` when the request was rendered for Canvas, in the Edit **or** Preview tab |
| `context.pageState.previewMode` | `'editor'` in the Edit tab, `'preview'` in the Preview tab, `undefined` outside Canvas |

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

`CompositionContext` is not exported from `@uniformdev/next-app-router`; deriving it from
`ComponentProps` avoids importing the SDK's internal shared package. A component then gates on the
helper, for example `if (!hasLabel && !hasIcon && !isEditTab(context)) return null;`, following the
rules in [empty-states.md](empty-states.md#hide-when-empty-guards).

### Server → client

- A Client Component registered in the resolver gets `context` directly and can call the same
  helpers.
- A client *leaf* inside a server component (a carousel's track, an accordion's toggle) should
  get a boolean prop, `isEditTab={isEditTab(context)}`, not the whole `context`. It keeps the
  client payload small and the leaf reusable outside Uniform.
- The value is decided on the server per request, so server and client agree and there is no
  hydration mismatch.
- **Do not** detect the editor during render on the client with `window.self !== window.top`,
  `document.referrer` or the query string. The server rendered without that knowledge, so the
  first client render disagrees with it. If a client-only signal is ever needed, read it in
  `useEffect`.

### When the tab changes

The SDK's middleware reads `pageState.previewMode` from the preview URL, and nothing in the SDK
listens for a tab switch; the `router.refresh()` that follows an edit re-renders against the same
URL. The render-time value is enough for placeholders and forced-open panels, and the
[Canvas checklist](review-checks.md#check-in-canvas) confirms it in both tabs. Motion that has to
resume the moment the author switches tabs can also read `previewMode` from the
[selection hook](interactive-components.md#app-router-selection-hook), which receives Canvas's
messages directly.

## Page Router (`@uniformdev/canvas-react`)

One hook returns both signals. Wrap it once:

```tsx
import { useUniformContextualEditingState } from "@uniformdev/canvas-react";

export function useEditorGates() {
  const { isContextualEditing, previewMode } = useUniformContextualEditingState();
  return { isInCanvas: isContextualEditing, isEditTab: isContextualEditing && previewMode === "editor" };
}
```

- `isContextualEditing` becomes `true` once Canvas has pushed a composition to the page, **after**
  hydration. It is `false` during SSR and on the first client render.
- `previewMode` and `selectedComponentReference` arrive over a message channel after mount.
- So there is no hydration mismatch, but editor-only UI appears a moment after the page loads and
  anything that changes layout shifts once in the editor. That is acceptable there, and it is the
  reason not to make production layout depend on these values.

The hook's `global` option changes what `selectedComponentReference` means; see
[interactive-components.md](interactive-components.md#following-the-canvas-selection).

## Confirm against the installed version

Check these shapes in the project before relying on them:

```bash
# Locate the packages (works with npm, pnpm and yarn layouts)
find node_modules -path '*@uniformdev/next-app-router-shared/dist/index.d.ts' -not -path '*/.cache/*' | head -1
find node_modules -path '*@uniformdev/canvas-react/dist/index.d.ts' | head -1

# App Router: the context every component receives, and the previewMode field
awk '/^type CompositionContext = /,/^};/' <next-app-router-shared>/dist/index.d.ts
awk '/^type PageState = /,/^};/' <next-app-router-shared>/dist/index.d.ts | grep -B5 'previewMode'

# Page Router: the editing-state hook's return type, with JSDoc
awk '/^type UseUniformContextualEditingStateReturnType/,/^};/' <canvas-react>/dist/index.d.ts

# Both: placeholder predicate, tree walker and the channel primitives
grep -n 'declare const isComponentPlaceholderId\|declare function walkNodeTree\|declare const createCanvasChannel\|declare const isUpdateContextualEditingStateInternalMessage' <canvas>/dist/index.d.ts
```

Use a range match (`awk '/start/,/end/'`), not `grep -A N`. A fixed line count silently cuts a
long type short.
