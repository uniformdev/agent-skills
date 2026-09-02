# Personalization and A/B testing

## Required packages

Install the following additional packages to enable Uniform Context on Next.js Page Router:

```
@uniformdev/context
@uniformdev/context-next
@uniformdev/context-react
```

IMPORTANT: `@uniformdev/cli` must also be installed as a **devDependency** for manifest download.

## Pulling the context manifest

Uniform Context relies on a static manifest that defines user classification criteria and active test names. Download it to a local file that gets built into the application.

Add this script to `package.json`:

```json
"uniform:pull:manifest": "uniform context manifest download --output ./src/uniform/contextManifest.json"
```

The `dev` and `build` npm scripts should run `uniform:pull:manifest` before beginning their regular tasks.

Also add these npm scripts for manifest management:

```json
"uniform:manifest": "uniform context manifest download --output ./lib/uniform/contextManifest.json",
"uniform:publish": "uniform context manifest publish"
```

Add `uniform:manifest` to the `dev` and `build` scripts so it runs before the dev server starts or before production build runs.

CRITICAL: These manifest scripts are for Page Router only. Do not add them to App Router projects.

## Creating the context factory

Create `src/uniform/createUniformContext.ts` to initialize Uniform Context with the manifest:

```tsx
import {
  Context,
  ManifestV2,
  ContextPlugin,
  enableDebugConsoleLogDrain,
  enableContextDevTools
} from "@uniformdev/context";
import { NextCookieTransitionDataStore } from "@uniformdev/context-next";
import { NextPageContext } from "next";
import manifest from "./contextManifest.json";

export function createUniformContext(
  serverContext?: NextPageContext
): Context {
  const plugins: ContextPlugin[] = [
    enableContextDevTools(),
    enableDebugConsoleLogDrain("debug"),
  ];

  const context = new Context({
    defaultConsent: true,
    manifest: manifest as ManifestV2,
    transitionStore: new NextCookieTransitionDataStore({
      serverContext,
    }),
    plugins,
  });

  return context;
}
```

## Providing context in _app.tsx

Wrap the application with `UniformContext` in `pages/_app.tsx`:

```tsx
import { UniformContext } from "@uniformdev/context-react";
import { UniformAppProps } from "@uniformdev/context-next";
import { createUniformContext } from "../uniform/createUniformContext";

const clientContext = createUniformContext();

function MyApp({
  Component,
  pageProps,
  serverUniformContext,
}: UniformAppProps) {
  return (
    <UniformContext
      context={serverUniformContext ?? clientContext}
      outputType={"standard"}
    >
      <Component {...pageProps} />
    </UniformContext>
  );
}

export default MyApp;
```

## Enabling SSR personalization in _document.tsx

Configure server-side personalization in `pages/_document.tsx`:

```tsx
import { enableNextSsr } from "@uniformdev/context-next";
import { createUniformContext } from "../uniform/createUniformContext";

// Inside your Document class:
static async getInitialProps(
  ctx: DocumentContext
): Promise<DocumentInitialProps> {
  const serverTracker = createUniformContext(ctx);
  enableNextSsr(ctx, serverTracker);
  return await Document.getInitialProps(ctx);
}
```
