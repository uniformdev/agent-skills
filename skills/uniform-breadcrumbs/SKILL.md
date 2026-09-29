---
name: uniform-breadcrumbs
description: Building a breadcrumb trail in a Uniform frontend from the project map node hierarchy — resolving the current node, walking its ancestors with the project map client, titling each crumb through the Route API with a `select` projection, expanding dynamic and localized paths, and rendering accessible markup with BreadcrumbList structured data. Use when adding breadcrumbs or a "you are here" trail to a Uniform page, deriving parent-page links from project map ancestors, or fixing a trail that shows raw slugs, unexpanded `:token` links, unresolved `${...}` titles, wrong-locale or wrong-edition titles, duplicate titles on dynamic pages, or a home crumb that 404s. Also use when a breadcrumb trail is slow or delays the page render, to decide whether it should be cached or streamed behind a Suspense boundary.
license: MIT
metadata:
  author: uniformdev
  version: "1.2.0"
---

# Breadcrumbs from the Uniform project map

The project map already stores the page hierarchy, a label for every level, and every level's
path template. A breadcrumb component reads that tree, asks the Route API for each ancestor's
title, and renders the result.

Project map fundamentals — nodes, dynamic inputs, route matching — are in the `uniform-sdk`
skill ([references/routing.md](../uniform-sdk/references/routing.md)).

## Rules for Building Breadcrumbs

### 1. Traversal: Walk the Node Tree (Do Not Split URLs)
Deriving breadcrumbs directly from `pathname.split('/')` fails in real-world scenarios. Always use the project map node tree.

| URL Splitting (`pathname.split('/')`) | Node Tree Traversal |
| :--- | :--- |
| Generates `"Products"` from `/products` | Uses `node.name` (the author-defined label) |
| Shows raw slug `'shoes'` for `/products/shoes` | Resolves dynamic category values properly |
| Creates non-existent pages/links for URL segments | Ignores `placeholder` nodes without target pages |
| Hardcodes/infers locale from URL (`/fr/...`) | Uses localized names (`node.locales["fr-FR"].name`) |
| Strict URL sequence | Correct parent-child hierarchy regardless of URL structure |

---

### 2. Client Responsibilities: Project Map vs. Route API

* **`ProjectMapClient.getNodes`**: Returns the tree structure (node hierarchy, path templates, and page existence). It does **not** handle page content or dynamic composition.
* **`RouteClient.get`** (with `select` projection): Resolves content for a specific path (e.g., `/en/products/shoes`). Handles locales, dynamic inputs, editions, and data bindings to return exact titles.

> **Note:** Relying solely on the Project Map results in unrendered placeholder expressions like `${...}` or fallback locale titles. Always use the Route API to fetch dynamic and localized node titles.

## The five inputs

Everything below is a pure function of these. Get them once, at the top of the component.

