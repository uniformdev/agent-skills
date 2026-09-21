---
name: uniform-breadcrumbs
description: Building a breadcrumb trail in a Uniform frontend from the project map node hierarchy — resolving the current node, walking its ancestors, titling each crumb, expanding dynamic and localized paths, and rendering accessible markup with BreadcrumbList structured data. Use when adding breadcrumbs or a "you are here" trail to a Uniform page, deriving parent-page links from project map ancestors, or fixing a trail that shows raw slugs, unexpanded `:token` links, duplicate titles on dynamic pages, or a home crumb that 404s.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Breadcrumbs from the Uniform project map

How to build a breadcrumb trail whose source of truth is the project map node tree, not the
request URL. Uniform already stores the hierarchy, the author-facing label for every level, and
the path template for every level — a breadcrumb component's whole job is to read that tree and
render it.

Project map fundamentals — nodes, dynamic inputs, route matching — live in the `uniform-sdk`
skill ([references/routing.md](../uniform-sdk/references/routing.md)). This skill assumes them
and does not restate them.

## The rule everything else follows

**Walk the node tree. Never split the URL.** Deriving crumbs from `pathname.split('/')` looks
equivalent on a demo site and is wrong on every real one:

| URL-splitting produces | The node tree has |
|---|---|
| `products` → `"Products"` (title-cased slug) | `node.name` — the label the author typed |
| `shoes` on `/products/shoes` | a dynamic node `/products/:category`; the crumb text is a *value*, not a segment |
| a link for every segment | `type: "placeholder"` nodes that are grouping levels with no page behind them |
| `/fr/produits` → `"Produits"` | `node.locales["fr-FR"].name`, authored per locale |
| whatever order the URL happens to be in | ancestors ordered by depth, gaps and all |

## The four inputs

Everything below is a pure function of these. Get them once, at the top of the page or component.

| Input | What it is |
|---|---|
| `nodePath` | The **unresolved** project map path of the current node, e.g. `/products/:category` — the route the request matched, not the URL it arrived on |
| `dynamicInputs` | Values captured from the URL, e.g. `{ category: "shoes" }` |
| `locale` | Active locale, only if the project map has locale-specific path segments |
| `state` | `CANVAS_PUBLISHED_STATE` (64) or `CANVAS_DRAFT_STATE` (0) |

Every SDK that resolves a route carries all four. Which object holds them is your framework
SDK's business — find them rather than assuming:
[references/discovery.md](references/discovery.md).

## The pipeline

1. **Bail if there is no project map context.** A composition rendered by ID — pattern preview,
   playground, contextual editing of an unattached composition — has no ancestors, and the SDK
   hands you a sentinel rather than a path. Reject any `nodePath` that does not start with `/`.
2. **One request.** `ProjectMapClient.getNodes({ path, includeAncestors: true, depth: 0 })`
   returns the node and its ancestors. Do not fetch level by level.
3. **Filter to the chain and order by depth.** Keep only nodes whose path segments are a prefix
   of the current node's, then sort by segment count. Never trust response order.
4. **Title each crumb** — node name by default, see the decision rule below.
5. **Expand each path** with `new Route(template).expand({ dynamicInputValues })`, then drop the
   link if any `:token` survived.

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
- **Server-side only.** `ProjectMapClient` carries `UNIFORM_API_KEY` and no `server-only` guard.

Working implementation: [references/building-the-trail.md](references/building-the-trail.md).

## Decision rules

**Which name to show.** Four different names are available and they are not interchangeable:

| Source | Requires | Use it when |
|---|---|---|
| `node.name` | nothing | **Default.** It is the label the author sees in the project map tree |
| `node.locales[locale].name` | `expanded: true` | The project map is localized. Falls back to `node.name` |
| `node.compositionData.name` | `withCompositionData: true` | You want the composition's own name; identical for every node pointing at it |
| A parameter on the composition | a second API call per node | Last resort. See the trap below |

**Whether to link a crumb.**

| Node | Link |
|---|---|
| `type: "placeholder"` | **No.** A grouping level with no composition — render text, keep the level visible |
| `type: "composition"` with a dynamic path you can expand | Yes |
| `type: "composition"` whose expanded path still contains `:` | **No.** You would ship `/products/:category` as an href |
| The current page (last crumb) | **No.** `aria-current="page"`, not an anchor |

**Server only.** `ProjectMapClient` authenticates with `UNIFORM_API_KEY`. Build the trail in a
server component, loader, or `getServerSideProps`. Unlike the framework SDK's client helpers,
`@uniformdev/project-map` carries no `server-only` guard — importing it into a client component
compiles cleanly and ships the key to the browser.

## Framework specifics

This skill is framework-neutral by design. Where the four inputs live, whether the trail is
built in a server component or a loader, and how the SDK's own clients cache are your framework
SDK's business:

- **Next.js App Router** — [uniform-nextjs-app-router](../uniform-nextjs-app-router/SKILL.md),
  whose `references/advanced.md` covers the server clients
- **Next.js Page Router** — [uniform-nextjs-page-router](../uniform-nextjs-page-router/SKILL.md)

The per-SDK mapping — which field feeds which input — is in
[references/discovery.md](references/discovery.md), as greps you run against the installed
package rather than a table that goes stale.

## Traps and things that do not exist

- **There is no breadcrumb API, hook, or component in any `@uniformdev/*` package.** No
  `useBreadcrumbs`, no `getBreadcrumbs`, no JSON-LD helper. `ProjectMapClient.getNodes`
  with `includeAncestors` is the whole primitive; you write the rest.
- **`Route.expand()` does not fail on a missing value — it leaves the `:token` in place.**
  `new Route('/products/:category/:sku').expand({ dynamicInputValues: { category: 'shoes' } })`
  returns `/products/shoes/:sku`. Nothing throws, nothing warns. Check the result for a segment
  starting with `:` before using it as an href.
- **A node existing does not mean a page is live.** Project map changes take effect immediately
  and have no publish step, so an ancestor node can point at a composition that has never been
  published. Guard on `node.type === 'composition' && node.compositionId` before linking.
- **`includeAncestors` can legitimately return a partial chain.** If the API key's role has a
  branch-scoped `PrmNodeRead` policy, the response is filtered server-side to that branch — the
  trail then starts mid-tree instead of at the root. The type docs say it outright: consumers
  must not assume the response contains the entire project map.
- **Fetching an ancestor's composition returns it unresolved.** `getCompositionById` takes no
  dynamic input values, so a title parameter bound to a dynamic input comes back as the raw
  `${...}` expression, and a dynamic node's title is identical for every value of its segment.
  Prefer `dynamicInputs` or your own lookup over a composition fetch.
- **Do not fetch the current page's title.** You are already rendering that composition; its
  title is in props.
- **`parentPath`, `isLeaf`, and locale `path` are only returned with `expanded: true`.** Without
  it, `node.locales` omits inherited locales entirely.

## Resources

See `references/` for detailed guidance:
- [Discovery](references/discovery.md) — find the existing breadcrumb surface, the installed
  package versions, and where this SDK keeps the four inputs, before writing anything
- [Building the trail](references/building-the-trail.md) — the complete `getBreadcrumbTrail`
  module, SDK wiring, titles, dynamic paths, localized paths, and caching
- [Rendering](references/rendering.md) — markup and accessibility, separators, home crumb,
  truncating deep trails, and `BreadcrumbList` structured data
- [Edge cases](references/edge-cases.md) — root pages, placeholder and unpublished ancestors,
  patterns and playground, multiple project maps, and query-string nodes
