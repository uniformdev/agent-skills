# Setup

## Prerequisites

- **Next.js 16+** (App Router only — this v2 SDK does not support the Page Router)
- **Node.js 22+**
- A Uniform project with compositions

## Quick start

The fastest path is to scaffold a working project:

```bash
npx @uniformdev/cli@latest new
```

Select **Next.js**, then choose the **Component Starter Kit** (full-featured, with pre-built components and TailwindCSS theming) or **Hello World** (minimal reference). The steps below cover manual integration into an existing project.

## Required packages

`@uniformdev/next-app-router` (version `20.58.0` or later) is the only required package — it includes the server SDK, component utilities, middleware, config helpers, and preview handlers:

```bash
npm install @uniformdev/next-app-router@latest
```

If any component renders **assets** (images, video, etc.), also install `@uniformdev/assets` — it provides everything the asset helpers in [components.md](components.md) need in a single import: `imageFrom` (the default for an image `src`) *and* the `AssetParamValue` type.

```bash
npm install @uniformdev/assets@latest
```

For advanced client-side context customization, also install:

```bash
npm install @uniformdev/next-app-router-client@latest @uniformdev/context@latest
```

## Environment variables

It is critical that there is a `.env` or `.env.local` file in the project root. And that it includes the following environment variables.

```bash
UNIFORM_API_KEY=your-api-key
UNIFORM_PROJECT_ID=your-project-id
UNIFORM_PREVIEW_SECRET=your-preview-secret
```

Verify that they are there, or if you do not have permission to check ask the user to confirm. Once confirmed continue with the rest of the setup.

> The Uniform CLI loads `.env.local` first, then `.env`. Either works; `.env.local` is a good place for machine-specific overrides that stay out of source control.

## File structure

```
app/
├── api/
│   └── preview/
│       └── route.ts           # Preview handler (GET) + ISR handler (POST)
├── layout.tsx                 # Root layout (standard Next.js)
├── uniform/
│   └── [code]/
│       └── page.tsx           # Main composition route
└── playground/
    └── [code]/
        └── page.tsx           # Playground route (visual editing)
components/
└── resolveComponent.ts        # Maps Uniform types to React components
middleware.ts                  # Required for edge routing/personalization
uniform.server.config.ts       # Server configuration (optional)
next.config.ts                 # Next.js config with withUniformConfig
```

## Server config

`uniform.server.config.ts` is optional; `withUniformConfig` detects it automatically. If absent, sensible defaults are used.

```ts
import { UniformServerConfig } from "@uniformdev/next-app-router/config";

const config: UniformServerConfig = {
  defaultConsent: true,
  playgroundPath: "/playground",
};

export default config;
```

Full configuration options (with defaults):

```ts
import { UniformServerConfig } from "@uniformdev/next-app-router/config";

const config: UniformServerConfig = {
  // Default storage consent for new visitors (default: false)
  defaultConsent: true,

  // Path to the playground page handler
  playgroundPath: "/playground",

  // Context options
  context: {
    // Disable Uniform Context dev tools in production (default: false)
    disableDevTools: false,
  },

  // Enable quirk serialization (default: true)
  quirkSerialization: true,

  // Enable runtime cache in middleware (default: true)
  middlewareRuntimeCache: true,

  // Experimental features
  experimental: {
    // Enable Vercel Visual Editing support (default: false)
    vercelVisualEditing: false,

    // Retain old route data while fetching new (requires middlewareRuntimeCache)
    disableSwrMiddlewareCache: false,
  },
};

export default config;
```

## next.config.ts

`withUniformConfig` sets up Webpack/Turbopack aliases for the server config. To enable Next.js 16 framework-level caching, add `cacheComponents: true` (see `references/advanced.md`):

```ts
import { withUniformConfig } from "@uniformdev/next-app-router/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // your Next.js config options
  // cacheComponents: true,  // enable Next.js 16 caching (see advanced.md)
};

export default withUniformConfig(nextConfig);
```

## Middleware (required)

Middleware in `middleware.ts` at the project root is required. It resolves routes through the Uniform Route API, evaluates personalization at the edge, and rewrites requests to the composition page handler.

**For Next.js 16, to support Uniform preview in Canvas (and on Vercel):**
1. The file MUST be named `middleware.ts` (not `proxy.ts` or anything else).
2. The config export MUST include `runtime: "experimental-edge"`.

```ts
import { uniformMiddleware } from "@uniformdev/next-app-router/middleware";

export default uniformMiddleware();

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
  runtime: "experimental-edge",
};
```

> **Expected build warning — do not act on it.** `next build`/`next dev` prints `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` Ignore it. Next.js 16's `proxy` convention runs on the Node runtime and **rejects** `runtime: "experimental-edge"` (it throws), but Uniform's edge personalization and Canvas preview require the edge runtime — so `middleware.ts` is the correct, supported file here. Renaming to `proxy.ts` to silence the warning breaks preview.

For locale handling, custom route mapping, injecting quirks, content releases, and other advanced patterns, see [routing.md](routing.md).

## Main composition route

`app/uniform/[code]/page.tsx`. `UniformComposition` resolves the route, wires the client context, and renders the composition:

```tsx
import {
  resolveRouteFromCode,
  UniformComposition,
  UniformPageParameters,
  createUniformStaticParams,
} from "@uniformdev/next-app-router";
import { resolveComponent } from "@/components/resolveComponent";

// Optional: enable ISR (Incremental Static Regeneration)
export const generateStaticParams = async () => {
  return createUniformStaticParams({
    // paths: ["/"],
    // For localized sites, include the locales in the paths
    paths: ["/en"],
  });
};

export default async function UniformPage(props: UniformPageParameters) {
  const { code } = await props.params;
  return (
    <UniformComposition
      code={code}
      resolveRoute={resolveRouteFromCode}
      resolveComponent={resolveComponent}
    />
  );
}
```

