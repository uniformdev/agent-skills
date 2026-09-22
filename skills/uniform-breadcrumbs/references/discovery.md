# Discovering the breadcrumb surface

Run this before writing a line. Breadcrumbs sit on top of three things that vary per project —
the SDK that resolves routes, the shape of the project map, and the parameter the page component
calls its title — and all three are cheap to read and expensive to guess.

## 1. Does the project already have breadcrumbs?

```bash
grep -rniE 'breadcrumb|aria-label=.breadcrumb|BreadcrumbList' \
  --include='*.tsx' --include='*.ts' --include='*.vue' --include='*.svelte' \
  src app pages components lib 2>/dev/null | head -20
```

A partial implementation is the common case: markup with a hand-written array, a trail built by
splitting the path, or titles read from `withCompositionData` / `getCompositionById`. Keep the
component's public id and its rendered markup; replace only the data source.

## 2. Which packages are installed, and at what version?

Two packages carry the trail: `@uniformdev/project-map` (client, `Route`, `getNodeLocalePath`)
and `@uniformdev/canvas` (`RouteClient`, projections). Both are dependencies of the framework
SDKs, so they are usually already present.

```bash
node -p "Object.entries(require('./package.json').dependencies).filter(([k])=>k.startsWith('@uniformdev')).map(e=>e.join('@')).join('\n')"

# the version that is actually installed — package.json is not an exported subpath, so grep it
grep '"version"' node_modules/@uniformdev/canvas/package.json
```

Every `@uniformdev/*` package in a project must resolve to the same version. If
`@uniformdev/project-map` is absent, install it at the version the others are already on.

**`RouteClient.get` needs `@uniformdev/canvas` 20.74.7 or later.** Below that the class has only
`getRoute`, which takes the same options and the same `select` projection — projections have been
on the route call since 20.72.3. So an older project does not have to bump to project a title;
it has to call the other method. Read which one is there (step 3) rather than assuming.

## 3. What do the installed packages actually export?

Do not write these signatures from memory or from a docs page — read them from the package that
will be compiled:

```bash
# the route client and the projection types
grep -n "declare class RouteClient\|^type Projection = \|^type ProjectionSpec" \
  node_modules/@uniformdev/canvas/dist/index.d.ts

# which method this copy has — `get` plus a deprecated `getRoute`, or `getRoute` alone.
# Either way it takes `select`; write against whichever one is there.
awk '/^declare class RouteClient/,/^}/' node_modules/@uniformdev/canvas/dist/index.d.ts

# what a projection can say
awk '/^type FieldsProjection = \{/,/^};/' node_modules/@uniformdev/canvas/dist/index.d.ts
awk '/^type SlotsProjection = \{/,/^};/' node_modules/@uniformdev/canvas/dist/index.d.ts

# the project map side
grep -n "ProjectMapClient\|ROOT_NODE_PATH\|getNodeLocalePath\|declare class Route" \
  node_modules/@uniformdev/project-map/dist/index.d.ts

# the query options getNodes accepts, with their doc comments — note there is no `locale`
awk '/project-map-nodes.*: \{/,/^        put:/' node_modules/@uniformdev/project-map/dist/index.d.ts | head -80

# the node shape you will be mapping over
awk '/ProjectMapNodeDefinition: \{/,/^        \};$/' node_modules/@uniformdev/project-map/dist/index.d.ts
```

Use a range match (`awk '/start/,/end/'`), not `grep -A N` — a fixed `-A` silently truncates a
long interface and drops exactly the fields you were looking for.

## 4. Where do the five inputs live in this SDK?

The names differ per SDK; the five values do not. Find them in the types rather than assuming:

```bash
# App Router — the context every component receives, and the page state hanging off it
grep -n "matchedRoute\|dynamicInputs\|compositionState\|releaseId\|locale: string" \
  node_modules/@uniformdev/next-app-router-shared/dist/index.d.ts | head

# App Router — the server-only client factories
grep -n "getProjectMapClient\|getRouteClient" node_modules/@uniformdev/next-app-router/dist/index.d.ts

# Page Router — what the composition handler is handed
grep -n "HandleRouteCompositionFunction\|matchedRoute\|dynamicInputs" \
  node_modules/@uniformdev/canvas-next/dist/route/index.d.ts | head
grep -n "releaseId" node_modules/@uniformdev/canvas-next/dist/models-*.d.ts

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
| `releaseId` | The release being previewed — on the page state (App Router) or the preview data (Page Router) |

Framework SDK mechanics — where that context comes from, and which clients are server-only —
belong to the framework skill, not this one. See
[uniform-nextjs-app-router](../../uniform-nextjs-app-router/SKILL.md) and
[uniform-nextjs-page-router](../../uniform-nextjs-page-router/SKILL.md).

## 5. Which parameter is the page's title?

The Route API call projects one field, and it has to be the right one. The page component's
definition names it as `titleParameter`. Read it; do not assume `title` or `pageTitle`:

```bash
# synced component definitions, whatever folder the project keeps them in — every component
# has one, so read the line from the page component's file, not the first hit
grep -rn "^titleParameter:" --include='*.yaml' --include='*.yml' . 2>/dev/null | grep -v node_modules | grep -i page
grep -rn '"titleParameter"' --include='*.json' . 2>/dev/null | grep -v node_modules | grep -i page

# or ask the project directly
npx uniform component get page 2>/dev/null | grep -i titleParameter
```

A misspelled id is a silent no-op — the projection returns no parameters and every crumb
silently falls back to its node name — so this step is not optional. If several page types have
different title parameters, note all of them; the trail module accepts a list.

## 6. Is the project map localized, and how?

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
| `@uniformdev/canvas` below 20.74.7 | `.get` is not there yet — call `getRoute` with the same `select`, or bump every `@uniformdev/*` package together |
| `titleParameter` found | Pass it to the trail; several page types → pass the list |
| No locale segments anywhere | Skip `expanded: true` locale handling; pass no `locale` |
| A `:locale` dynamic node | Pass the locale through `dynamicInputs`; the Route API reads it from the path |
| Locale path segments on nodes | `expanded: true`, `getNodeLocalePath`, and pass `locale` to the Route API explicitly |
| More than one project map | Pass `projectMapId` to both `getNodes` and `RouteClient.get`, from configuration |
