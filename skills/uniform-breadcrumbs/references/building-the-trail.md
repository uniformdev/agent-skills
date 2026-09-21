# Building the trail

## Contents

- [Packages](#packages)
- [The trail module](#the-trail-module)
- [Wiring it to a page](#wiring-it-to-a-page)
- [Titles](#titles)
- [Dynamic paths](#dynamic-paths)
- [Localized paths](#localized-paths)
- [Caching and cost](#caching-and-cost)

## Packages

`@uniformdev/project-map` carries everything the trail needs: the client, the path-template
engine (`Route`), the root-path constant, and the locale helper. It is a dependency of the
framework SDKs, so check before adding it — and if you do add it, pin it to the version every
other `@uniformdev/*` package in the project already resolves to.

Confirm what the installed copy exports before writing against it:
[discovery.md](discovery.md).

## The trail module

Framework-agnostic. It takes the four inputs, returns crumbs, and knows nothing about React.

```ts
// lib/breadcrumbs/trail.ts
import { CANVAS_PUBLISHED_STATE } from '@uniformdev/canvas';
import {
  ProjectMapClient,
  ROOT_NODE_PATH,
  Route,
  getNodeLocalePath,
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

export type TrailOptions = {
  /** Unresolved node path, e.g. "/products/:category". */
  nodePath: string;
  /** Dynamic input values for this request, e.g. { category: "shoes" }. */
  dynamicInputs?: Record<string, string>;
  locale?: string;
  /** CANVAS_PUBLISHED_STATE (64) or CANVAS_DRAFT_STATE (0). */
  state?: number;
  includeRoot?: boolean;
  rootTitle?: string;
  /** Escape hatch for crumbs whose text is not the node name. See "Titles". */
  resolveTitle?: (
    node: ProjectMapNode,
    dynamicInputs: Record<string, string>
  ) => string | undefined | Promise<string | undefined>;
};

const projectMap = new ProjectMapClient({
  projectId: process.env.UNIFORM_PROJECT_ID,
  apiKey: process.env.UNIFORM_API_KEY,
  apiHost: process.env.UNIFORM_API_HOST,
});

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

export async function getBreadcrumbTrail({
  nodePath,
  dynamicInputs = {},
  locale,
  state = CANVAS_PUBLISHED_STATE,
  includeRoot = true,
  rootTitle = 'Home',
  resolveTitle,
}: TrailOptions): Promise<Crumb[]> {
  // No project map context: pattern preview, playground, composition-by-id. Every SDK
  // signals it differently — a sentinel string, a composition id — so test for a path.
  if (!nodePath.startsWith('/')) return [];

  const { nodes } = await projectMap.getNodes({
    path: nodePath,
    includeAncestors: true,
    depth: 0,
    expanded: true, // locale paths and parentPath are omitted without it
    withCompositionData: true,
    state,
  });
  if (!nodes?.length) return [];

  const target = segmentsOf(nodePath);
  const chain = nodes
    .filter((node) => {
      const segments = segmentsOf(node.path);
      return segments.length <= target.length && segments.every((s, i) => s === target[i]);
    })
    .sort((a, b) => segmentsOf(a.path).length - segmentsOf(b.path).length);

  const lastIndex = chain.length - 1;

  const crumbs = await Promise.all(
    chain.map(async (node, index): Promise<Crumb | undefined> => {
      const isRoot = node.path === ROOT_NODE_PATH;
      if (isRoot && !includeRoot) return undefined;

      const isCurrent = index === lastIndex;
      const custom = await resolveTitle?.(node, dynamicInputs);
      const title =
        custom ??
        (isRoot ? rootTitle : (locale ? node.locales?.[locale]?.name : undefined) ?? node.name);

      return {
        id: node.id,
        title,
        href: isCurrent ? undefined : hrefFor(node, dynamicInputs, locale),
        isCurrent,
      };
    })
  );

  return crumbs.filter((crumb) => crumb !== undefined);
}

function hrefFor(
  node: ProjectMapNode,
  dynamicInputs: Record<string, string>,
  locale: string | undefined
): string | undefined {
  // A placeholder node is a grouping level with no composition behind it.
  if (node.type !== 'composition' || !node.compositionId) return undefined;

  const href = new Route(getNodeLocalePath(node, locale)).expand({
    dynamicInputValues: dynamicInputs,
    allowedQueryParams: node.data?.queryStrings?.map((qs) => qs.name),
  });

  // expand() leaves unmatched ":tokens" in place instead of failing.
  return segmentsOf(href).some((segment) => segment.startsWith(':')) ? undefined : href;
}
```

Why the filter and the sort in step 3: `includeAncestors` is documented to sort by path and the
`depth: 0` query is not supposed to return descendants, but both are properties of the response
rather than of your data. A segment-prefix filter makes a stray descendant impossible to render
as a crumb, and sorting by depth makes the order yours.

## Wiring it to a page

Only one thing is breadcrumb-specific here: mapping your SDK's route context onto the four
inputs. Everything else — where that context comes from, which clients are server-only, how the
composition route is structured — belongs to the framework skill
([uniform-nextjs-app-router](../../uniform-nextjs-app-router/SKILL.md),
[uniform-nextjs-page-router](../../uniform-nextjs-page-router/SKILL.md)), and this skill does
not restate it.

Both shipped Next.js SDKs already carry the matched route and the dynamic inputs — they are what
route matching produced, so no SDK has to reconstruct them. Confirm the names in the installed
package ([discovery.md](discovery.md)) rather than trusting this table; it is a starting point,
not the source of truth:

| Input | App Router — `context` prop on every component | Page Router — `getServerSideProps` result |
|---|---|---|
| `nodePath` | `context.matchedRoute` | `matchedRoute` page prop |
| `dynamicInputs` | `context.dynamicInputs` | `dynamicInputs` page prop |
| `locale` | `context.pageState.locale` | the locale you resolved the route with |
| `state` | `context.pageState.compositionState` | the state you fetched the composition at — draft in preview, published otherwise |

Breadcrumbs are a component an author places, not page furniture. Whatever the SDK, the trail
belongs in its own component that is **registered in the project's component resolver** next to
every other component type — not inlined into the page component. Registration mechanics are the
framework skill's ([uniform-nextjs-app-router](../../uniform-nextjs-app-router/SKILL.md)
`references/components.md` for the App Router); follow whatever the project already does.

The example below is written against the App Router because a worked example needs a concrete
SDK. What is breadcrumb-specific is the four arguments, not the shape of the component:

```tsx
// components/Breadcrumbs.tsx
import type { ComponentProps } from '@uniformdev/next-app-router/component';
import { getBreadcrumbTrail } from '@/lib/breadcrumbs/trail';
import { BreadcrumbsView } from './BreadcrumbsView';

export default async function Breadcrumbs({ context }: ComponentProps) {
  const crumbs = await getBreadcrumbTrail({
    nodePath: context.matchedRoute,
    dynamicInputs: context.dynamicInputs,
    locale: context.pageState.locale,
    state: context.pageState.compositionState,
  });

  return <BreadcrumbsView crumbs={crumbs} />;
}
```

On the Page Router the same four values arrive as page props — the route handler puts
`matchedRoute` and `dynamicInputs` alongside `data` — so the trail is built in
`getServerSideProps`, and `UniformCompositionNextPage` / `RouteCompositionResult` are the types
that describe them. Extend the route handler rather than replacing it:

```tsx
export const getServerSideProps = withUniformGetServerSideProps({
  handleComposition: async (routeResponse, context, defaultHandler) => {
    const result = await defaultHandler(routeResponse);
    if (!result || !('props' in result)) return result;
    const crumbs = await getBreadcrumbTrail({
      nodePath: result.props.matchedRoute,
      dynamicInputs: result.props.dynamicInputs,
    });
    return { ...result, props: { ...result.props, crumbs } };
  },
});
```

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
array, never the client. Keep `ProjectMapClient` in `getServerSideProps`.

**Only if your SDK exposes neither** is the node path also carried on the composition itself, as
`composition.projectMapNodes?.[0]?.path`. Treat that as the fallback: it is an array because one
composition can be attached to several nodes, so `[0]` can build a trail through a different
branch than the one the request actually matched. Prefer the matched route wherever you have it.

If the SDK exposes its own project map client (the App Router SDK's `getProjectMapClient`, for
example), prefer it over constructing `ProjectMapClient` yourself — it reads the same
environment variables and wires the framework's caching. Check the framework skill for what
your SDK ships.

## Titles

`node.name` is right for almost every crumb. The two cases where it is not:

**A dynamic node.** `/products/:category` has one node and one name for every category, so every
product-category crumb would read "Category Detail". The value is already in `dynamicInputs` —
no fetch needed:

```ts
const crumbs = await getBreadcrumbTrail({
  nodePath: context.matchedRoute,
  dynamicInputs: context.dynamicInputs,
  resolveTitle: (node, inputs) => {
    const segment = node.path.split('/').filter(Boolean).at(-1);
    if (!segment?.startsWith(':')) return undefined; // fall through to node.name
    return inputs[segment.slice(1)]; // "shoes"
  },
});
```

That yields the slug. When the crumb must show the display name ("Running Shoes"), look it up
from the same source the page already uses — the entry or composition you fetched to render the
page — and return it from `resolveTitle`. Do not add a per-crumb composition fetch to get it:
`getCompositionById` accepts no dynamic input values, so a title bound to a dynamic input comes
back as its unresolved `${...}` expression.

**The current page.** The last crumb should read as the page's own title, which you are already
rendering. Pass it in rather than resolving it again:

```ts
resolveTitle: (node) => (node.path === context.matchedRoute ? pageTitle : undefined);
```

## Dynamic paths

`Route` from `@uniformdev/project-map` is the SDK's own path-template engine — the one route
matching uses. Use it rather than a hand-rolled `replace`; it URL-encodes values and handles
allowed query strings.

```ts
new Route('/products/:category/:sku').expand({
  dynamicInputValues: { category: 'shoes', sku: 'a b/c' },
}); // "/products/shoes/a%20b%2Fc"
```

Its failure mode is silent, and it is the single most common breadcrumb bug:

```ts
new Route('/products/:category/:sku').expand({ dynamicInputValues: { category: 'shoes' } });
// "/products/shoes/:sku"  ← no throw, no warning
new Route('/products/:category/:sku').expand();
// "/products/:category/:sku"
```

An ancestor can be dynamic while the current page supplies no value for it, so this is not a
theoretical case. `hrefFor` above rejects any expansion with a surviving `:` segment, which
turns a broken link into an unlinked crumb.

## Localized paths

Two different things are both called "localized routing", and they need different handling:

| Setup | Node path | What to do |
|---|---|---|
| **Locale dynamic node** — `/:locale/products` | one path for all locales | Nothing extra. Pass the locale in `dynamicInputs`; `Route.expand` fills it |
| **Locale path segments** — authors set a per-locale segment on a node | `node.path` is the fallback; `node.locales[locale].path` is the localized one | Build hrefs with `getNodeLocalePath(node, locale)` and request `expanded: true` |

`getNodeLocalePath(node, locale)` returns `node.locales[locale].path` when it exists and
`node.path` otherwise, so it is safe to call unconditionally — which is why `hrefFor` does.

Localized names come from the same object: `node.locales[locale].name`, falling back to
`node.name`. Both the localized `path` and inherited locale entries are omitted from the
response unless you pass `expanded: true`.

One caveat when locale path segments are in play: the matched route handed to you may already be
the localized variant, because the SDK matches an incoming path against both `node.path` and
`node.locales[locale].path`. `getNodes({ path })` expects the fallback path. If a localized
project map returns an empty trail, resolve the node by composition instead and read `path` off
the result:

```ts
const { nodes } = await projectMap.getNodes({ compositionId, includeAncestors: true, expanded: true });
```

## Caching and cost

`ProjectMapClient` talks to the Uniform management API, not the edge cache. One uncached call
per page render is a real cost, and the project map changes far less often than content.

- **Skip the call entirely when nothing will render it.** Where the trail is built at the route
  level rather than inside the component — the Page Router shape above — every page pays for the
  fetch, including the pages with no breadcrumbs component on them. Walk the composition for the
  breadcrumbs component type first and return `[]` when it is absent. This is the single largest
  saving available, and it is the reason to prefer building inside the component where the
  framework allows it.
- **App Router:** use `getProjectMapClient({ state })` and let Next's fetch cache hold it.
- **Cache the node fetch, not the trail.** `getNodes({ path, locale, state })` is a pure
  function of those three, and it is the expensive part. Everything after it — expanding
  `:token` paths, titling a dynamic crumb from its segment value — depends on `dynamicInputs`
  and is per-request. Pass a caching `fetch` into `ProjectMapClient`, or memoize a
  `getChain(nodePath, locale, state)` step, and run the expansion fresh every time.
- **If you memoize `getBreadcrumbTrail` itself, `dynamicInputs` must be in the key.** Every URL
  under `/products/:category` shares one `nodePath`, so a key of `(nodePath, locale, state)`
  serves the shoes trail to the hats page — right structure, wrong links and wrong labels, and
  no error anywhere. This is the cheapest breadcrumb bug to ship and the hardest to notice.
- Do not set `bypassCache: true` for production traffic. It exists for editor and preview
  requests, where the SDK helpers already set it for you.
- Keep the client at module scope (or behind the SDK helper) so its concurrency limit is shared.
  Constructing one per render defeats it.
