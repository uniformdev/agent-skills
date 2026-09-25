---
name: uniform-breadcrumbs
description: Building a breadcrumb trail in a Uniform frontend from the project map node hierarchy — resolving the current node, walking its ancestors with the project map client, titling each crumb through the Route API with a `select` projection, expanding dynamic and localized paths, and rendering accessible markup with BreadcrumbList structured data. Use when adding breadcrumbs or a "you are here" trail to a Uniform page, deriving parent-page links from project map ancestors, or fixing a trail that shows raw slugs, unexpanded `:token` links, unresolved `${...}` titles, wrong-locale or wrong-edition titles, duplicate titles on dynamic pages, or a home crumb that 404s.
license: MIT
metadata:
  author: uniformdev
  version: "1.1.1"
---

# Breadcrumbs from the Uniform project map

How to build a breadcrumb trail whose source of truth is the project map node tree, not the
request URL. Uniform already stores the hierarchy, the author-facing label for every level, and
the path template for every level — a breadcrumb component's whole job is to read that tree,
ask the Route API for each page's title, and render it.

Project map fundamentals — nodes, dynamic inputs, route matching — live in the `uniform-sdk`
skill ([references/routing.md](../uniform-sdk/references/routing.md)). This skill assumes them
and does not restate them.

## The two rules everything else follows

**Walk the node tree. Never split the URL.** Deriving crumbs from `pathname.split('/')` looks
equivalent on a demo site and is wrong on every real one:

| URL-splitting produces | The node tree has |
|---|---|
| `products` → `"Products"` (title-cased slug) | `node.name` — the label the author typed |
| `shoes` on `/products/shoes` | a dynamic node `/products/:category`; the crumb text is a *value*, not a segment |
| a link for every segment | `type: "placeholder"` nodes that are grouping levels with no page behind them |
| `/fr/produits` → `"Produits"` | `node.locales["fr-FR"].name`, authored per locale |
| whatever order the URL happens to be in | ancestors ordered by depth, gaps and all |

**The project map client gives you the tree. The Route API gives you the titles.** The two
clients answer different questions and only one of them resolves content:

| Question | Client | Why |
|---|---|---|
| Which nodes are above this one, what are they called, what are their path templates, do they have a page? | `ProjectMapClient.getNodes` | It is the tree. It knows nothing about what a composition *says* |
| What is the title of the page at `/en/products/shoes`, in this locale, in this release, with its dynamic inputs applied? | `RouteClient.get` with a `select` projection | Only the Route API resolves locale, editions, dynamic inputs, dynamic tokens and data-bound parameters — and the projection trims the answer to one field |

A trail built from the project map alone works in a demo and breaks on the first real
project: titles bound to a dynamic input arrive as the raw `${...}` expression, the title an
edition actually publishes never shows, and a localized title is the default locale's. See the
trap list.

## The five inputs

Everything below is a pure function of these. Get them once, at the top of the component.

