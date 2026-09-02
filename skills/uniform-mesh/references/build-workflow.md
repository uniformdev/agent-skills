# Build workflow

End to end: from a use case to a registered, hosted Mesh integration.

## 1. Scaffold

```bash
npx @uniformdev/cli@latest new-integration
```

This creates a Next.js **Page Router** app, sets up API keys, and registers an initial
manifest. Prefer it over building the project by hand.

The scaffold produces roughly:

```
your-integration/
├── pages/
│   ├── _app.tsx                 # MeshApp provider
│   └── <one page per location>.tsx
├── components/
├── lib/
├── mesh-manifest.local.json     # per-environment manifests
├── mesh-manifest.canary.json
├── mesh-manifest.stable.json
├── package.json
└── tsconfig.json
```

## 2. Dependencies

These are the entries a Mesh integration **adds**. In an existing project, merge them into
the current `package.json` — do not write the file from this snippet, and do not remove
entries that are already there (test tooling, type packages, scripts, `"type"`). Adding a
dependency is usually just `npm install <pkg>@<version>`.

Pin the `@uniformdev/*` packages to the **same** version (they are released together):

```json
// add to "dependencies"
"@uniformdev/mesh-sdk-react": "^20.30.0",
"@uniformdev/design-system": "^20.30.0",

// add to "devDependencies"
"@uniformdev/cli": "^20.30.0"
```

A Mesh integration also needs `next`, `react`, and `react-dom` (the CLI scaffold pins
`next@^14.2.0`, `react@^18.2.0`, `react-dom@^18.2.0`) plus `typescript` — an existing
Next.js app already has them, so leave whatever versions it is on.

**Match the project's module type.** If its `package.json` has `"type": "module"`, any config
file you add must be ESM — use `export default` in `postcss.config.js` / `next.config.js`, or
name the file `.cjs` if you write `module.exports`. A CommonJS `.js` config inside an ESM
package throws `module is not defined in ES module scope` and breaks the build toolchain.

`@uniformdev/design-system` components use emotion, so also add `@emotion/react` if you
write `css={...}` props. Add `@uniformdev/mesh-edgehancer-sdk` (same version) only if you
implement edgehancers.

## 3. Wire the app with `MeshApp`

`MeshApp` (from `@uniformdev/mesh-sdk-react`) initializes the SDK, shows a loading state
while connecting to the dashboard, and provides the SDK + location contexts. Every
location component must render inside it.

### Page Router (canonical)

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { MeshApp } from '@uniformdev/mesh-sdk-react';
import { IconsProvider } from '@uniformdev/design-system';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshApp>
      <IconsProvider>
        <Component {...pageProps} />
      </IconsProvider>
    </MeshApp>
  );
}
```

Page Router components are client-rendered by default, so no extra directives are needed.

### App Router (works, but unofficial)

The CLI and official starter use Page Router. App Router works because a Mesh location is
just a client-rendered Next.js app inside an iframe — but there is no official Uniform
guidance for it, so verify behavior. Two rules:

1. Wrap `MeshApp` in your own `"use client"` provider (it has no `"use client"` of its own).
2. Every location component that calls `useMeshLocation` must start with `"use client"`.

```tsx
// app/providers.tsx
'use client';
import { MeshApp } from '@uniformdev/mesh-sdk-react';
export function MeshProviders({ children }: { children: React.ReactNode }) {
  return <MeshApp>{children}</MeshApp>;
}
```

```tsx
// app/layout.tsx  (may stay a server component; the provider is the client boundary)
import { MeshProviders } from './providers';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><MeshProviders>{children}</MeshProviders></body>
    </html>
  );
}
```

```tsx
// app/<location>/page.tsx
'use client';
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';
export default function Location() {
  const { value, setValue } = useMeshLocation('paramType');
  // ...
}
```

## 4. Author the manifest

Keep one manifest per environment (`mesh-manifest.local.json` points `baseLocationUrl` at
`http://localhost:<port>`, `stable` at the deployed HTTPS URL). At minimum a manifest has a
globally unique integration `type`, display metadata, `baseLocationUrl`, and a `locations`
object declaring which locations the integration provides.

**Get the structure from the schema, not from memory** — manifest fields change across SDK
versions. See `manifest.md` for the schema and reference the schema from the manifest via
`$schema` so your editor validates it. Add the use-case-specific locations under
`locations` (see `use-case-recipes.md` and `data-connector.md`); any editor URL you omit
falls back to Uniform's built-in HTTP editor.

## 5. Implement locations

Each location page reads and writes through the SDK:

```tsx
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';

const { value, setValue, metadata } = useMeshLocation<'settings'>();
// value    — the editable data (persist via setValue)
// metadata — read-only context (project id, parent data source, …)

setValue((prev) => ({ newValue: { ...prev, apiKey }, options: { isValid: true } }));
```

Navigate the dashboard only via `useMeshLocation().router.navigatePlatform(path, opts)` —
iframe context makes `window.location` / `next/navigation` unreliable. Build the UI from
`@uniformdev/design-system` (see `design-system.md`).

## 6. Register and install

Registration deploys the manifest to your team; installation adds it to a project. An
integration must be registered **and** installed before it can be tested in the dashboard.

```bash
# register / update the definition for the team (per environment)
uniform integration definition register ./mesh-manifest.local.json

# install into a project
uniform integration install <your-integration-type>

# remove / uninstall
uniform integration definition remove <your-integration-type>
uniform integration uninstall <your-integration-type>
```

Typical `package.json` scripts wrap these:

```json
{
  "scripts": {
    "dev": "cross-env PORT=4000 next dev",
    "build": "next build",
    "deploy:uniform:local":  "uniform integration definition register ./mesh-manifest.local.json",
    "deploy:uniform:stable": "uniform integration definition register ./mesh-manifest.stable.json",
    "install-to-project": "uniform integration install your-integration-type"
  }
}
```

These CLI commands need `UNIFORM_API_KEY` (a team-admin key), `UNIFORM_TEAM_ID`, and
`UNIFORM_PROJECT_ID` in the environment.

## 7. Deploy

Host the app on public HTTPS (Netlify/Vercel/etc.), point `baseLocationUrl` in the stable
manifest at that URL, and re-register with `deploy:uniform:stable`. The dashboard loads
locations from that URL inside iframes, so it must be reachable and allow being framed by
Uniform.

## Local development

Run `npm run dev`, register `mesh-manifest.local.json` (localhost `baseLocationUrl`),
install into a test project, then open the relevant place in the dashboard to see the
location render.
