---
name: uniform-nextjs-page-router
description: Guides integration of Uniform CMS with Next.js Page Router. Covers project setup, component registration with registerUniformComponent, fetching compositions with withUniformGetServerSideProps, rendering slots and parameters, contextual editing preview, personalization and A/B testing with Uniform Context, and how the Page Router integration differs from the App Router. Use when adding Uniform to a Next.js Page Router project, creating registered Uniform components, or configuring personalization and A/B testing.
license: MIT
metadata:
  author: uniformdev
  version: "0.0.1"
---

# Uniform with Next.js Page Router

Integration guide for wiring Uniform CMS to a Next.js application using the Page Router. The Page Router integration uses `@uniformdev/canvas-next` and `@uniformdev/canvas-react` with SSR via `getServerSideProps`.

## Key differences from App Router

| Aspect | Page Router | App Router |
|--------|------------|-----------|
| Component mapping | `registerUniformComponent()` registry + barrel file | `resolveComponent` function |
| Data fetching | `withUniformGetServerSideProps` in catch-all route | `retrieveRoute` in async server component |
| Imports | `@uniformdev/canvas-next` + `@uniformdev/canvas-react` | `@uniformdev/canvas-next-rsc` |
| Slot rendering | `<UniformSlot name="slotName" />` | `<UniformSlot context={context} data={component} slot={slots.name} />` |
| Text rendering | `<UniformText parameterId="..." placeholder="..." />` | `<UniformText component={component} context={context} parameterId="..." />` |
| Context manifest | Required — download and embed in build | Not needed (handled server-side) |

## Required packages

```
@uniformdev/canvas
@uniformdev/canvas-react
@uniformdev/canvas-next
@uniformdev/context-react
```

## Resources

See `references/` for detailed guidance:
- [Setup](references/setup.md) — Project configuration, composition fetching, component registration pattern
- [Components](references/components.md) — Component registration, typed props, slots, text, rich text, and asset rendering
- [Preview](references/preview.md) — Contextual editing handler, playground page
- [Personalization](references/personalization.md) — Uniform Context setup, manifest download, SSR personalization, A/B testing
