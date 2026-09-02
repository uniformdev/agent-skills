---
name: uniform-nextjs-app-router
description: Guides integration of Uniform CMS with Next.js App Router using the @uniformdev/next-app-router v2 SDK and React Server Components. Covers project setup, environment variables, required edge middleware and advanced routing, the uniform/[code] composition route, component mapping with resolveComponent, rendering slots and parameters, asset handling, client-side personalization with quirks and scores, contextual editing preview, Next.js 16 cacheComponents, composition data enhancement, and adapter compatibility mode. Use when adding Uniform to a Next.js 16 App Router project, creating Uniform-powered React server components, or configuring live preview, personalization, and caching.
license: MIT
metadata:
  author: uniformdev
  version: "1.1.1"
---

# Uniform with Next.js App Router

Integration guide for wiring Uniform CMS to a Next.js application using the App Router. The integration uses React Server Components and the `@uniformdev/next-app-router` package (the **v2** SDK, version `20.58.0` or later).

## Requirements

- **Next.js 16+** and **App Router only** (this v2 SDK does not support the Page Router).
- **Node.js 22+**.
- A Uniform project with compositions.
- On Next.js 15 + Page Router, use the Page Router SDK instead. Migrating Page Router → App Router? Contact Uniform support.

## Quick start

Scaffold a working project instead of integrating from scratch:

```bash
npx @uniformdev/cli@latest new
```

Select **Next.js**, then the **Component Starter Kit** (full-featured) or **Hello World** (minimal). Otherwise follow the manual setup in [references/setup.md](references/setup.md).

## Required packages

`@uniformdev/next-app-router` (version `20.58.0`+), `@uniformdev/canvas` and  `@uniformdev/cli`. For advanced client-side context customization, also add `@uniformdev/next-app-router-client` and `@uniformdev/context`.

## Architecture essentials

- **Middleware is required.** It resolves the route via the Uniform Route API, evaluates personalization/A/B tests at the edge, and rewrites the request to `/uniform/[code]` (where `code` is serialized page state). For Next.js 16, the file MUST be named `middleware.ts` and the config export MUST include `runtime: "experimental-edge"`. Next.js 16.2+ prints a build warning recommending renaming to `proxy.ts` — ignore it and keep `middleware.ts`: `proxy.ts` does not support the edge runtime Uniform requires (renaming fails the build with "Proxy does not support Edge runtime"). The deprecation warning is harmless.
- **The composition route is `app/uniform/[code]/page.tsx`**, not a catch-all. `UniformComposition` fetches and renders the tree, sets up `UniformContext` internally (in `Suspense`), and calls `notFound()` if the route can't resolve.
- **Do NOT place `UniformContext` in `layout.tsx`.** It's handled by `UniformComposition`.
- **Parameters are accessed via the `parameters` object** (`parameters: { title }`), each wrapped in `ComponentParameter<T>` and marked optional.
- **The manifest is fetched at runtime** — no local download needed. Publish it (`uniform context manifest publish`) when you sync manifest definitions; the npm script is optional.
- **Enable `cacheComponents`** (Next.js 16) and import `resolveRouteFromCode` from `@uniformdev/next-app-router/cache` for static-like performance and automatic cache invalidation.

## Key differences from Page Router

| Aspect | App Router (`@uniformdev/next-app-router`) | Page Router |
|--------|-------------------------------------------|-------------|
| Component mapping | `resolveComponent` function | `registerUniformComponent()` registry |
| Routing | `middleware.ts` → `uniform/[code]` route | `withUniformGetServerSideProps` |
| Data fetching | `resolveRouteFromCode` / `createUniformStaticParams` | `getServerSideProps` wrapper |
| Parameter access | `parameters` object, wrapped in `ComponentParameter<T>` | direct prop / registry value |
| Text rendering | `<UniformText component={component} parameter={title} />` | `<UniformText parameterId="..." />` |
| Context manifest | fetched at runtime; publish optional/CLI | manifest download into build |

## Import paths

| Category | Exports | Import path |
|----------|---------|-------------|
| Core | `UniformComposition`, `UniformContext`, `UniformPlayground`, `resolveRouteFromCode`, `resolvePlaygroundRoute`, `precomputeComposition`, `createUniformStaticParams`, `createCompositionCache`, `ResolveComponentFunction`, `ResolveComponentResult` | `@uniformdev/next-app-router` |
| Routing / Data | `findRouteMatch`, `CustomRoute`, `DefaultDataClient`, `EnhanceRouteOptions` | `@uniformdev/next-app-router` |
| Cache | `resolveRouteFromCode` (wrapped in `'use cache'`) | `@uniformdev/next-app-router/cache` |
| Compat | `createAdapterResolveComponentFunction`, `ResolveComponentResultWithType`, `UniformText`, `UniformSlot` | `@uniformdev/next-app-router/compat` |
| Clients | `getCanvasClient`, `getRouteClient`, `getManifest`, `getManifestClient`, `getProjectMapClient` | `@uniformdev/next-app-router` |
| Components | `UniformSlot`, `UniformText`, `UniformRichText`, `getUniformSlot` | `@uniformdev/next-app-router/component` |
| Types | `ComponentProps`, `ComponentParameter`, `ComponentContext` | `@uniformdev/next-app-router/component` |
| Hooks | `useUniformContext`, `useQuirks`, `useScores` | `@uniformdev/next-app-router/component` |
| Middleware | `uniformMiddleware`, `handleUniformRoute` | `@uniformdev/next-app-router/middleware` |
| Config | `withUniformConfig`, `UniformServerConfig` | `@uniformdev/next-app-router/config` |
| Handlers | `createPreviewGETRouteHandler`, `createPreviewPOSTRouteHandler`, `createPreviewOPTIONSRouteHandler` | `@uniformdev/next-app-router/handler` |
| Client context | `createClientUniformContext`, `useInitUniformContext`, `ClientContextComponent` | `@uniformdev/next-app-router-client` |
| Canvas | `enhance`, `EnhancerBuilder`, `ASSETS_SOURCE_*`, `LinkParamValue`, `RichTextParamValue` | `@uniformdev/canvas` |
| Assets | `imageFrom` (default for an image `src`), `AssetParamValue`, `AssetParamValueItem`, `AssetClient` | `@uniformdev/assets` |

## Resources

See `references/` for detailed guidance:
- [Setup](references/setup.md) — Prerequisites, env vars, packages, file structure, server config, `next.config.ts`, basic middleware, composition and playground routes, manifest
- [Routing](references/routing.md) — Advanced middleware: `handleUniformRoute`, quirks injection, locale handling, custom route mapping, query keys, moving the page, matcher scoping, consent, releases
- [Components](references/components.md) — `resolveComponent`, typed parameters, `UniformText`/`UniformRichText` props, slots, assets, and type definitions
- [Personalization](references/personalization.md) — Client context, `useQuirks`/`useScores` hooks, custom client context component, server-side precomputation, Vercel geo-IP quirks
- [Advanced](references/advanced.md) — Next.js 16 `cacheComponents`, suspense/streaming, enhancing composition data, composition cache, adapter compatibility mode, server clients
- [Preview](references/preview.md) — Contextual editing handler (GET) and ISR handler (POST), playground route
