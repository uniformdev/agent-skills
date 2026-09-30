# Playground tools

Patterns are edited in the **playground** — the route Canvas opens a pattern in, with no page
around it. A bare pattern sits against a blank page at whatever width the preview happens to be,
with nothing saying what it is. A small frame, rendered only in the playground, fixes that:

- the pattern's component type, so the author knows what they are looking at;
- a container width that suits the component — a card at card width, not stretched across 1440px;
- a width selector, to see the pattern in narrower and wider containers;
- optionally a background or theme switch, for components meant to sit on dark sections.

The frame is authoring UI. It is never rendered in a composition, and never on the live site.

## Widths are not breakpoints

A width selector narrows a `<div>` inside the preview. The preview itself — the iframe — keeps its
width, so **media queries do not change**: `md:` and `lg:` classes and `@media` rules respond to
the iframe, not to the frame. Only container queries (`@container`) respond to the selector.

So be precise about what each tool is for, and say it in the frame's hint text:

| To check | Use |
|---|---|
| How a component fills a narrower or wider container; container-query layouts | The frame's width selector |
| Media-query breakpoints — mobile, tablet, desktop layouts | **Canvas preview viewports**: the device buttons in the preview toolbar, which resize the iframe |

Preview viewports are a project setting. Make them match the design system's breakpoints instead
of the defaults: each is `{ name, icon, width }`, edited in the project settings and serialised as
the `previewViewport` entity, so `uniform canvas preview-viewport pull|push` — or `uniform sync`
when the project syncs them — keeps them in source control next to the design tokens.

## Making the frame's controls clickable

In the Edit tab, Canvas turns every click in the preview into a component selection: its script
listens on the document in the capture phase and stops the event before React sees it. Your
buttons never receive `onClick` unless they sit inside an element carrying
`IS_RENDERED_BY_UNIFORM_ATTRIBUTE` (`data-is-rendered-by-uniform`, from `@uniformdev/canvas`).

- Put the attribute on the frame's **chrome** — the control row, the label, the hint.
- **Never on an ancestor of the pattern.** Everything inside a marked element stops being
  selectable by click or focus, and Canvas ignores changes inside it when it redraws its overlay.

