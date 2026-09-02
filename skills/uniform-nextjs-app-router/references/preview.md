# Preview

The `UNIFORM_PREVIEW_SECRET` must be set in the environment (see `references/setup.md`). If you cannot confirm that it is then warn the user they will need to add it to either the `.env` or `.env.local` file. For development purposes it can be set to "hello-world".

The preview route is a critical part of the Uniform project setup. It should always be added.

## Contextual editing and live preview

Uniform's contextual editing requires two pieces: a **preview handler** (API route) and a **playground route**. The preview handler maps a composition to the correct frontend route and also serves ISR requests. The playground route previews Uniform Patterns (reusable content chunks). Visual editing works out of the box when previewing in the Uniform dashboard.

> Preview renders **draft** content. A plain (non-preview) request to the page renders **published** content only, so an unpublished composition 404s outside of preview — see "Publishing content" in [setup.md](setup.md).

## Preview handler (GET) and ISR handler (POST)

Create `app/api/preview/route.ts`. The `GET` handler serves preview requests; the `POST` handler serves ISR requests from Uniform:

```tsx
import {
  createPreviewGETRouteHandler,
  createPreviewPOSTRouteHandler,
  createPreviewOPTIONSRouteHandler,
} from "@uniformdev/next-app-router/handler";

export const GET = createPreviewGETRouteHandler({
  resolveFullPath: ({ path }) => (path ? path : "/playground"),
});
export const POST = createPreviewPOSTRouteHandler();
export const OPTIONS = createPreviewOPTIONSRouteHandler();
```

## Playground route

Create `app/playground/[code]/page.tsx` to preview patterns. Use the same `resolveComponent` as the main route. See `references/setup.md` for the full example.

```tsx
import {
  PlaygroundParameters,
  resolvePlaygroundRoute,
  UniformPlayground,
} from "@uniformdev/next-app-router";
import { resolveComponent } from "@/components/resolveComponent";

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

## Middleware requirement

Canvas preview requires the root `middleware.ts` (see `references/setup.md`). For Next.js 16, the file MUST be named `middleware.ts` and its config export MUST include `runtime: "experimental-edge"`, otherwise preview will not work in Canvas or on Vercel.

## Manifest

The App Router fetches the manifest at runtime — no local download is needed. Publish it when you sync manifest definitions (`uniform context manifest publish`); the npm script is optional. Do NOT use the Page Router-only `uniform context manifest download` script. See `references/setup.md`.

## Server clients and caching

For direct server-side data access (`getCanvasClient`, `getRouteClient`, `getManifest`, etc.) and Next.js 16 `cacheComponents`, see `references/advanced.md`.
