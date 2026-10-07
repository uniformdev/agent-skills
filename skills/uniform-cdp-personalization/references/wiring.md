# Wiring the profile lookup

## Where quirks have to be set

Quirks count only where personalization is evaluated; set anywhere else, they arrive late or
never.

| SDK | Personalization is evaluated | Set CDP quirks |
|---|---|---|
| App Router (`@uniformdev/next-app-router`) | In middleware for the first render, then in the browser whenever the browser context's quirks change | [In middleware and in the browser context](#app-router) |
| Page Router (`@uniformdev/canvas-next`, `@uniformdev/context-next`) | During server rendering (with `enableNextSsr`), then in the browser | [On the server context, or in the browser](#page-router) |
| Any other setup | Where the project creates the `Context` that personalizes | On that context, before it evaluates |

## Identity

Look up by the identity chosen in the [questions](audit.md#questions). A first-time visitor has no
CDP cookie on the first request, because the CDP's browser library sets it after the page loads:
skip the lookup and render the default variant.

## App Router

- **Middleware**: pass the quirks per request with `handleUniformRoute({ request, quirks })`.
- **Browser context**: write the same mapped quirks with `context.update({ quirks })`. Middleware
  hands its quirks to the browser only through the `ufqc` cookie, which it sets only with consent,
  and which the browser reads only on the first full page load; the `uniform-nextjs-app-router`
  skill, if installed, has the details. The cache cookie below is readable on every load,
  including the first.

```ts
export default async function middleware(request: NextRequest) {
  const cdp = await getCdpQuirks(request); // cache cookie, else lookup + traitsToQuirks
  const response = await handleUniformRoute({ request, quirks: cdp.quirks });
  if (cdp.lookedUp) setCdpCookie(response, cdp); // identity key, mapped quirks, expiry
  return response;
}
```

```tsx
"use client"; // rendered once in the root layout; reads the context UniformComposition creates
export function CdpQuirks() {
  const { context } = useUniformContext();
  useEffect(() => {
    const cdp = readCdpCookie(); // the cache cookie the middleware set
    if (context && cdp) context.update({ quirks: cdp.quirks });
  }, [context]);
  return null;
}
```

When the CDP's data is available only in the browser, the browser path is the only one: write the
quirks after the CDP library loads, and tell the user the page switches variant after it loads.

## Page Router

- **On the server**: in `getInitialProps` of `pages/_document.tsx`, where the server context is
  passed to `enableNextSsr`, await the lookup, then `await serverContext.update({ quirks })` before
  `Document.getInitialProps(ctx)` renders. Server quirks travel to the browser with the server
  state.
- **In the browser only**: a server route that does the lookup, called after mount, then
  `context.update({ quirks })`. The server HTML shows the default variant until then.

Quirks written in the browser never reach the server unless `NextCookieTransitionDataStore` gets
`experimental_quirksEnabled: true`; with it, and with consent, server rendering reads them from the
`ufvdqk` cookie on the next request. The `uniform-nextjs-page-router` skill, if installed, has the
details.

## Caching

Keep the mapped quirks in a cookie set on the response: the identity they belong to, the quirks,
and an expiry. Look up again only when the identity changes or the entry expires. Middleware runs
on every request, and profile APIs are rate-limited
([Segment's limit](segment.md#endpoint-and-auth)). Cache "no profile" too, since new visitors are
most of the traffic. Never put raw traits or the CDP token in the cookie. On the App Router, leave
out `httpOnly` so the browser can read the quirks.

## Failures

A 404 means no profile: map it as one (`traitsToQuirks(null)`) and cache it. On a timeout, a 429
or a 5xx, keep the cached quirks or none, cache nothing, and do not throw.

## Consent

Uniform personalizes without consent; consent decides whether quirks are stored in cookies. The
App Router middleware has no option to require consent; on the Page Router,
`new Context({ requireConsentForPersonalization: true })` does. Follow the project's consent
handling (on the App Router, `handleUniformRoute` takes `defaultConsent` per request). If the CDP
lookup itself needs consent, skip it without consent.
