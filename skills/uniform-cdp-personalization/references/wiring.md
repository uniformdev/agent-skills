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

- **Middleware**: pass the quirks per request with `handleUniformRoute({ request, quirks })`
  ([routing.md](../../uniform-nextjs-app-router/references/routing.md#setting-quirks-in-middleware)).
  `uniformMiddleware(options)` is built when the module loads, so its options are the same for
  every visitor.
- **Browser context**: write the same mapped quirks with `context.update({ quirks })`
  ([personalization.md](../../uniform-nextjs-app-router/references/personalization.md#useuniformcontext-hook)).
  Middleware hands its quirks to the browser only through the `ufqc` cookie, which it sets only
  when the visitor has consented, and which the browser reads only on the first full page load.
  The cache cookie below is readable on every load, including the first.

```ts
export default async function middleware(request: NextRequest) {
  const cdp = await getCdpQuirks(request); // cache cookie, else lookup + traitsToQuirks
  const response = await handleUniformRoute({ request, quirks: cdp.quirks });
  if (cdp.lookedUp) setCdpCookie(response, cdp); // identity key, mapped quirks, expiry
  return response;
}
```

When the CDP's data is available only in the browser, the browser path is the only one: write the
quirks after the CDP library loads, and tell the user the page switches variant after it loads.

## Page Router

- **On the server**: where the server context is created
  ([personalization.md](../../uniform-nextjs-page-router/references/personalization.md#enabling-ssr-personalization-in-_documenttsx)),
  await the lookup, then `await serverContext.update({ quirks })` before rendering. Server quirks
  travel to the browser with the server state.
- **In the browser only**: a server route that does the lookup, called after mount, then
  `context.update({ quirks })`. The server HTML shows the default variant until then.

Quirks written in the browser stay in local storage unless `NextCookieTransitionDataStore` gets
`experimental_quirksEnabled: true`. With it, and with consent, they are also written to the
`ufvdqk` cookie, and server rendering reads them on the next request. The flag is tagged
`@deprecated` to mark it experimental, not to announce its removal.

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

Unless `requireConsentForPersonalization` is set, Uniform personalizes without consent; consent
decides whether quirks are stored in cookies. Follow the project's consent handling
([routing.md](../../uniform-nextjs-app-router/references/routing.md#override-default-consent-per-request)).
If the CDP lookup itself needs consent, skip it without consent.
