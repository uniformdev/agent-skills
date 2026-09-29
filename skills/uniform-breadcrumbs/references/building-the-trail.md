# Building the trail

## Contents

- [Packages](#packages)
- [The trail module](#the-trail-module)
- [Wiring it to a page](#wiring-it-to-a-page)
- [Titles](#titles)
- [Dynamic paths](#dynamic-paths)
- [Localized paths](#localized-paths)
- [Latency, caching and cost](#latency-caching-and-cost)

## Packages

Two packages, two jobs:

| Package | Provides | Used for |
|---|---|---|
| `@uniformdev/project-map` | `ProjectMapClient`, `Route` (the path-template engine), `getNodeLocalePath`, `ROOT_NODE_PATH` | The tree: ancestors, names, path templates, localized paths |
| `@uniformdev/canvas` | `RouteClient`, `Projection`, the state constants | The titles: one projected Route API call per linked ancestor |

Both are dependencies of the framework SDKs, so check before adding either — and if you do add
one, pin it to the version every other `@uniformdev/*` package in the project already resolves
to: [discovery.md](discovery.md).

## The trail module

Framework-agnostic. It takes the two clients and the five inputs, returns crumbs, and knows
nothing about React. The clients are injected so the App Router can hand in its cached factory
clients and the Page Router can hand in its own lazily-constructed pair.

```ts
// lib/breadcrumbs/trail.ts
import { CANVAS_PUBLISHED_STATE, type RouteClient } from '@uniformdev/canvas';
import {
  ROOT_NODE_PATH,
  Route,
  getNodeLocalePath,
  type ProjectMapClient,
  type ProjectMapNode,
} from '@uniformdev/project-map';

export type Crumb = {
  /** Project map node id. Stable across renames — use it as the React key. */
  id: string;
  title: string;
  /** Absent when the crumb is the current page or is not navigable. */
  href?: string;
  isCurrent: boolean;
};

export type TrailClients = {
  projectMap: ProjectMapClient;
  route: RouteClient;
};

export type TrailOptions = {
  /** Unresolved node path, e.g. "/products/:category". */
  nodePath: string;
  /** Dynamic input values for this request, e.g. { category: "shoes" }. */
  dynamicInputs?: Record<string, string>;
  locale?: string;
  /** CANVAS_PUBLISHED_STATE (64) or CANVAS_DRAFT_STATE (0). */
  state?: number;
  /** Release being previewed. Without it, an editor previewing a release sees base titles. */
  releaseId?: string;
  /**
   * Parameter id(s) that label a crumb — the field the user chose, by default the page
   * component definition's `titleParameter`. Several when the project has several page types.
   */
  titleParameter: string | string[];
  /** Title of the page being rendered. It is already in your props; it is never fetched. */
  currentTitle?: string;
  includeRoot?: boolean;
  rootTitle?: string;
  /** Only needed when the project has more than one project map. */
  projectMapId?: string;
};

export async function getBreadcrumbTrail(
  { projectMap, route }: TrailClients,
  {
    nodePath,
    dynamicInputs = {},
    locale,
    state = CANVAS_PUBLISHED_STATE,
    releaseId,
    titleParameter,
    currentTitle,
    includeRoot = true,
    rootTitle = 'Home',
    projectMapId,
  }: TrailOptions
): Promise<Crumb[]> {
  // Playground and by-id renders hand you "composition" or a composition id, not a path.
  // Skip the request rather than send one that cannot match.
  if (!nodePath.startsWith('/')) return [];

  // The tree, and only the tree: the node and its ancestors, sorted by path, root first.
  const chain = await fetchChain(projectMap, nodePath, projectMapId);
  if (!chain.length) return [];

  const titleFields = Array.isArray(titleParameter) ? titleParameter : [titleParameter];
  const lastIndex = chain.length - 1;

  const crumbs = await Promise.all(
    chain.map(async (node, index): Promise<Crumb | undefined> => {
      const isRoot = node.path === ROOT_NODE_PATH;
      if (isRoot && !includeRoot) return undefined;

      const isCurrent = index === lastIndex;
      const nodeName = isRoot
        ? rootTitle
        : ((locale ? node.locales?.[locale]?.name : undefined) ?? node.name);

      // The current page is already rendered. Its title is in props, never in a fetch.
      if (isCurrent) return { id: node.id, title: currentTitle ?? nodeName, isCurrent };

      // Placeholder: a grouping level with no page behind it, so no link.
      const href = hrefFor(node, dynamicInputs, locale);
      if (!href) return { id: node.id, title: nodeName, isCurrent };

      const page = await resolvePage(route, {
        path: href,
        state,
        releaseId,
        locale,
        projectMapId,
        titleFields,
      });

      // notFound (never published at this state) or a redirect: keep the level, drop the link.
      if (!page) return { id: node.id, title: nodeName, isCurrent };

      return { id: node.id, title: page.title ?? nodeName, href, isCurrent };
    })
  );

  return crumbs.filter((crumb) => crumb !== undefined);
}

/**
 * The one request that can take the page down. Breadcrumbs are secondary navigation: a
 * failure here logs and yields an empty trail, so the component renders nothing.
 */
async function fetchChain(
  projectMap: ProjectMapClient,
  nodePath: string,
  projectMapId: string | undefined
): Promise<ProjectMapNode[]> {
  try {
    const { nodes } = await projectMap.getNodes({
      path: nodePath,
      includeAncestors: true,
      depth: 0,
      expanded: true, // locale paths and parentPath are omitted without it
      projectMapId,
    });
    return nodes ?? [];
  } catch (error) {
    console.error(`Breadcrumb trail failed for ${nodePath}`, error);
    return [];
  }
}

function hrefFor(
  node: ProjectMapNode,
  dynamicInputs: Record<string, string>,
  locale: string | undefined
): string | undefined {
  // A placeholder node is a grouping level with no composition behind it.
  if (node.type !== 'composition' || !node.compositionId) return undefined;

  // An ancestor's ":tokens" are a subset of the current route's, so this request's dynamic
  // inputs fill every one of them.
  return new Route(getNodeLocalePath(node, locale)).expand({
    dynamicInputValues: dynamicInputs,
    allowedQueryParams: node.data?.queryStrings?.map((qs) => qs.name),
  });
}

type ResolvePageOptions = {
  path: string;
  state: number;
  releaseId?: string;
  locale?: string;
  projectMapId?: string;
  titleFields: string[];
};

/**
 * Ask the Route API for the page at an expanded path and read back one parameter.
 * Returns `undefined` when there is no page to link to, `{}` when there is a page but no
 * usable title, and `{ title }` otherwise.
 */
async function resolvePage(
  route: RouteClient,
  { path, state, releaseId, locale, projectMapId, titleFields }: ResolvePageOptions
): Promise<{ title?: string } | undefined> {
  try {
    const result = await route.get({
      path,
      state,
      releaseId,
      locale,
      projectMapId,
      withComponentIDs: false,
      // The projection is applied before dynamic inputs, localization and data resources are
      // resolved, so the response is the resolved title and nothing else.
      select: { fields: { only: titleFields }, slots: { only: [] } },
    });

    if (result.type !== 'composition') return undefined;

    // A misspelled field id is a silent no-op: the field is simply absent, not an error.
    const parameters = result.compositionApiResponse.composition.parameters;
    for (const field of titleFields) {
      const value = parameters?.[field]?.value;
      if (typeof value === 'string' && value) return { title: value };
    }
    return {};
  } catch (error) {
    // A failed lookup costs a title, not a link and not the page.
    console.error(`Breadcrumb title lookup failed for ${path}`, error);
    return {};
  }
}
```

Why the module never throws: `getBreadcrumbTrail` is called from inside a component the
author placed, and an unhandled rejection there takes the whole page down — over secondary
navigation. Both requests are guarded inside the module (`fetchChain` for the tree,
`resolvePage` for each title), so a caller does not need a `try/catch` and a copied sample
cannot forget one. Keep it that way when you extend it.

Why there is no sorting or filtering: `includeAncestors` is documented to return results sorted by
path, and `depth: 0` returns no descendants, so the response already is the chain, root first.

Why the Route API and not the composition API for the title: `RouteClient.get` is the only read
that takes a *path* — so it matches the dynamic node, extracts the dynamic inputs from the path
you expanded, applies the locale, applies the release, and resolves data-bound parameters,
exactly as it does for the page itself. `getCompositionById` does none of that. The `select`
projection then prunes the tree before any of that resolution runs, so the response is a few
hundred bytes with one parameter and no slots.

## Wiring it to a page

Only one thing is breadcrumb-specific here: mapping your SDK's route context onto the five
inputs and handing over its clients. Where that context comes from, which clients are
server-only and how the composition route is structured are in the framework skills —
[uniform-nextjs-app-router](../../uniform-nextjs-app-router/SKILL.md) and
[uniform-nextjs-page-router](../../uniform-nextjs-page-router/SKILL.md).

Both shipped Next.js SDKs already carry the matched route and the dynamic inputs — they are what
route matching produced, so no SDK has to reconstruct them. Confirm the names in the installed
package ([discovery.md](discovery.md)) rather than trusting this table; it is a starting point,
not the source of truth:

| Input | App Router — `context` prop on every component | Page Router — `withUniformGetServerSideProps` handler |
|---|---|---|
| `nodePath` | `context.matchedRoute` | `routeResponse.matchedRoute` |
| `dynamicInputs` | `context.dynamicInputs` | `routeResponse.dynamicInputs` |
| `locale` | `context.pageState.locale` | the locale you resolved the route with |
| `state` | `context.state` | `context.preview ? CANVAS_DRAFT_STATE : CANVAS_PUBLISHED_STATE` |
| `releaseId` | `context.pageState.releaseId` | `context.previewData?.releaseId` |
| clients | `getProjectMapClient({ state })`, `getRouteClient({ state })` from `@uniformdev/next-app-router` | your own lazily-constructed pair — see below, and never at page module scope |

Breadcrumbs are a component an author places, not page furniture. Whatever the SDK, the trail
belongs in its own component that is **registered in the project's component resolver** next to
every other component type — not inlined into the page component. Registration mechanics are the
framework skill's ([uniform-nextjs-app-router](../../uniform-nextjs-app-router/SKILL.md)
`references/components.md` for the App Router); follow whatever the project already does.

### App Router

Use the SDK's factories rather than constructing clients. They read the environment, share a
concurrency limit, turn caching off for draft and editor state, and tag every route fetch with
its path so `revalidateTag` can invalidate it. Both are server-only and cannot be imported into
a client component.

```tsx
// components/Breadcrumbs.tsx
import { getProjectMapClient, getRouteClient } from '@uniformdev/next-app-router';
import type { ComponentProps } from '@uniformdev/next-app-router/component';
import { getBreadcrumbTrail } from '@/lib/breadcrumbs/trail';
import { BreadcrumbsView } from './BreadcrumbsView';

// Replace this with the id on *this* project's page component definition — the value of its
// `titleParameter` field ([discovery.md](discovery.md) step 5). There is no common default,
// and a wrong id is a silent no-op that titles every crumb with its node name.
const TITLE_PARAMETER = 'pageTitle';

export default async function Breadcrumbs({ context }: ComponentProps) {
  const { state, matchedRoute, dynamicInputs, pageState } = context;

  const crumbs = await getBreadcrumbTrail(
    { projectMap: getProjectMapClient({ state }), route: getRouteClient({ state }) },
    {
      nodePath: matchedRoute,
      dynamicInputs,
      locale: pageState.locale,
      state,
      releaseId: pageState.releaseId,
      titleParameter: TITLE_PARAMETER,
    }
  );

  return <BreadcrumbsView crumbs={crumbs} />;
}
```

`currentTitle` is omitted above, so the last crumb reads as the node name. To show the page's
own title instead, pass `compositionCache` (from `createCompositionCache()`) to
`<UniformComposition>` and read the root component's parameter from it inside the breadcrumbs
component — it is the composition already being rendered, so this costs no request.

### Page Router

There is no client factory here, so you construct the two clients yourself — and **where** you
construct them is the trap. A page module in the Page Router is a client module: everything at
its top level is part of the browser bundle unless Next's `getServerSideProps` transform
eliminates it. Constructing a Uniform client at the top of `pages/[[...path]].tsx` puts a
`process.env.UNIFORM_API_KEY` read one failed tree-shake away from the browser, and a reviewer
cannot tell by looking whether it was eliminated.

Build them lazily in their own module instead. Nothing runs at import time, so there is nothing
to eliminate, and the key is read only when a request is being served:

```ts
// lib/breadcrumbs/clients.ts
import { RouteClient } from '@uniformdev/canvas';
import { ProjectMapClient } from '@uniformdev/project-map';
import type { TrailClients } from './trail';

let clients: TrailClients | undefined;

/**
 * Call this inside a server-side function only. Construction is deferred so no Uniform
 * client — and no UNIFORM_API_KEY read — exists at module scope in a page bundle.
 */
export function getTrailClients(): TrailClients {
  clients ??= {
    route: new RouteClient({
      projectId: process.env.UNIFORM_PROJECT_ID!,
      apiKey: process.env.UNIFORM_API_KEY,
      edgeApiHost: process.env.UNIFORM_EDGE_API_HOST,
    }),
    projectMap: new ProjectMapClient({
      projectId: process.env.UNIFORM_PROJECT_ID!,
      apiKey: process.env.UNIFORM_API_KEY,
      apiHost: process.env.UNIFORM_API_HOST,
    }),
  };
  return clients;
}
```

Caching in the module keeps the concurrency limit shared across requests, which is the reason
to have one instance at all. Then extend the route handler rather than replacing it:

```tsx
// pages/[[...path]].tsx
import { CANVAS_DRAFT_STATE, CANVAS_PUBLISHED_STATE } from '@uniformdev/canvas';
import { withUniformGetServerSideProps } from '@uniformdev/canvas-next/route';
import { getTrailClients } from '@/lib/breadcrumbs/clients';
import { getBreadcrumbTrail } from '@/lib/breadcrumbs/trail';

// This project's page component definition `titleParameter` — read it, do not copy this value.
const TITLE_PARAMETER = 'pageTitle';

export const getServerSideProps = withUniformGetServerSideProps({
  handleComposition: async (routeResponse, context, defaultHandler) => {
    const result = await defaultHandler(routeResponse);
    if (!result || !('props' in result)) return result;

    // Inside the handler: server-only by construction, and only now is a client built.
    const crumbs = await getBreadcrumbTrail(getTrailClients(), {
      nodePath: routeResponse.matchedRoute,
      dynamicInputs: routeResponse.dynamicInputs ?? {},
      state: context.preview ? CANVAS_DRAFT_STATE : CANVAS_PUBLISHED_STATE,
      releaseId: context.previewData?.releaseId,
      titleParameter: TITLE_PARAMETER,
    });

    return { ...result, props: { ...(await result.props), crumbs } };
  },
});
```

`withUniformGetServerSideProps` also takes a `client` option, to hand it the same `RouteClient`
the trail uses. It is evaluated at module scope, so taking it costs exactly the exposure this
section avoids — leave it unset and let the handler use the SDK's own client.

**Then solve the delivery problem, because the Page Router has one and the App Router does
not.** A component registered with `registerUniformComponent` is rendered by
`UniformComposition` from composition data — it receives its own parameters and slots, and
**never the page's props**. So crumbs computed in `getServerSideProps` cannot be handed to it
directly. Two shapes work:

| Shape | Use when |
|---|---|
| Wrap `<UniformComposition>` in a React context provider carrying the crumbs; the registered component reads the context | **Default.** Authors place the component wherever they want it |
| Render the breadcrumbs markup in the page itself, outside `UniformComposition` | The trail is fixed site chrome that authors are not meant to move |

The provider is a client-side carrier for server-computed data — it moves an already-built
array, never the clients. The clients stay behind `getTrailClients()`, called only from inside
the handler.

**Only if your SDK exposes neither** is the node path also carried on the composition itself, as
`composition.projectMapNodes?.[0]?.path`. Treat that as the fallback: it is an array because one
composition can be attached to several nodes, so `[0]` can build a trail through a different
branch than the one the request actually matched. Prefer the matched route wherever you have it.

## Titles

The Route API call in `resolvePage` is the default for every linked ancestor, and it needs one
thing from you: **the id of the title parameter.** It is on the page component's definition as
`titleParameter`. Every component definition has one, so read it off the *page* component rather
than the first match — [discovery.md](discovery.md#5-which-parameter-is-the-pages-title) has the
commands. Do not assume `title` or `pageTitle`.

Where a project has several page types with different title parameters, pass them all and the
module takes the first non-empty, in the order you pass them:
`titleParameter: [articleDefinition.titleParameter, pageDefinition.titleParameter]` — read each
one, in the order you want them tried.

What the Route API gets right that nothing else does, and why the old shortcuts fail:

| Title source | Dynamic input in the title (`${category}`) | Localized title | Edition / release | Payload |
|---|---|---|---|---|
| `RouteClient.get` on the expanded path with `select` | Resolved | Resolved | Resolved with `releaseId` | One parameter |
| `getNodes({ withCompositionData: true })` → `compositionData.name` | Authoring name, same for every value | Authoring name | Names the edition, never its content | Metadata for every node |
| `getCompositionById(node.compositionId)` | Raw `${...}` expression | Only with a `locale` you pass | Ignored | The whole tree |

The two remaining cases:

**A dynamic node when the crumb should read as the slug.** `/products/:category` has one node,
so a crumb titled from `node.name` reads "Category" for every category. The Route API call
already fixes this when the page's title parameter is bound to the dynamic input. When it is not
— or the design wants the slug itself — the value is in `dynamicInputs`, no fetch needed:

```ts
const segment = node.path.split('/').at(-1);
const slug = segment?.startsWith(':') ? dynamicInputs[segment.slice(1)] : undefined;
```

**The current page.** The last crumb should read as the page's own title, which you are already
rendering. Pass it as `currentTitle`; the module never fetches the current node.

## Dynamic paths

`Route` from `@uniformdev/project-map` is the SDK's own path-template engine — the one route
matching uses. Use it rather than a hand-rolled `replace`; it URL-encodes values and handles
allowed query strings.

```ts
new Route('/products/:category/:sku').expand({
  dynamicInputValues: { category: 'shoes', sku: 'a b/c' },
}); // "/products/shoes/a%20b%2Fc"
```

A missing value does not fail — the `:token` stays in place:

```ts
new Route('/products/:category/:sku').expand({ dynamicInputValues: { category: 'shoes' } });
// "/products/shoes/:sku"  ← no throw, no warning
new Route('/products/:category/:sku').expand();
// "/products/:category/:sku"
```

In a trail that only happens when the dynamic inputs are not passed through. An ancestor's path
is a prefix of the current node's, so its tokens are a subset of the current route's, and the
request's own `dynamicInputs` fill every one. Pass them from the route as they are; do not
rebuild them from the URL.

## Localized paths

Two different things are both called "localized routing", and they need different handling on
the tree side. On the title side the Route API handles both:

| Setup | Node path | Tree (href) | Title (Route API) |
|---|---|---|---|
| **Locale dynamic node** — `/:locale/products` | one path for all locales | Nothing extra. Pass the locale in `dynamicInputs`; `Route.expand` fills it | Nothing extra. The `:locale` segment in the expanded path selects the locale |
| **Locale path segments** — authors set a per-locale segment on a node | `node.path` is the fallback; `node.locales[locale].path` is the localized one | Build hrefs with `getNodeLocalePath(node, locale)` and request `expanded: true` | Pass `locale` explicitly — the path alone does not say which locale it is |

`getNodeLocalePath(node, locale)` returns `node.locales[locale].path` when it exists and
`node.path` otherwise, so it is safe to call unconditionally — which is why `hrefFor` does.
`resolvePage` passes `locale` unconditionally for the same reason: when the path already carries
a `:locale` value the explicit parameter takes precedence and agrees with it.

Localized node names come from the same object: `node.locales[locale].name`, falling back to
`node.name`. Both the localized `path` and inherited locale entries are omitted from the
response unless you pass `expanded: true`. **`getNodes` itself has no `locale` option** — do not
add one.

One caveat when locale path segments are in play: the matched route handed to you may already be
the localized variant, because the SDK matches an incoming path against both `node.path` and
`node.locales[locale].path`. `getNodes({ path })` expects the fallback path. If a localized
project map returns an empty trail, resolve the node by composition instead and read `path` off
the result:

```ts
const { nodes } = await projectMap.getNodes({ compositionId, includeAncestors: true, expanded: true });
```

## Latency, caching and cost

A trail costs one project map request plus one projected route request per linked ancestor —
for a page four levels deep, three small route calls fired in parallel. The project map client
talks to the management API, not the edge cache, so the tree request is the one worth caching;
the route requests hit the edge and are small.

Small is not the same as free, and this is the part that bites. The requests sit *in front of
the page*: the tree must resolve before any title can be asked for, and in the App Router the
component doing the awaiting is one an author placed inside the composition, so the enclosing
segment cannot flush until the whole chain finishes. A measured trail four levels deep looks
like this on a cold cache:

```
1 project map (83ms) + 3 route get [111ms + 316ms + 313ms] wall 316ms · total ~400ms
```

The fan-out is working — wall time is the slowest title, not their sum — and the total is still
most of half a second of nothing rendering. Two answers, in this order.

### Caching is the default, not something you add

`getRouteClient({ state })` and `getProjectMapClient({ state })` resolve to `force-cache` for
every state except `CANVAS_DRAFT_STATE` and `CANVAS_EDITOR_STATE`, which get `no-cache`. So at
published state Next's fetch cache holds these responses and a repeat request pays nothing.

The consequence for anyone measuring: **a latency number is meaningless unless it says whether
the cache was cold or warm.** A first hit, a fresh deployment, or a draft/preview request pays
the full round trip; steady-state production traffic does not. Measure both before concluding
the trail is slow.

### The tree fetch is cached but cannot be invalidated by tag

The two clients are not symmetric, and the skill used to imply they were:

| Client | Cache | Tags |
|---|---|---|
| `getRouteClient` | `force-cache` at published state | `route`, plus `path:/...` for every cumulative prefix, lowercased |
| `getProjectMapClient` | `force-cache` at published state | **none** — the fetch carries `next: { revalidate }` and no `tags` |

So `revalidateTag('path:/products')` drops every cached *title* under `/products`, but nothing
drops the cached *tree*. Project map edits reach the cache the other way: the SDK's webhook
handler calls `revalidatePath` for the affected node paths. If you cache the tree yourself with
a long TTL, an author moving a page will not be reflected until that TTL expires — budget the
interval accordingly rather than assuming a tag will save you.

### Stream what caching cannot cover

A cold cache, the first visitor after a deploy, draft mode, preview, a release and in-context
editing all pay the full cost, and no cache setting changes that. Since an author can place the
trail on any page and the component cannot know which of those it is serving, **the boundary is
not conditional** — give it one always, so the shell flushes immediately and the trail streams
in when it resolves. On a warm request the subtree resolves and no fallback paints, so it costs
nothing to have been wrong about needing it.

The App Router SDK has this built in, and it lands exactly where this skill already tells you to
put the component — the resolver. A `suspense` entry on the resolve result wraps that component
instance in a boundary; see
[uniform-nextjs-app-router](../../uniform-nextjs-app-router/references/advanced.md) for the
mechanism. Nothing about the trail module or the component changes:

```tsx
// components/resolveComponent.ts
if (component.type === 'breadcrumbs') {
  return { component: Breadcrumbs, suspense: { fallback: BreadcrumbsFallback } };
}
```

`fallback` is a **component, not an element** — the SDK calls `createElement` on it, so
`fallback: <BreadcrumbsFallback />` is wrong and `fallback: BreadcrumbsFallback` is right.
Which fallback to use is a rendering decision with a trap in it, and it is not "a skeleton":
see [rendering.md](rendering.md#the-suspense-fallback).

There is no equivalent in the Page Router. The trail is built in `getServerSideProps`, which
runs before anything is sent, so it blocks the response outright — caching and the
skip-when-absent rule below are the only levers there.

- **Skip everything when nothing will render it.** Where the trail is built at the route level
  rather than inside the component — the Page Router shape above — every page pays for the
  fetches, including pages with no breadcrumbs component on them. Walk the composition for the
  breadcrumbs component type first and return `[]` when it is absent. This is the single largest
  saving available, and it is the reason to prefer building inside the component where the
  framework allows it.
- **App Router: use the factories rather than constructing clients**, and you get the caching
  and tagging above for free. Constructing `RouteClient` yourself means no fetch cache and no
  tags unless you wire them.
- **Cache the tree fetch, not the trail.** `getNodes({ path, projectMapId })` is a pure function
  of the node path and the expensive part. The title fetches are a function of the *expanded*
  href, so the dynamic inputs are in their key by construction. Pass a caching `fetch` into
  `ProjectMapClient`, or memoize a `getChain(nodePath)` step, and run expansion and titling fresh.
- **If you memoize `getBreadcrumbTrail` itself, `dynamicInputs`, `locale`, `state` and
  `releaseId` must all be in the key.** Every URL under `/products/:category` shares one
  `nodePath`, so a key of `nodePath` alone serves the shoes trail to the hats page — right
  structure, wrong links and wrong labels, and no error anywhere. This is the cheapest breadcrumb
  bug to ship and the hardest to notice.
- Do not set `bypassCache: true` for production traffic. It exists for editor and preview
  requests, where the SDK helpers already set it for you.
- Keep one instance of each client alive (behind the SDK factories, or behind a lazy accessor
  as in the Page Router section) so their concurrency limits are shared. Constructing a pair per
  request defeats it — but never construct them at the top level of a page module either.