| Input | What it is |
|---|---|
| `nodePath` | The **unresolved** project map path of the current node, e.g. `/products/:category` — the route the request matched, not the URL it arrived on |
| `dynamicInputs` | Values captured from the URL, e.g. `{ category: "shoes" }` (a `:locale` node's value arrives here too) |
| `locale` | The locale the route resolved with, if the project is localized |
| `state` | `CANVAS_PUBLISHED_STATE` (64) or `CANVAS_DRAFT_STATE` (0) |
| `releaseId` | The release being previewed, or `undefined`. Without it an editor previewing a release sees base titles |

Every SDK that resolves a route carries all five. Which object holds them is your framework
SDK's business — find them rather than assuming:
[references/discovery.md](references/discovery.md).

## The pipeline

1. **Bail if there is no project map context.** A composition rendered by ID — pattern preview,
   playground, contextual editing of an unattached composition — has no ancestors, and the SDK
   hands you a sentinel rather than a path. Reject any `nodePath` that does not start with `/`.
2. **One tree request.** `ProjectMapClient.getNodes({ path, includeAncestors: true, depth: 0,
   expanded: true })` returns the node and its ancestors, with localized paths. Do not fetch level
   by level, and do not add `withCompositionData` — it is metadata, not content.
3. **Filter to the chain and order by depth.** Keep only nodes whose path segments are a prefix
   of the current node's, then sort by segment count. Never trust response order.
4. **Expand each path** with `new Route(getNodeLocalePath(node, locale)).expand({
   dynamicInputValues })`. A placeholder node, or a path with a `:token` still in it, gets no href.
5. **Title each linked ancestor through the Route API** — `routeClient.get({ path: href, state,
   releaseId, withComponentIDs: false, select: { fields: { only: [titleParameter] }, slots: {
   only: [] } } })` — and read the one parameter back. Fall back to
   `node.locales[locale].name ?? node.name` when the route is not a composition or the parameter
   is empty. Run these in parallel; the chain is short.
6. **Never fetch the current page.** You are rendering that composition; its title is in props.

That produces the data. Shipping it is the other half.

## What "done" means

All five, or the feature is half-built. Each one is the part someone reliably drops:

- **Its own component, registered in the project's component resolver** — the same way every
  other component type there is registered. Building the trail inside the page component works
  and is the wrong shape: it pins breadcrumbs to one position on every page, and an author who
  wants them below the hero, or gone from landing pages, has to ask a developer.
- **Accessible markup** — `<nav aria-label>`, `<ol>`, `aria-current="page"` on the last crumb,
  separators kept out of the accessibility tree.
- **`BreadcrumbList` JSON-LD, from the same array the component renders.** Not optional and not
  a nice-to-have: rich-result eligibility is most of why a site has breadcrumbs at all, and a
  trail whose structured data disagrees with what is on screen is worse than none.
- **Nothing rendered when the trail is unbuildable** — no project map context, an API failure,
  or a single crumb. Never a thrown error, never a placeholder message in production markup.
  Every network call the trail makes is wrapped in a `try/catch` that logs and degrades — the
  tree fetch to an empty trail, a title fetch to the node name — inside the trail module, so
  no caller can forget it.
- **Server-side only.** Both clients carry `UNIFORM_API_KEY`, and `@uniformdev/project-map` has
  no `server-only` guard.

Working implementation: [references/building-the-trail.md](references/building-the-trail.md).

## Decision rules

**Which name to show.** Three sources, in this order:

| Source | Use it when |
|---|---|
| The composition's title parameter, via `RouteClient.get` on the **expanded** path with `select: { fields: { only: [titleParameter] }, slots: { only: [] } }` | **Default for every linked ancestor.** It is what the page itself shows in its `<title>`, resolved for locale, edition and dynamic inputs, and the projection makes the response a few hundred bytes |
| `node.locales[locale].name` | Fallback when the project map is localized (`expanded: true` required) and the route did not yield a title |
| `node.name` | Fallback everywhere else, and the only choice for a `placeholder` node — it has no composition to ask |

`titleParameter` is the id of the parameter the page component uses as its title — read it from
the component definition's `titleParameter` field, do not guess. If the project has several page
types with different title parameters, project all of them (`only: ['pageTitle', 'title']`) and
take the first non-empty value.

**Whether to link a crumb.**

| Node | Link |
|---|---|
| `type: "placeholder"` | **No.** A grouping level with no composition — render text, keep the level visible |
| `type: "composition"` with a dynamic path you can expand | Yes |
| `type: "composition"` whose expanded path still contains `:` | **No.** You would ship `/products/:category` as an href |
| `type: "composition"` whose Route API result is `notFound` at published state | **No.** The node exists; the page has never been published |
| The current page (last crumb) | **No.** `aria-current="page"`, not an anchor |

**Server only.** Both clients authenticate with `UNIFORM_API_KEY`. Build the trail in a server
component, loader, or `getServerSideProps`. Unlike the framework SDK's client helpers,
`@uniformdev/project-map` carries no `server-only` guard — importing it into a client component
compiles cleanly and ships the key to the browser.

**Never construct a Uniform client at the top level of a Page Router page module.** A page file
is a client module; only what Next's `getServerSideProps` transform eliminates stays out of the
browser bundle, and that is not something a reviewer can verify by reading the file. Put the
clients behind a lazy accessor in their own module and call it from inside the handler. The App
Router's `getProjectMapClient` / `getRouteClient` already import `server-only`, so there the
factories are the answer.

## Framework specifics

This skill is framework-neutral by design. Where the five inputs live, whether the trail is
built in a server component or a loader, and how the SDK's own clients cache are your framework
SDK's business:

- **Next.js App Router** — [uniform-nextjs-app-router](../uniform-nextjs-app-router/SKILL.md),
  whose `references/advanced.md` covers `getProjectMapClient` and `getRouteClient`. Prefer them
  over constructing the clients yourself: they read the environment, switch off caching for
  draft and editor state, and tag route fetches by path.
- **Next.js Page Router** — [uniform-nextjs-page-router](../uniform-nextjs-page-router/SKILL.md).
  No factories here: build the two clients yourself, behind a lazy accessor in its own module,
  and call it from inside the route handler.

The per-SDK mapping — which field feeds which input — is in
[references/discovery.md](references/discovery.md), as greps you run against the installed
package rather than a table that goes stale.

## Traps and things that do not exist

- **There is no breadcrumb API, hook, or component in any `@uniformdev/*` package.** No
  `useBreadcrumbs`, no `getBreadcrumbs`, no JSON-LD helper. `getNodes` with `includeAncestors`
  plus `RouteClient.get` with a projection are the whole primitive; you write the rest.
- **The project map client does not resolve compositions.** `withCompositionData: true` returns
  identity and status — `id`, `type`, `name`, `slug`, `typeName`, `locales`, `modified`, plus
  edition fields — which is metadata for the project map UI. What it never returns is *resolved
  content*: no parameters, no dynamic input resolution, no data resources, no localized value.
  A crumb titled from `compositionData.name` is the composition's authoring name, identical for
  every value of a dynamic segment, and the option inflates the response for nothing. Never
  derive a title from it.
- **Never fetch an ancestor with `getCompositionById` either.** It takes no dynamic input values
  and no release, so a title bound to a dynamic input comes back as the raw `${...}` expression,
  and the payload is the whole composition tree. The Route API call on the *expanded* path is
  the call that resolves all of it — that is what it exists for.
- **The Route API needs the expanded path, not the template.** `get({ path: '/:locale/products' })`
  is `notFound`; `get({ path: '/en/products' })` is the composition. Expand first, then ask.
- **`getRoute` is deprecated. The method is `RouteClient.get`.** Same options, same `select`.
- **The projection key is `select`, not `projections`.** The parts that matter here are
  `fields: { only: [...] }` and `slots: { only: [] }` — the latter is how you say "no slots at
  all". The endpoint's own docs give this exact pair as their breadcrumb example. The full spec
  (`fieldTypes`, `fields.locales`, `fields.blockDepth`, `slots.depth`, `slots.named`) is on
  `ProjectionSpec` in the installed package.
- **`RouteClient.get` requires `@uniformdev/canvas` ≥ 20.74.7 — the projection itself does not.**
  `select` has been on the route call since 20.72.3; 20.74.7 is where `getRoute` was renamed to
  `get` and `Projection` became an exported type. Below it, the same call works as
  `getRoute({ ..., select })`. Check which method the installed copy has before you bump
  anything.
- **An unknown field name in `select` is a silent no-op.** Misspell the title parameter and the
  field is simply absent from `composition.parameters`, with no error anywhere. Guard with
  optional chaining and fall back to the node name — and check the id against the component
  definition.
- **`getNodes` has no `locale` option.** Localization on the tree is `expanded: true` plus
  `node.locales[locale]`. Localization of a title is the Route API's job: the `:locale` segment
  in the expanded path selects it, or pass `locale` explicitly when the project uses locale path
  segments instead of a locale node.
- **`Route.expand()` does not fail on a missing value — it leaves the `:token` in place.**
  `new Route('/products/:category/:sku').expand({ dynamicInputValues: { category: 'shoes' } })`
  returns `/products/shoes/:sku`. Nothing throws, nothing warns. Check the result for a segment
  starting with `:` before using it as an href or a route path.
- **A node existing does not mean a page is live.** Project map changes take effect immediately
  and have no publish step, so an ancestor node can point at a composition that has never been
  published. The Route API tells you: at `state: 64` it resolves to `notFound`. Unlink the crumb,
  keep the level.
- **`includeAncestors` can legitimately return a partial chain.** If the API key's role has a
  branch-scoped `PrmNodeRead` policy, the response is filtered server-side to that branch — the
  trail then starts mid-tree instead of at the root. The type docs say it outright: consumers
  must not assume the response contains the entire project map.
- **Do not fetch the current page's title.** You are already rendering that composition; its
  title is in props.
- **`parentPath`, `isLeaf`, and locale `path` are only returned with `expanded: true`.** Without
  it, `node.locales` omits inherited locales entirely and `getNodeLocalePath` falls back to the
  default path.

## Resources

See `references/` for detailed guidance:
- [Discovery](references/discovery.md) — find the existing breadcrumb surface, the installed
  package versions, the title parameter, and where this SDK keeps the five inputs, before
  writing anything
- [Building the trail](references/building-the-trail.md) — the complete `getBreadcrumbTrail`
  module with both clients, SDK wiring, titles through the Route API, dynamic paths, localized
  paths, and caching
- [Rendering](references/rendering.md) — markup and accessibility, separators, home crumb,
  truncating deep trails, and `BreadcrumbList` structured data
- [Edge cases](references/edge-cases.md) — root pages, placeholder and unpublished ancestors,
  patterns and playground, multiple project maps, and query-string nodes
