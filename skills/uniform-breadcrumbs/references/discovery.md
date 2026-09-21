# Discovering the breadcrumb surface

Run this before writing a line. Breadcrumbs sit on top of two things that vary per project —
the SDK that resolves routes, and the shape of the project map — and both are cheap to read
and expensive to guess.

## 1. Does the project already have breadcrumbs?

```bash
grep -rniE 'breadcrumb|aria-label=.breadcrumb|BreadcrumbList' \
  --include='*.tsx' --include='*.ts' --include='*.vue' --include='*.svelte' \
  src app pages components lib 2>/dev/null | head -20
```

A partial implementation is the common case: markup with a hand-written array, or a trail built
by splitting the path. Keep the component's public id and its rendered markup; replace only the
data source.

## 2. Which packages are installed, and at what version?

`@uniformdev/project-map` carries the client, the path-template engine, and the locale helper.
It is a dependency of the framework SDKs, so it is usually already present.

```bash
node -p "Object.entries(require('./package.json').dependencies).filter(([k])=>k.startsWith('@uniformdev')).map(e=>e.join('@')).join('\n')"
```

Every `@uniformdev/*` package in a project must resolve to the same version. If
`@uniformdev/project-map` is absent, install it at the version the others are already on.

## 3. What does the installed project map package actually export?

Do not write these signatures from memory or from a docs page — read them from the package that
will be compiled:

```bash
grep -n "ProjectMapClient\|ROOT_NODE_PATH\|getNodeLocalePath\|declare class Route" \
  node_modules/@uniformdev/project-map/dist/index.d.ts

# the query options getNodes accepts, with their doc comments
awk '/project-map-nodes.*: \{/,/^        put:/' node_modules/@uniformdev/project-map/dist/index.d.ts | head -80

# the node shape you will be mapping over
awk '/ProjectMapNodeDefinition: \{/,/^        \};$/' node_modules/@uniformdev/project-map/dist/index.d.ts
```

Use a range match (`awk '/start/,/end/'`), not `grep -A N` — a fixed `-A` silently truncates a
long interface and drops exactly the fields you were looking for.

## 4. Where do the four inputs live in this SDK?

The names differ per SDK; the four values do not. Find them in the types rather than assuming:

```bash
# App Router v2 — the context every component receives
grep -n "matchedRoute\|dynamicInputs\|compositionState\|locale" \
  node_modules/@uniformdev/next-app-router-shared/dist/index.d.ts | head

# Page Router — the props the route handler returns from getServerSideProps
grep -n "matchedRoute\|dynamicInputs\|RouteCompositionResult" \
  node_modules/@uniformdev/canvas-next/dist/route/index.d.ts | head

# any SDK — the node paths carried on the composition itself, as a fallback
grep -rn "projectMapNodes" node_modules/@uniformdev/canvas/dist/index.d.ts | head -3
```

Neither grep matching means the project is on some other SDK, not that the values are missing:
they are what route matching produced, so whatever resolved the route has them. Find that
resolver and read its return type before falling back to `projectMapNodes`.

| Input | What to look for |
|---|---|
| `nodePath` | The matched route on the route/composition context; failing that, `composition.projectMapNodes[0].path` |
| `dynamicInputs` | The captured path-segment and query-string values for this request |
| `locale` | The locale the route resolved with |
| `state` | The composition state the page was rendered at |

Framework SDK mechanics — where that context comes from, and which clients are server-only —
belong to the framework skill, not this one. See
[uniform-nextjs-app-router](../../uniform-nextjs-app-router/SKILL.md) and
[uniform-nextjs-page-router](../../uniform-nextjs-page-router/SKILL.md).

## 5. Is the project map localized, and how?

Two different setups need different code ([building-the-trail.md](building-the-trail.md)), and
they are distinguishable from the routing configuration:

```bash
# a locale dynamic node shows up as a ":locale" segment in middleware or route config
grep -rn ':locale\|LOCALE_DYNAMIC_INPUT_NAME\|locales' \
  middleware.ts next.config.* src app pages 2>/dev/null | head
```

If neither appears, the project map is single-locale and `locale` stays `undefined`.

## What to conclude

| Finding | Consequence |
|---|---|
| Breadcrumbs already exist | Replace the data source, keep the markup and the component's public id |
| `@uniformdev/project-map` missing | Add it at the version the other `@uniformdev/*` packages use |
| No locale segments anywhere | Skip `expanded: true` locale handling; pass no `locale` |
| A `:locale` dynamic node | Pass the locale through `dynamicInputs`, not through `getNodeLocalePath` |
| More than one project map | Pass `projectMapId` to `getNodes`, from configuration |
