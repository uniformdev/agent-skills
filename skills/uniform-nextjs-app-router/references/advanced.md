# Advanced

## Enabling Cache Components (Next.js 16)

Next.js 16 Cache Components let the framework cache the result of server-side calls. The SDK ships a cache-enabled `resolveRouteFromCode` that wraps route resolution in `'use cache'`, so repeat requests for the same page state are served from cache without additional Uniform API calls. This delivers static-like performance, flicker-free edge-resolved personalization, and automatic cache invalidation via Next.js cache tags when you publish in Uniform.

### Step 1 — enable `cacheComponents`

```ts
// next.config.ts
import { withUniformConfig } from "@uniformdev/next-app-router/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default withUniformConfig(nextConfig);
```

### Step 2 — import `resolveRouteFromCode` from the cache path

Only the import path changes; the page component is otherwise identical:

```tsx
// Before (no caching):
// import { resolveRouteFromCode } from "@uniformdev/next-app-router";

// After (with use cache):
import { resolveRouteFromCode } from "@uniformdev/next-app-router/cache";
```

In development mode, caching is disabled so you always see fresh data. Cache is also bypassed when draft mode or in-context editing is active.

## Suspense and streaming

Wrap individual components in a `Suspense` boundary via the `suspense` field of the `resolveComponent` result. The page shell renders immediately while slower components stream in — useful for components that fetch additional data during server rendering:

```tsx
export const resolveComponent: ResolveComponentFunction = ({ component }) => {
  if (component.type === "hero") {
    return {
      component: HeroComponent,
      suspense: {
        fallback: () => <div className="h-64 animate-pulse bg-gray-200" />,
      },
    };
  }
  if (component.type === "page") {
    return { component: PageComponent };
  }
  return { component: ({ type }) => <div>Component not found: {type}</div> };
};
```

## Enhancing composition data

To adjust content or structure, or fetch additional data, create a custom data client extending `DefaultDataClient`. Keep a single shared instance (e.g. `lib/dataClient.ts`) and pass the **same instance** to both the middleware handler and `UniformComposition`:

```tsx
import {
  DefaultDataClient,
  EnhanceRouteOptions,
} from "@uniformdev/next-app-router";
import { enhance, EnhancerBuilder } from "@uniformdev/canvas";

export class CustomDataClient extends DefaultDataClient {
  protected override async enhanceRoute(
    options: EnhanceRouteOptions
  ): Promise<void> {
    // Do not enhance in middleware unless it would create new runnable
    // (test / personalization) components.
    if (options.source === "middleware") return;

    enhance({
      composition: options.route.compositionApiResponse.composition,
      enhancers: new EnhancerBuilder(),
      context: {},
    });
  }
}
```

```tsx
// middleware.ts
import { handleUniformRoute } from "@uniformdev/next-app-router/middleware";
import { CustomDataClient } from "@/lib/dataClient";

export default (request: NextRequest) => {
  return handleUniformRoute({ request, dataClient: new CustomDataClient() });
};
```

```tsx
// app/uniform/[code]/page.tsx
import { CustomDataClient } from "@/lib/dataClient";

export default async function UniformPage(props: UniformPageParameters) {
  const { code } = await props.params;
  return (
    <UniformComposition
      code={code}
      resolveRoute={resolveRouteFromCode}
      resolveComponent={resolveComponent}
      dataClient={new CustomDataClient()}
    />
  );
}
```

## Composition cache

The composition cache provides server-side access to full `ComponentInstance` data within any component. Use it to read composition-level content (metadata parameters, page title) or inspect whole slot contents instead of only rendering slot children.

Create the cache once (e.g. `lib/cache.ts`):

```tsx
import { createCompositionCache } from "@uniformdev/next-app-router";

export const compositionCache = createCompositionCache();
```

Pass it to `UniformComposition`:

> **`compositionCache` is an optional prop, and forgetting it fails silently.** Omitting it
> is not a type error — the cache simply never receives the composition, so every
> `getUniformComponent` call returns `null`. A component that reads its children this way
> then renders empty and looks like a content problem, three files away from the cause.
> Whenever you create a cache, wire it here in the same change.

```tsx
import { compositionCache } from "@/lib/cache";

export default async function UniformPage(props: UniformPageParameters) {
  const { code } = await props.params;
  return (
    <UniformComposition
      code={code}
      resolveRoute={resolveRouteFromCode}
      resolveComponent={resolveComponent}
      compositionCache={compositionCache}
    />
  );
}
```

Access data within any component:

```tsx
import { compositionCache } from "@/lib/cache";
import { ComponentProps } from "@uniformdev/next-app-router/component";

type NavigationSlots = "links";

export const Navigation = ({
  slots,
  context,
}: ComponentProps<unknown, NavigationSlots>) => {
  const linkData = slots.links.items.map((item) => {
    if (!item) return null;
    const resolved = compositionCache.getUniformComponent({
      componentId: item._id,
      compositionId: context._id,
    });
    return {
      title: resolved?.parameters?.title?.value as string,
      url: resolved?.parameters?.url?.value as string,
    };
  });

  return (
    <nav>
      {linkData.map((link, i) =>
        link ? (
          <a key={i} href={link.url}>
            {link.title}
          </a>
        ) : null
      )}
    </nav>
  );
};
```

Cache methods:

| Method | Description |
|--------|-------------|
| `getUniformComposition({ id })` | Get the full root composition by ID |
| `setUniformComposition(composition)` | Store a composition (called internally) |
| `getUniformComponent({ compositionId, componentId })` | Get a specific component instance by ID |

## Adapter compatibility mode

When migrating from an older SDK — or if you prefer a flattened props API where parameter values are spread directly onto props instead of nested under `parameters` — use the compat layer. The original parameters remain accessible via `component.parameters`.

```tsx
// components/resolveComponent.ts
import { createAdapterResolveComponentFunction } from "@uniformdev/next-app-router/compat";
import { pageMapping } from "./page";

export const resolveComponent = createAdapterResolveComponentFunction({
  mappings: {
    page: pageMapping,
  },
});
```

```tsx
// components/page.tsx
import { ResolveComponentResultWithType } from "@uniformdev/next-app-router/compat";
import { ComponentProps } from "@uniformdev/next-app-router/component";

type PageProps = unknown;
type PageSlots = "content" | "header" | "footer";

const Page = (props: ComponentProps<PageProps, PageSlots>) => {
  return <div>Page</div>;
};

export const pageMapping: ResolveComponentResultWithType = {
  type: "page",
  component: Page,
  mode: "adapted",
};
```

`UniformText` and `UniformSlot` are also exported from `@uniformdev/next-app-router/compat`.

## Server clients

Server-only clients (they import `'server-only'` and cannot be used in client components), all from `@uniformdev/next-app-router`:

```tsx
import {
  getCanvasClient,
  getManifest,
  getManifestClient,
  getProjectMapClient,
  getRouteClient,
} from "@uniformdev/next-app-router";
```

### Examples

```tsx
import { CANVAS_PUBLISHED_STATE } from "@uniformdev/canvas";

// Fetch a specific composition by ID
const canvasClient = getCanvasClient({ cache: { type: "no-cache" } });
const composition = await canvasClient.getCompositionById({
  compositionId: "abc123",
  state: CANVAS_PUBLISHED_STATE,
});

// Get the personalization manifest
const manifest = await getManifest({ state: CANVAS_PUBLISHED_STATE });

// Route resolution
const routeClient = getRouteClient({ cache: { type: "force-cache" } });
```
