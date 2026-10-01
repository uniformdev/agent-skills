# Playground tools

Patterns are edited in the **playground**, the route Canvas opens a pattern in, with no page
around it. A small frame rendered only on that route gives each pattern:

- its component type, so the author knows what they are looking at;
- a container width that suits it: a card at card width, not stretched across 1440px;
- a width selector, to see the pattern in narrower and wider containers;
- optionally a background or theme switch, for components meant to sit on dark sections.

The frame wraps the playground route only; compositions never render it.

## Widths are not breakpoints

A width selector narrows a `<div>` inside the preview. The preview iframe itself keeps its
width, so **media queries do not change**: `md:` and `lg:` classes and `@media` rules respond to
the iframe, not to the frame. Only container queries (`@container`) respond to the selector. Say
which tool is for what in the frame's hint text:

| To check | Use |
|---|---|
| How a component fills a narrower or wider container; container-query layouts | The frame's width selector |
| Media-query breakpoints: mobile, tablet, desktop layouts | **Canvas preview viewports**: the device buttons in the preview toolbar, which resize the iframe |

Preview viewports are a project setting, each `{ name, icon, width }`. They should match the
design system's breakpoints rather than the defaults. Read them with
`uniform canvas preview-viewport list`, compare, and report a mismatch to the user. Changing them
is the user's call: in the project settings, or through `uniform canvas preview-viewport` /
`uniform sync` (the `previewViewport` entity) if the project keeps them in source control.

The frame's buttons receive clicks in the Edit tab only inside `IS_RENDERED_BY_UNIFORM_ATTRIBUTE`.
Put it on the frame's chrome (the control row, the label, the hint), never on an ancestor of the
pattern: [interactive-components.md](interactive-components.md#in-the-edit-tab-clicks-select).

## App Router

`@uniformdev/next-app-router`'s `UniformPlayground` has no decorator or wrapper prop. It is an async
Server Component, so the playground page wraps it: a client frame receives the playground as
`children`.

```tsx
// widths.ts
/** Container widths to preview patterns at: "Full" plus the design system's container sizes. */
export const WIDTHS: Record<string, string> = { Full: "100%" };

/** Width a pattern opens at: root component type → a key of WIDTHS. */
export const DEFAULT_WIDTH: Record<string, string> = {};
```

```tsx
// PatternFrame.tsx
"use client";

import { useState, type ReactNode } from "react";
import { IS_RENDERED_BY_UNIFORM_ATTRIBUTE } from "@uniformdev/canvas";
import { DEFAULT_WIDTH, WIDTHS } from "./widths";

// Canvas lets Edit-tab clicks through only inside this attribute. Keep it on the frame's own
// controls, never on the element that holds the pattern.
const chrome = { [IS_RENDERED_BY_UNIFORM_ATTRIBUTE]: "" };

export function PatternFrame({ componentType, children }: { componentType?: string; children: ReactNode }) {
  const [width, setWidth] = useState((componentType && DEFAULT_WIDTH[componentType]) || "Full");

  return (
    <div>
      <div {...chrome}>
        {Object.keys(WIDTHS).map((w) => (
          <button key={w} type="button" aria-pressed={w === width} onClick={() => setWidth(w)}>
            {w}
          </button>
        ))}
        <span>
          {componentType ?? "pattern"} · {WIDTHS[width]}
        </span>
      </div>
      <div style={{ maxWidth: WIDTHS[width], margin: "0 auto" }}>{children}</div>
      <p {...chrome}>
        Width narrows the pattern&apos;s container. Media-query breakpoints follow the preview&apos;s own
        width — switch them with Canvas&apos;s viewport buttons.
      </p>
    </div>
  );
}
```

In the playground page, keep everything the page already has (its other exports and every prop on
`UniformPlayground`, `resolveEmptyPlaceholder` included) and add the frame around it:

```tsx
// The playground page
import { resolvePlaygroundRoute } from "@uniformdev/next-app-router";
import { PatternFrame } from "<path>/PatternFrame";

// …inside the existing page component, after `const { code } = await params;`
// One extra fetch, only to label the frame with the pattern's root component type.
const { route } = await resolvePlaygroundRoute({ code });
const componentType = route?.compositionApiResponse.composition.type;

return (
  <PatternFrame componentType={componentType}>
    <UniformPlayground code={code} /* …the props the page already passes */ />
  </PatternFrame>
);
```

- **The type costs a fetch.** `UniformPlayground` resolves the pattern itself and ignores a
  `resolveRoute` prop, so the frame makes its own call. `resolvePlaygroundRoute` fetches with
  `cache: 'no-cache'` and returns `route: undefined` when the fetch fails or finds nothing; it
  throws only if `code` cannot be decoded. If the label is not worth the request, drop
  `componentType` and the per-type default.
- **Selected width survives edits.** Canvas refreshes the route after each change; the frame is the
  same client component in the same place, so its state is kept.
- The SDK serves the playground only in draft mode, so visitors do not reach the frame.

## Page Router

`@uniformdev/canvas-react`'s `UniformPlayground` takes `decorators` — components that wrap the
rendered pattern and receive its root instance as `data`.

> **Experimental.** The prop's JSDoc reads: "@deprecated This feature is not stable yet and might
> be changed or removed in a minor release. Do not use it in production environments." It is
> still the SDK's only way to decorate the playground. Keep the decorator in one file so a change
> is a one-file fix, and name the dependency when offering the frame
> ([review-and-selection.md](review-and-selection.md#asking-which-fixes-to-apply)).

The frame body is the App Router `PatternFrame` above, saved as `FrameBody.tsx` with the same
`widths.ts`. The decorator only reads the pattern's type and keys the frame by it:

```tsx
// PatternFrame.tsx (Page Router)
import { EMPTY_COMPOSITION } from "@uniformdev/canvas";
import type { UniformPlaygroundDecorator } from "@uniformdev/canvas-react";
import { FrameBody } from "./FrameBody";

// The playground first renders with a stand-in composition while Canvas sends the pattern.
// Keying the frame by type re-runs its initial state once the real type arrives.
export const PatternFrame: UniformPlaygroundDecorator = ({ children, data }) => {
  const componentType = data.type === EMPTY_COMPOSITION.type ? undefined : data.type;
  return (
    <FrameBody key={componentType ?? "pending"} componentType={componentType}>
      {children}
    </FrameBody>
  );
};
```

```tsx
// The playground page: the path the preview handler's playgroundPath points at
import { UniformPlayground } from "@uniformdev/canvas-react";
import { PatternFrame } from "<path>/PatternFrame";

export default function PlaygroundPage() {
  // Also pass the project's contextualEditingDefaultPlaceholder here if <UniformComposition> sets one.
  return <UniformPlayground decorators={[PatternFrame]} behaviorTracking="onLoad" />;
}
```

- **The per-type default needs the key.** The playground renders once with a stand-in composition
  (`EMPTY_COMPOSITION`, type `"_empty_composition_type"`) before Canvas sends the pattern. A frame
  that reads `data.type` into `useState` locks in the stand-in's fallback and never applies the
  per-type width; keying the stateful part by type fixes it. Guard the label the same way.
- **Decorators always render**, also on a direct visit to the playground outside Canvas. They are
  "playground only" because only the playground route uses them.
