# Personalization

Personalization and A/B testing are configured in the Uniform dashboard and evaluated automatically at the edge by the middleware. No component code is required — the SDK renders the winning variant transparently.

Client-side hooks let you read and update the visitor's Uniform context (quirks and scores). Any component using these hooks or browser APIs must be marked `"use client"`.

**Push client components as far down the tree as possible.** Adding `"use client"` turns a component and all its children into client components (more JavaScript, no SSR for that subtree). Extract the interactive piece (e.g. a button that updates a quirk) into its own small client component embedded in a server-rendered parent.

## useUniformContext hook

Access and update the context on the client. The `context` object may be `undefined` while the client-side context initializes — always check before using it:

```tsx
"use client";

import { useUniformContext } from "@uniformdev/next-app-router/component";
import { useEffect, useState } from "react";

export const QuirkButton = () => {
  const { context } = useUniformContext();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (context?.quirks !== undefined) {
      setIsLoading(false);
    }
  }, [context?.quirks]);

  const updateQuirk = async () => {
    setIsLoading(true);
    try {
      await context?.update({
        quirks: { country: "Canada" },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={updateQuirk} disabled={isLoading}>
      Set Country to Canada
    </button>
  );
};
```

## useQuirks hook

Reactive access to visitor quirk values (re-renders when quirks change):

```tsx
"use client";

import { useQuirks } from "@uniformdev/next-app-router/component";

export const LocationBanner = () => {
  const quirks = useQuirks();

  return <div>Current country: {quirks?.country ?? "Unknown"}</div>;
};
```

## useScores hook

Reactive access to visitor score values:

```tsx
"use client";

import { useScores } from "@uniformdev/next-app-router/component";

export const InterestIndicator = () => {
  const scores = useScores();

  return <div>Tech interest score: {scores?.tech ?? 0}</div>;
};
```

## Custom client context component

For advanced scenarios (custom Context plugins, analytics integrations, custom dev tools behavior), supply a custom `clientContextComponent` to `UniformComposition`. Note the import path: `@uniformdev/next-app-router-client`.

```tsx
"use client";

import { ContextPlugin, enableContextDevTools } from "@uniformdev/context";
import { useRouter } from "next/navigation";
import {
  createClientUniformContext,
  useInitUniformContext,
  ClientContextComponent,
} from "@uniformdev/next-app-router-client";

export const CustomUniformClientContext: ClientContextComponent = ({
  manifest,
  disableDevTools,
  defaultConsent,
  experimentalQuirkSerialization,
  compositionMetadata,
}) => {
  const router = useRouter();

  useInitUniformContext(() => {
    const plugins: ContextPlugin[] = [];

    if (!disableDevTools) {
      plugins.push(
        enableContextDevTools({
          onAfterMessageReceived: () => {
            router.refresh();
          },
        })
      );
    }

    return createClientUniformContext({
      manifest,
      plugins,
      defaultConsent,
      experimental_quirksEnabled: experimentalQuirkSerialization,
    });
  }, compositionMetadata);

  return null;
};
```

Pass it to the composition route (see `references/setup.md`):

```tsx
<UniformComposition
  code={code}
  resolveRoute={resolveRouteFromCode}
  resolveComponent={resolveComponent}
  clientContextComponent={CustomUniformClientContext}
/>
```

## Server-side precomputation

To evaluate tests and personalizations server-side (for fully static output), use `precomputeComposition`. It walks the composition tree and replaces personalization and test containers with their resolved (winning) variants. Selectively control what to evaluate with filter functions:

```tsx
import { precomputeComposition } from "@uniformdev/next-app-router";

await precomputeComposition({
  pageState: result.pageState,
  route: result.route,
  evaluateTests: true,                          // or a filter function
  evaluatePersonalizations: (pz) => pz.name !== "skip-this-one",
});
```

## Setting quirks in middleware

Quirks can also be injected server-side in middleware (e.g. from headers or cookies) — see `references/routing.md`. On Vercel, geo-IP quirks are populated automatically (below).

## Vercel geo-IP quirks

On Vercel, the middleware automatically populates quirks from geo-IP headers — available for personalization rules with no extra configuration:

| Header | Quirk key |
|--------|-----------|
| `x-vercel-ip-country` | `vc-country` |
| `x-vercel-ip-country-region` | `vc-region` |
| `x-vercel-ip-city` | `vc-city` |
