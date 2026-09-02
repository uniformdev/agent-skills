# Routing

## Routing in Uniform

Uniform's _Project Map_ feature enables Uniform authors to create and manage routes for their frontend applications. These routes can be static or dynamic, and can be used to display different compositions for different paths. To render a composition for a given path, frontend applications define a catch-all route that delegates routing to the Uniform _Route API_, which takes a path and resolves the correct composition instance data to display for that path.

### Agent boundaries

Project map nodes and redirects are managed by authors in the Uniform dashboard — not via the MCP server. Project map changes take effect immediately (there is no publish step), so they are intentionally excluded from MCP automation.

The agent's role for routing is to:
- Implement the catch-all route in the frontend framework
- Wire up the Route API call to resolve compositions
- Ensure component mappings cover all composition types returned by the route

When a user needs to create or reorganize project map nodes, direct them to the Uniform dashboard or the docs linked in "Further reading" below.

### How it works

1. The frontend defines a catch-all route (e.g. `[[...path]]` in Next.js or `[...path]` in SvelteKit)
2. The route handler calls the Uniform Route API with the current path
3. Uniform resolves the path to a composition instance
4. The composition data is returned and rendered using the component mapping

### Framework-specific implementation

Each framework has its own approach to implementing the catch-all route:
- **Next.js App Router**: `app/[[...path]]/page.tsx` with `retrieveRoute()`
- **Next.js Page Router**: `pages/[[...path]].tsx` with `withUniformGetServerSideProps()`
- **SvelteKit**: `src/routes/[...path]/+page.server.ts` with `createUniformLoad()`

See the framework-specific skills for detailed implementation patterns.

## Dynamic inputs

Dynamic inputs are values captured from the URL and passed to the composition attached to a project map node. They enable flexible, data-driven routing where parts of the URL can vary.

There are three types:

- **Dynamic path segments** — variable parts of the URL path (e.g. `/products/:productId`). The Route API matches incoming paths like `/products/42` to the dynamic node and passes the captured value to the composition.
- **Query strings** — URL query parameters (e.g. `?region=us-west`). Only explicitly allowed query strings are forwarded. They can be defined globally (project map level, available to all nodes) or per node.
- **Locale nodes** — a special dynamic segment that captures the locale code from the URL (e.g. `/:locale/products`). The value is validated against configured locales and used for locale resolution. For example, a locale node at `/:locale/products` matches `/en-US/products` and passes `en-US` to the composition for localized content delivery.

### Route matching priority

When multiple project map nodes or redirects match a path:
1. Redirect matches override project map matches
2. More specific paths win (fewest dynamic segments)
3. Matching evaluates the full path, not ancestors

Only the Route API supports dynamic route resolution. The project map and composition APIs only support literal paths. Dynamic segments use the colon prefix when querying (e.g. `/products/:productId`).

### Further reading

Point users to these docs for project map and redirect configuration:

- [Project maps](https://docs.uniform.app/docs/guides/project-maps) — hierarchical tree structure that defines the URL architecture
- [Routing](https://docs.uniform.app/docs/guides/composition/url-management/routing) — route resolution, dynamic routes, and localized routes
- [Dynamic inputs](https://docs.uniform.app/docs/guides/composition/url-management/routing/dynamic-inputs) — dynamic path segments, query strings, and locale nodes
- [Redirects](https://docs.uniform.app/docs/guides/composition/url-management/redirects) — no-code redirect management for URL changes and vanity URLs