| Input | What it is |
|---|---|
| `nodePath` | The **unresolved** project map path of the current node, e.g. `/products/:category` — the route the request matched, not the URL it arrived on |
| `dynamicInputs` | Values captured from the URL, e.g. `{ category: "shoes" }` (a `:locale` node's value arrives here too) |
| `locale` | The locale the route resolved with, if the project is localized |
| `state` | `CANVAS_PUBLISHED_STATE` (64) or `CANVAS_DRAFT_STATE` (0) |
| `releaseId` | The release being previewed, or `undefined` |

Every SDK that resolves a route carries all five. Which object holds them differs per SDK —
find them rather than assuming: [references/discovery.md](references/discovery.md).

## The pipeline

1. **Ask the user what the trail should show.** Before writing code, confirm:
   - **Which field labels a crumb.** Offer the page component definition's `titleParameter` as
     the default — read it from the definition, do not assume `title`
     ([discovery](references/discovery.md#5-which-field-labels-a-crumb)). Some projects keep a
     shorter dedicated field for navigation.
   - **Which levels are links.** Default: grouping (`placeholder`) nodes, and pages not published
     at the current state, render as plain text.
   - **Whether the trail starts with a home crumb.** Default: yes.

   If you cannot ask — a non-interactive run — use the defaults and say so in your summary.
2. **One tree request.** `ProjectMapClient.getNodes({ path: nodePath, includeAncestors: true,
   depth: 0, expanded: true })` returns the current node and its ancestors, root first — the API
   sorts them by path. Do not fetch level by level.
3. **Expand each ancestor path** with `new Route(getNodeLocalePath(node, locale)).expand({
   dynamicInputValues: dynamicInputs })`. An ancestor's `:tokens` are a subset of the current
   route's, so the current request's dynamic inputs always fill them.
4. **Title each linked ancestor through the Route API** — `routeClient.get({ path: href, state,
   releaseId, withComponentIDs: false, select: { fields: { only: [labelField] }, slots: { only:
   [] } } })` — and read that one parameter back. Fall back to
   `node.locales[locale]?.name ?? node.name`. Run the calls in parallel.
5. **Do not fetch the current page.** You are already rendering it; its title is in props.

## What "done" means

- **Its own component, registered in the project's component resolver**, the same way as every
  other component type there. Built into the page component, the trail is pinned to one spot on
  every page, and an author cannot move it or leave it out.
- **Nothing rendered when the trail cannot be built.** Wrap every request in a `try/catch`
  inside the trail module: a failed tree request gives an empty trail, a failed title request
  gives the node name. A trail with a single crumb renders nothing too. Never throw out of the
  component — it takes the whole page down over secondary navigation.
- **The trail does not block the page** — see below.
- **Markup and structured data** as in [references/rendering.md](references/rendering.md):
  `<nav aria-label>`, `<ol>`, `aria-current="page"`, and `BreadcrumbList` JSON-LD built from the
  same array the component renders.

Working implementation: [references/building-the-trail.md](references/building-the-trail.md).

## Do not block the page

The trail waits on one tree request plus one title request per linked ancestor. Caching only
helps repeat traffic: a cold cache, draft, preview, a release and in-context editing all pay the
full round trip, and an author can place the component on any page.

**App Router: always give it a Suspense boundary.** When the data is already cached the boundary
costs nothing. Declare it where the component is registered — `resolveComponent` takes a
`suspense` entry, so neither the trail module nor the component changes:

```tsx
return { component: Breadcrumbs, suspense: { fallback: BreadcrumbsFallback } };
```

`fallback` is a component, not an element — the SDK calls `createElement()` on it. Do not reach
for a skeleton by reflex: this component renders nothing on pages with no trail, and a skeleton
there flashes and then disappears. The rule for choosing one is in
[references/rendering.md](references/rendering.md#the-suspense-fallback).

**Page Router: cache, and skip the work on pages that will not render the trail.**
`getServerSideProps` runs before any byte is sent, so there is no boundary to stream behind.

## Framework specifics

- **Next.js App Router** — [uniform-nextjs-app-router](../uniform-nextjs-app-router/SKILL.md),
  whose `references/advanced.md` covers `getProjectMapClient` and `getRouteClient`. Use them
  rather than constructing the clients yourself: they read the environment, switch off caching
  for draft and editor state, and tag route fetches by path.
- **Next.js Page Router** — [uniform-nextjs-page-router](../uniform-nextjs-page-router/SKILL.md).
  Build the two clients yourself, behind a lazy accessor in its own module, and call it from
  inside the route handler.

## Traps

- **The Route API needs the expanded path, not the template.** `get({ path: '/:locale/products' })`
  is `notFound`; `get({ path: '/en/products' })` is the composition. Expand first, then ask.
- **A wrong field id in `select` fails silently.** The API accepts it and returns no parameter,
  so every crumb falls back to its node name with no error anywhere. Check the id against the
  component definition.
- **Forward `releaseId`.** Without it, an editor previewing a release sees base titles in the
  trail while the page itself shows the release.

## Resources

See `references/` for detailed guidance:
- [Discovery](references/discovery.md) — find the existing breadcrumb surface, the installed
  package versions, the crumb label field, and where this SDK keeps the five inputs, before
  writing anything
- [Building the trail](references/building-the-trail.md) — the complete `getBreadcrumbTrail`
  module with both clients, SDK wiring, titles through the Route API, dynamic paths, localized
  paths, and what the trail costs the page: caching, cache tags, and streaming it behind a
  boundary
- [Rendering](references/rendering.md) — markup and accessibility, separators, home crumb,
  truncating deep trails, the Suspense fallback, and `BreadcrumbList` structured data
- [Edge cases](references/edge-cases.md) — root pages, placeholder and unpublished ancestors,
  patterns and playground, multiple project maps, and query-string nodes
