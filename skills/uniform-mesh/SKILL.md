---
name: uniform-mesh
description: Building Uniform Mesh integrations end to end — scaffold with the CLI, define the mesh-manifest, implement locations, register/install and deploy — plus how to discover and use @uniformdev/design-system components for composing location UI. Covers custom data connectors, Canvas parameter editors, editor tools, personalization algorithms, asset library providers, dashboard/project tools, and edgehancers, on Next.js Page Router (canonical) and App Router (with client-component boundaries). Use when building, scaffolding, or extending a custom Mesh integration, or when choosing and using Uniform design-system components inside a Mesh location.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# Uniform Mesh integrations

Build a custom Uniform Mesh integration from a plain use case. A Mesh integration is a
Next.js web app you host, described by a `mesh-manifest.json`, that renders custom UI into
specific **locations** in the Uniform dashboard over iframe messaging. This skill covers
the whole path: turn a use case into the right locations, scaffold, implement with the mesh
SDK and the Uniform design system, and register it. For the exact manifest structure,
always rely on the manifest JSON schema (see `references/manifest.md`) rather than
memorized field lists.

## Build loop

1. **Clarify the use case** — what external system or authoring need, and what the author
   does in the UI (pick a record? edit a value? browse assets?).
2. **Map it to location types** — see the map below and `references/use-case-recipes.md`.
3. **Scaffold or extend** — in a *new* project, `npx @uniformdev/cli@latest new-integration`
   (Page Router Next.js app, API keys, initial registration). In an *existing* project, skip
   the scaffold: add the dependencies and wire the app in place, leaving the existing
   `package.json`, `tsconfig.json`, and framework config intact — merge into them, never
   overwrite them or drop entries you did not add. See `references/build-workflow.md`.
4. **Wire the app** — `MeshApp` provider (Page Router `_app.tsx`, or an App Router client
   provider). Add one page/route per location.
5. **Author the manifest** — per-environment `mesh-manifest.{local,canary,stable}.json`;
   declare each location under `locations`. Validate against the manifest JSON schema
   (`references/manifest.md`).
6. **Implement locations** — `useMeshLocation<'...'>()` for value/metadata; build the UI
   from `@uniformdev/design-system`.
7. **Register + install** — `uniform integration definition register` then
   `uniform integration install <type>`. An integration must be registered to a team and
   installed to a project before it can be tested.
8. **Deploy** — host on HTTPS, point the manifest `baseLocationUrl` at it, re-register.

## Location types → use case (quick map)

Which location serves which use case. The exact manifest keys and fields for each are
defined by the manifest JSON schema — **validate against it** (`references/manifest.md`);
they change across SDK versions, so don't trust field lists memorized here.

| Use case | Location |
|---|---|
| Connect an external system as a data source | data connector |
| Custom Canvas component parameter | parameter type editor |
| Toolbar/tool inside the Canvas editor | editor tool |
| Custom personalization | personalization algorithm |
| External asset provider | asset library / asset parameter |
| Integration-wide config | settings |
| Install-time description | install |
| Tool in the project nav | project tool |
| Tool in the dashboard nav | dashboard tool |

## Two things to always get right

- **The design system is required.** Build all location UI from `@uniformdev/design-system`
  (`Input`, `InputSelect`, `Callout`, `LoadingOverlay`, `ScrollableList`, …) so the
  integration matches the dashboard. Do not hand-roll raw `<input>`/`<select>`/`<button>` or
  add another UI kit. The installed package is the source of truth for what exists and what
  props it takes — `references/design-system.md` shows how to look it up.
- **Secrets go in the data source only.** Store API keys/tokens in the data source value
  (`custom` and header/parameter values are encrypted). Never put secrets in `settings` or
  data type values, and never hard-code them.

## Next.js Routers

- **Page Router is canonical** — the CLI scaffolds it and every shipped integration uses
  it. Prefer it.
- **App Router works but is unofficial.** Because locations rely on `useMeshLocation` hooks
  and iframe `postMessage`, every location component must be a client component
  (`"use client"`), and `MeshApp` must be wrapped in a client provider. See
  `references/build-workflow.md`.

## Resources

See `references/` for detailed guidance:
- [Manifest](references/manifest.md) — the manifest JSON schema is the source of truth for
  structure and fields; validate against it instead of hardcoding
- [Build workflow](references/build-workflow.md) — scaffold → manifest → app setup (both
  routers) → register → deploy, with CLI verbs and scripts
- [Design system](references/design-system.md) — how to discover which `@uniformdev/design-system` component
  to use, real snippets, error/loading/validation/dialog patterns, storybook links
- [Use case recipes](references/use-case-recipes.md) — use case → locations → components →
  example pointers
- [Data connector](references/data-connector.md) — deep dive: the data source / data type /
  data resource editors and the picker pattern
- [Custom edgehancers](references/custom-edgehancers.md) — edge hooks for a connector:
  `preRequest` for auth, draft/published and cache control; `request` for batching, OAuth and
  response shaping — with the batching helpers, deployment and testing
- [Identity delegation](references/identity-delegation.md) — call Uniform APIs as the signed-in
  author: the session-token → BFF exchange → sealed-cookie flow, expiry recovery, the CSRF and
  CORS rules that must not be broken, plus manifest/runtime authorization
- [Editor state API](references/editor-state.md) — `editorState`: read and mutate the
  surrounding composition/entry from a location, so configuration done in your UI writes real
  parameters. Which locations expose it, the `updateNodeProperty` contract, and the traps
