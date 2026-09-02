# Routing and middleware

The middleware is the most critical part of the integration. It runs at the edge and handles route resolution, personalization evaluation, and request rewriting. See `references/setup.md` for the required basic middleware and the Next.js 16 `runtime: "experimental-edge"` requirement.

## Using handleUniformRoute directly

For more control than `uniformMiddleware()`, use `handleUniformRoute`:

```ts
import { handleUniformRoute } from "@uniformdev/next-app-router/middleware";
import { NextRequest } from "next/server";

export default (request: NextRequest) => {
  return handleUniformRoute({ request });
};

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
  runtime: "experimental-edge",
};
```

## Middleware options

| Option | Type | Description |
|--------|------|-------------|
| `rewriteRequestPath` | `(options) => Promise<RewriteRequestPathResult>` | Transform the incoming request path before route resolution |
| `rewriteDestinationPath` | `(options) => Promise<string>` | Transform the output path after resolution |
| `pathPatternsWithVariations` | `string[]` | Paths that should pre-compute personalizations |
| `release` | `{ id: string }` | Content release ID to resolve against |
| `quirks` | `Quirks` | Custom quirks to inject into the visitor context |
| `defaultConsent` | `boolean` | Override the default consent setting |
| `locale` | `string` | Locale to use for route resolution |
| `dataClient` | `DataClient` | Custom data client (see `references/advanced.md`) |

## Setting quirks in middleware

Inject custom quirks based on request data:

```ts
export default (request: NextRequest) => {
  return handleUniformRoute({
    request,
    quirks: {
      browser: request.headers.get("user-agent")?.includes("Chrome")
        ? "chrome"
        : "other",
    },
  });
};
```

## Locale handling

Prepend locale information with `rewriteRequestPath`:

```ts
import { uniformMiddleware } from "@uniformdev/next-app-router/middleware";

const locales = ["en", "fr", "de"];
const defaultLocale = "en";

export default uniformMiddleware({
  rewriteRequestPath: async ({ url }) => {
    const [firstSegment] = url.pathname.split("/").filter(Boolean);
    const hasLocale = firstSegment && locales.includes(firstSegment);
    return {
      path: hasLocale ? url.pathname : `/${defaultLocale}${url.pathname}`,
    };
  },
});
```

Or specify the locale directly (e.g. from a cookie or header):

```ts
export default (request: NextRequest) => {
  const locale = request.cookies.get("CUSTOM_LOCALE")?.value || "en";
  return handleUniformRoute({ request, locale });
};
```

## Custom route mapping

Use `findRouteMatch` to map dynamic URL patterns to Uniform project map nodes. The `keys` object passes dynamic URL segments as dynamic inputs, accessible in components via `context.dynamicInputs`:

```ts
import { handleUniformRoute } from "@uniformdev/next-app-router/middleware";
import { findRouteMatch, type CustomRoute } from "@uniformdev/next-app-router";
import { NextRequest } from "next/server";

const customRoutes: CustomRoute[] = [
  { id: "news-listing", pattern: "/news/:category" },
  { id: "product-detail", pattern: "/products/:slug" },
];

export default (request: NextRequest) => {
  return handleUniformRoute({
    request,
    rewriteRequestPath: async ({ url }) => {
      const routeMatch = findRouteMatch(customRoutes, url.pathname);
      if (routeMatch?.route.id === "news-listing") {
        return {
          path: "/news-listing",
          keys: { category: routeMatch.params.category },
        };
      }
      if (routeMatch?.route.id === "product-detail") {
        return {
          path: "/product-detail",
          keys: { slug: routeMatch.params.slug },
        };
      }
    },
  });
};
```

## Adding URL query string values to page state

Read query string (or other custom) values in middleware and pass them via `keys`; they become available server-side via `context.pageState.keys`. Only include keys needed to render the page:

```ts
return handleUniformRoute({
  request,
  rewriteRequestPath: async ({ url }) => {
    const routeMatch = findRouteMatch(customRoutes, url.pathname);
    if (routeMatch?.route.id === "news-listing") {
      return {
        path: "/news-listing",
        keys: { categoryId: url.searchParams.get("categoryId") ?? "" },
      };
    }
  },
});
```

## Serving a composition at the site root (`/`)

A Uniform project ships with a **Root** project map node at `/` that has no composition attached. To serve a page at `/`, attach your composition to that existing Root node in the Uniform Canvas UI (Project Map → Root → assign composition).

For MCP-driven workflows, note that the `mutateProjectMapNode` MCP tool is **create-only** and appends its `nodePathSegment` to the parent path — so it **cannot** rebind the pre-existing Root node. Creating a node for the home page yields `/home` (or whatever segment you pass), never `/`. Bind the root in the UI, and keep `generateStaticParams` (`createUniformStaticParams({ paths: [...] })`) in sync with the path the node actually resolves to.

## Moving the uniform page to a different location

To place the route under a different path (e.g. a locale segment), use `rewriteDestinationPath`, then move the page to `app/[locale]/uniform/[code]/page.tsx`:

```ts
export default (request: NextRequest) => {
  const locale = "en";
  return handleUniformRoute({
    request,
    rewriteDestinationPath: async (options) => {
      if (options.source === "route") {
        return `/${locale}/uniform/${options.code}`;
      }
      return `/${locale}/playground/${options.code}`;
    },
  });
};
```

## Scoping middleware to specific paths

Use Next.js `config.matcher` to limit which paths Uniform handles:

```ts
export const config = {
  matcher: ["/", "/about", "/products/:path*"],
  runtime: "experimental-edge",
};
```

## Override default consent per request

```ts
export default (request: NextRequest) => {
  const hasConsent = request.cookies.get("cookie-consent")?.value === "true";
  return handleUniformRoute({ request, defaultConsent: hasConsent });
};
```

## Content release support

Switch to a specific content release by passing the release ID:

```ts
export default (request: NextRequest) => {
  const releaseId = request.nextUrl.searchParams.get("release");
  return handleUniformRoute({
    request,
    release: releaseId ? { id: releaseId } : undefined,
  });
};
```