The same applies to editor-only controls inside components — see
[interactive-components.md](interactive-components.md#editor-only-controls).

## App Router

`@uniformdev/next-app-router`'s `UniformPlayground` has no decorator or wrapper prop. It is an async
Server Component, so the playground page wraps it: a client frame receives the playground as
`children`.

```tsx
// components/playground/widths.ts
/** Container widths to preview patterns at — take them from the design system, not from this list. */
export const WIDTHS = { Full: "100%", LG: "1024px", MD: "768px", SM: "640px" } as const;
export type Width = keyof typeof WIDTHS;

/** Width a pattern opens at, by its root component type. */
export const DEFAULT_WIDTH: Record<string, Width> = { card: "SM", button: "SM", testimonial: "MD" };
```

```tsx
// components/playground/PatternFrame.tsx
"use client";

import { useState, type ReactNode } from "react";
import { IS_RENDERED_BY_UNIFORM_ATTRIBUTE } from "@uniformdev/canvas";
import { DEFAULT_WIDTH, WIDTHS, type Width } from "./widths";

// Clicks in Canvas's Edit tab become component selections unless they land inside an element
// carrying this attribute. Put it on the frame's own controls — never on the element that holds
// the pattern, or the pattern stops being selectable.
const chrome = { [IS_RENDERED_BY_UNIFORM_ATTRIBUTE]: "" };

export function PatternFrame({ componentType, children }: { componentType?: string; children: ReactNode }) {
  const [width, setWidth] = useState<Width>((componentType && DEFAULT_WIDTH[componentType]) || "Full");

  return (
    <div style={{ padding: 32, background: "#f4f4f5", minHeight: "100vh" }}>
      <div {...chrome} style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
        {(Object.keys(WIDTHS) as Width[]).map((w) => (
          <button key={w} type="button" aria-pressed={w === width} onClick={() => setWidth(w)}>
            {w}
          </button>
        ))}
        <span>
          {componentType ?? "pattern"} · {WIDTHS[width]}
        </span>
      </div>
      <div style={{ maxWidth: WIDTHS[width], margin: "0 auto", background: "#fff" }}>{children}</div>
      <p {...chrome} style={{ textAlign: "center", fontSize: 12, marginTop: 16 }}>
        Width narrows the pattern&apos;s container. Media-query breakpoints follow the preview&apos;s own
        width — switch them with Canvas&apos;s viewport buttons.
      </p>
    </div>
  );
}
```

```tsx
// app/playground/[code]/page.tsx
import { PlaygroundParameters, resolvePlaygroundRoute, UniformPlayground } from "@uniformdev/next-app-router";
import { PatternFrame } from "@/components/playground/PatternFrame";
import { resolveComponent } from "@/components/resolveComponent";

export default async function PlaygroundPage({ params }: PlaygroundParameters) {
  const { code } = await params;
  // One extra fetch, only to label the frame with the pattern's root component type.
  const { route } = await resolvePlaygroundRoute({ code });
  const componentType = route?.compositionApiResponse.composition.type;

  return (
    <PatternFrame componentType={componentType}>
      <UniformPlayground code={code} resolveRoute={resolvePlaygroundRoute} resolveComponent={resolveComponent} />
    </PatternFrame>
  );
}
```

- **Keep the page's existing props** on `UniformPlayground` — `resolveEmptyPlaceholder`,
  `compositionCache`, a `Suspense` boundary — and add the frame around it.
- **The type costs a fetch.** The playground's `code` holds the pattern id, not its type;
  `resolvePlaygroundRoute` fetches the pattern (uncached) and returns `route: undefined` rather
  than throwing when it cannot. If the label is not worth the request, drop `componentType` and the
  per-type default.
- **Selected width survives edits.** Canvas refreshes the route after each change; the frame is the
  same client component in the same place, so its state is kept.
- `UniformPlayground` renders only in draft mode, so outside Canvas the page shows the SDK's
  message inside the frame.

## Page Router

`@uniformdev/canvas-react`'s `UniformPlayground` takes `decorators` — components that wrap the
rendered pattern and receive its root instance as `data`.

> **Experimental.** The `decorators` prop is marked `@deprecated` with "not stable yet and might be
> changed or removed in a minor release". That marks it as unstable, not as removed: it is the
> SDK's supported way to decorate the playground today. Keep the decorator in one file so a change
> is a one-file fix.

```tsx
// components/playground/PatternFrame.tsx
import { useState, type ReactNode } from "react";
import { EMPTY_COMPOSITION, IS_RENDERED_BY_UNIFORM_ATTRIBUTE } from "@uniformdev/canvas";
import type { UniformPlaygroundDecorator } from "@uniformdev/canvas-react";
import { DEFAULT_WIDTH, WIDTHS, type Width } from "./widths";

const chrome = { [IS_RENDERED_BY_UNIFORM_ATTRIBUTE]: "" };

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

function FrameBody({ componentType, children }: { componentType?: string; children: ReactNode }) {
  const [width, setWidth] = useState<Width>((componentType && DEFAULT_WIDTH[componentType]) || "Full");
  return (
    <div style={{ padding: 32 }}>
      <div {...chrome} style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {(Object.keys(WIDTHS) as Width[]).map((w) => (
          <button key={w} type="button" aria-pressed={w === width} onClick={() => setWidth(w)}>
            {w}
          </button>
        ))}
        <span>
          {componentType ?? "pattern"} · {WIDTHS[width]}
        </span>
      </div>
      <div style={{ maxWidth: WIDTHS[width], margin: "0 auto" }}>{children}</div>
    </div>
  );
}
```

```tsx
// pages/playground.tsx — the path the preview handler's playgroundPath points at
import { UniformPlayground } from "@uniformdev/canvas-react";
import { PatternFrame } from "@/components/playground/PatternFrame";

export default function PlaygroundPage() {
  return <UniformPlayground decorators={[PatternFrame]} behaviorTracking="onLoad" />;
}
```

- **The per-type default needs the key.** The playground renders once with a stand-in composition
  (`EMPTY_COMPOSITION`, type `"_empty_composition_type"`) before Canvas sends the pattern. A frame
  that reads `data.type` into `useState` locks in the stand-in's fallback and never applies the
  per-type width; keying the stateful part by type fixes it. Guard the label the same way.
- **Several decorators**: the first in the array is the innermost wrapper.
- **Decorators always render** — also on a direct visit to the playground outside Canvas. They
  are "playground only" because only the playground route uses them.

## Telling a component it is in the playground

Rarely needed — the frame lives outside the components — but some components have page-only
behaviour (breadcrumbs, a sticky header offset) that makes no sense in a pattern.

| SDK | Signal |
|---|---|
| App Router | `context.matchedRoute === "composition"`. On a real route it is the project map path and starts with `/`. **Not** `context.type`: that is the root component's type, and a composition pattern's root is `page` |
| Page Router | The playground route itself — pass a prop or context from the playground page. The composition context under the playground has no `matchedRoute`, but that is incidental; do not branch on it |

A composition with no project map node is also previewed through the playground, so treat the
signal as "rendered without a page around it", not strictly "this is a pattern".

## Keep it out of search

The playground route is authoring infrastructure. Exclude it from `robots.txt` and the sitemap, and
mark it `noindex`, so a crawler that finds the URL does not index a framed, empty page.
