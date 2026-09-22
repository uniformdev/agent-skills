# Edge cases

Each of these produces a plausible-looking trail rather than an error, which is why they are
worth handling before the first review.

## Contents

- [The page is not on the project map](#the-page-is-not-on-the-project-map)
- [Root and near-root pages](#root-and-near-root-pages)
- [Placeholder ancestors](#placeholder-ancestors)
- [Unpublished ancestors](#unpublished-ancestors)
- [Redirected ancestors](#redirected-ancestors)
- [Title lookups that fail](#title-lookups-that-fail)
- [Missing ancestors](#missing-ancestors)
- [More than one project map](#more-than-one-project-map)
- [Nodes with allowed query strings](#nodes-with-allowed-query-strings)
- [Failure policy](#failure-policy)
- [What to check before shipping](#what-to-check-before-shipping)

## The page is not on the project map

A composition can render without a route: pattern previews, the playground, and contextual
editing of a composition opened by ID. There is no current node, so there are no ancestors.

**Do not match on the sentinel — match on the shape.** Every SDK marks this case differently,
and the values are not documented API:

| Route resolved by | `matchedRoute` is |
|---|---|
| `@uniformdev/next-app-router`, playground | the literal `"composition"` |
| `@uniformdev/next-app-router`, composition rendered by id | the composition **id** |
| `@uniformdev/canvas-next/route`, contextual editing | the literal `"contextual-editing"` |

`nodePath.startsWith('/')` covers all three, anything a future SDK invents, and anything else
malformed. A `=== "composition"` check covers one of them and silently builds a garbage trail
for the rest.

Return an empty trail and let the component render nothing. Do not render a placeholder message
in production markup; if authors need feedback while editing, gate it on
`context.isContextualEditing`.

## Root and near-root pages

| Situation | Trail | Render |
|---|---|---|
| The page **is** the root node | one crumb, the current page | nothing |
| The page is one level down and the root has no composition | home crumb unlinked + current page | nothing, or the current page alone — both are noise |
| The page is one level down and the root has a composition | linked home + current page | the trail |

`crumbs.length < 2` is the check that covers all three. A trail that shows only where you already
are adds nothing and takes vertical space on exactly the pages that have the least depth.

A project map root with no composition attached arrives as `type: "placeholder"`. If the site
serves a page at `/`, that composition belongs on the root node itself; a separate node for the
home page produces `/home` and leaves the root unlinkable.

## Placeholder ancestors

`type: "placeholder"` means a grouping level: it organizes the tree and owns a path segment, but
no composition renders there.

**Render it as text, keep it in the list.** The level is real — dropping it makes the trail claim
a parent-child relationship that does not exist. `hrefFor` already returns `undefined` for
these, so the component handles it.

**But drop it from the `BreadcrumbList`.** Structured data is the one place a placeholder cannot
survive: `item` is required on every entry except the last, a grouping level has no URL to put
there, and an entry without one invalidates the list. Filter the unlinked non-final crumbs out
and renumber — see [rendering.md](rendering.md#breadcrumblist-structured-data). Visible trail
keeps the level; the JSON-LD does not.

Skipping placeholders from the rendered trail too is a legitimate choice when the design cannot
show unlinked crumbs — that is a decision about the visible list, and it does not change the
structured data, which never carries them either way.

## Unpublished ancestors

Project map nodes have **no publish step** — a node exists the moment an author creates it. The
composition behind it does have one. So a node can be in the trail while the page it points at
has never gone live, and linking it ships a 404.

The Route API is the authority here, and the trail module already asks it. With `state:
CANVAS_PUBLISHED_STATE`, a route whose composition has no published version resolves to
`type: 'notFound'`, and `resolvePage` returns `undefined` — the crumb keeps its level and its
node name and loses its link. Pass `state` through from the page so preview shows draft
ancestors linked and production does not.

Do not reach for `withCompositionData` to answer this question. It reports whether a composition
*exists* at a state, not whether the route resolves — it says nothing about redirects, and
although it names the editions on a node it cannot tell you which one a request would be served.
The Route API result carries both.

## Redirected ancestors

A redirect configured on an ancestor's path makes `RouteClient.get` return `type: 'redirect'`
with `redirect.targetUrl`. The module treats it like `notFound` — level kept, link dropped —
because the target is an arbitrary URL that may sit outside the trail or outside the site.
Linking to `redirect.targetUrl` is a reasonable project decision when the target is internal;
make it deliberately, not by accident.

## Missing ancestors

`includeAncestors: true` is documented as returning ancestors of matched nodes, but the endpoint
also states that a caller whose role carries a **branch-scoped `PrmNodeRead` policy** gets a
response filtered server-side to those branches, and that consumers must not assume the response
contains the entire project map.

The symptom is a trail that starts in the middle of the tree with no home crumb, only in the
environment whose key is scoped. Use a key with unscoped project map read for the frontend, and
treat a first crumb whose path is not `/` as a signal rather than something to paper over:

```ts
if (chain[0]?.path !== ROOT_NODE_PATH) {
  console.warn(`Breadcrumb trail for ${nodePath} does not start at the root`);
}
```

A genuine gap in the middle shows up the same way — as a jump of more than one path segment
between consecutive crumbs. Neither case should throw; render what you have.

## More than one project map

`getNodes` takes an optional `projectMapId`. A project with a single project map does not need
it. A project with several — a marketing site and a docs site, or one per brand — does: without
it the query can match a node with the same path in the wrong map and build a trail through the
wrong branch. Pass it from configuration, not from the request.

## Nodes with allowed query strings

A node can declare allowed query strings (`node.data.queryStrings`), which are part of how it
resolves. `Route.expand` only emits them when you both list them in `allowedQueryParams` and
supply values in `dynamicInputValues`:

```ts
new Route(node.path).expand({
  dynamicInputValues: dynamicInputs,
  allowedQueryParams: node.data?.queryStrings?.map((qs) => qs.name),
});
```

An ancestor whose query string is required for a meaningful page but absent from the current
request produces a link to the bare path. That is usually right — the ancestor's own default
applies — but check it against the node's configured default (`qs.value`) if the page depends on
one.

## Title lookups that fail

Two failures look alike and must be handled differently:

| Route API result | Meaning | Crumb |
|---|---|---|
| `type: 'notFound'` / `type: 'redirect'` | There is no page to link to at this state | Node name, **no link** |
| `type: 'composition'` with no usable value for the title parameter | The page exists; the parameter is empty, or you projected the wrong field id | Node name, **link kept** |
| Thrown error (network, 5xx) | Unknown | Node name, link kept, error logged |

The middle row is the one to look at twice. A `select` projection with a field id that does not
exist on the component is a silent no-op: the field is simply absent from
`composition.parameters`, every crumb falls back to its node name, and nothing anywhere reports a
problem. If every title in the trail is a node name, check the id against the component
definition's `titleParameter` before suspecting the API.

## Failure policy

Breadcrumbs are secondary navigation. An API error while fetching the trail must not take the
page down — and in a component an author placed, an unhandled rejection does exactly that.

The trail module guards both of its requests: `fetchChain` catches a failed tree request and
returns an empty trail, `resolvePage` catches a failed title request and returns no title. The
component then renders nothing, or renders node names. Keep the guards where they are — inside
the module, not in every caller — so a component that calls `getBreadcrumbTrail` without a
`try/catch` is still safe. Anything you add to the module that awaits a network call gets the
same treatment.

Log both. A silently empty trail on every page is the failure mode that survives to production,
because nothing on the page looks broken.

## What to check before shipping

- A page three or more levels deep: every ancestor is linked and every link resolves.
- A dynamic page (`/products/:category/:sku`): no crumb href contains `:`.
- A page under a placeholder ancestor: the level is present and is not a link.
- The root page and a one-level-deep page: nothing renders.
- A pattern in the playground: nothing renders, no error in the server log.
- If the project is localized: switch locale and confirm both the titles and the hrefs change.
- A page whose title parameter is bound to a dynamic input (`${category}`): the crumb shows the
  resolved value, not the expression.
- Preview a release that retitles an ancestor: the crumb shows the release title; production
  does not. Identical output means `releaseId` is not reaching the Route API call.
- An ancestor with a draft-only composition: linked in preview, unlinked in production.
- The network tab for one page: one project map request, one small route request per linked
  ancestor, none for the current page, none with `withCompositionData`.
- The rendered JSON-LD parses, its `name` values match what is on screen, and every entry but
  the last has an `item`. Run a page whose trail crosses a placeholder ancestor through the Rich
  Results Test — that is the case that produces an invalid list rather than a wrong-looking one.
- Two URLs under the same dynamic node (`/products/shoes` and `/products/hats`) render
  different crumbs. Identical trails mean a cache key that is missing `dynamicInputs`.