Key points about `UniformComposition`:
- It is an async server component that fetches and renders the full composition tree.
- It sets up `UniformContext` internally (wrapped in `Suspense`) — do NOT place `UniformContext` in `layout.tsx`.
- If the route cannot be resolved, it automatically calls `notFound()`.
- Optional props: `clientContextComponent`, `compositionCache`, `dataClient` (see `references/personalization.md` and `references/advanced.md`).

## Playground route

`app/playground/[code]/page.tsx`. Uses the same `resolveComponent` as the main route:

```tsx
import {
  createUniformPlaygroundStaticParams,
  PlaygroundParameters,
  resolvePlaygroundRoute,
  UniformPlayground,
} from "@uniformdev/next-app-router";
import { resolveComponent } from "@/components/resolveComponent";

export const generateStaticParams = async () => {
  return createUniformPlaygroundStaticParams({
    paths: ["/en"],
  });
};

export default async function PlaygroundPage({ params }: PlaygroundParameters) {
  const { code } = await params;
  return (
    <UniformPlayground
      code={code}
      resolveRoute={resolvePlaygroundRoute}
      resolveComponent={resolveComponent}
    />
  );
}
```

## Root layout

`app/layout.tsx` is standard Next.js and does NOT include `UniformContext`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My App",
  description: "My description",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Publishing content

Compositions must be **published** before they render on the standard route. The delivery API that `resolveRouteFromCode` reads returns *published* content only — a freshly created or edited composition is a draft, so the route resolves to `notFound()` (a 404) until it is published. A 404 on a page you just created is almost always unpublished content, not a broken route.

- Publish from the CLI: `uniform canvas composition publish <compositionId>` (there is a matching `unpublish`).
- Or publish from the Uniform Canvas UI.
- The Uniform MCP has **no** publish tool — publishing is always a CLI or UI step.

Drafts are still visible through contextual-editing preview (see [preview.md](preview.md)); the publish requirement applies to plain, non-preview requests.

## Configure Uniform Sync and run the initial "pull"

Definitions and content you create through the Uniform MCP or the Canvas UI live **only in the Uniform project**. Uniform sync prepares the application to work across multiple environments, or multiple developer projects.

The workflow will typically involve a "pull" to update locally serialized files based on the currently authenticated project. Another environment, be it another developer or a higher environment like staging or production would then "push" to update its project to be in line with the expectations in the codebase.

## Configuring the Uniform CLI

Uniform CLI is configured using the `uniform.config.{ts,js}` file in the root of a project.

> Note: this is easy to skip — everything renders without it, so the work silently never reaches git; treat `uniform:pull` as the final step of any content task to ensure Uniform changes are serialized locally.

A good default config for a typical project keeps the sync-everything preset. It has a few adjustments explained below. Give the user some options and ask for their input. This affects the developer workflow, ways of working are often different. Check the Typescript types for comments on each setting.

```ts
import { uniformConfig } from "@uniformdev/cli/config";

export default uniformConfig({
  preset: "all",
  overrides: {
    serializationConfig: {
      mode: "createOrUpdate",
      format: 'json'
    },
  },
  disableEntities: ["policyDocument", "webhook", "workflows"], // team-admin scoped; add others your key can't read
});
```

> **`disableEntities` (not `preset: "none"`):** `preset: "all"` syncs every entity type and will include new entities if they are added. It includes team-scoped ones. A standard developer API key often lacks access to those, and the sync **aborts** partway with `403 Access denied`. Switch off just the inaccessible ones with `disableEntities`. Use `preset: "none"` when you want complete control.

> **`mode: "createOrUpdate"`:** the default `mirror` mode makes the target an exact mirror of the source, which means a `push` **deletes** any entity that isn't present on disk. `createOrUpdate` only creates and updates, never deletes, which is the safe default. Ask the user if they want the `mirror` mode, this stops unused content and definitions from being left and can be useful in development.

> **`format: 'json'`:** the default yaml format can be hard to work with in node without depending on external packages. JSON on the other hand can easily be read and manipulated.


## Primary commands

Setup the primary commands and do an initial `uniform:pull` to setup the initial serialized files.

| Command | Description |
|---------|-------------|
| `uniform sync pull` | Pull online project state into serialized files |
| `uniform sync push` | Push serialized state (files on disk) into a Uniform project |

### Conventional package scripts

```json
{
  "scripts": {
    "uniform:pull": "uniform sync pull",
    "uniform:push": "uniform sync push"
  }
}
```

## Uniform manifest

Next.js App Router does NOT require downloading (pulling) the manifest locally — the SDK fetches it at runtime. Pulling the manifest into a local file (the old Page Router approach) is not recommended for App Router.

You must publish the manifest when you sync manifest definitions. Adding a convenience script to `package.json` is optional:

```json
{
  "scripts": {
    "uniform:push": "uniform sync push",
    "uniform:publish": "uniform context manifest publish"
  }
}
```

Do NOT add the Page Router-only `uniform context manifest download` script.

## Verify it works

These checks confirm the basic setup works correctly.

1. **Build compiles.** `npm run build` succeeds and prints the expected middleware deprecation warning (see [Middleware](#middleware-required)). The route table lists `/uniform/[code]` and `ƒ Proxy (Middleware)`.
2. **A published page renders.** With the dev server running, request a published page route, it should return **200**, and contain your content.
3. **Route resolution is live.** A path with no published composition returns **404**, *not* 500 — the middleware reached the Uniform Route API and got `notFound()`.
4. **Verify preview handler requires secret.** Making a request to `/api/preview` without a secret should return a 401
