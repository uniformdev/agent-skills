# Wiring the profile lookup

## Where quirks have to be set

Quirks take effect where personalization is evaluated, so set them there. Set anywhere else, they
arrive late or get lost.

| SDK | Personalization is evaluated | Set CDP quirks |
|---|---|---|
| App Router (`@uniformdev/next-app-router`) | In middleware for the first render, then in the browser whenever the browser context's quirks change | [In middleware and in the browser context](#app-router) |
| Page Router (`@uniformdev/canvas-next`, `@uniformdev/context-next`) | During server rendering (with `enableNextSsr`), then in the browser. Static pages (`getStaticProps`) and pages rendered without `enableNextSsr`: only in the browser | [On the server context, or in the browser](#page-router) |
| Any other setup | Where the project creates the `Context` that personalizes | On that context, before it evaluates |

## Identity

Look up by the identity chosen in the [questions](audit.md#questions). The CDP's browser library
sets its cookie after the page loads, so a first-time visitor's first request arrives without it:
skip the lookup and render the default variant.

## App Router

- **Middleware**: pass the quirks per request with `handleUniformRoute({ request, quirks })`.
- **Browser context**: write the same mapped quirks with `context.update({ quirks })`. Middleware
  hands its quirks to the browser through one channel, the `ufqc` cookie: it is set only with
  consent and read only on the first full page load. The `uniform-nextjs-app-router` skill, if
  installed, has the details. The cache cookie below is readable on every load, including the
  first.

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
- **In the browser only**, the one choice for static pages: a server route that does the lookup,
  called after mount, then `context.update({ quirks })`. The HTML shows the default variant until
  then, and on static pages it must also hydrate as that variant ([below](#static-pages)).

Quirks written in the browser reach the server only when `NextCookieTransitionDataStore` gets
`experimental_quirksEnabled: true`. With it, and with consent, server rendering reads them from the
`ufvdqk` cookie on the next request. The `uniform-nextjs-page-router` skill, if installed, has the
details.

### Static pages

When the HTML was rendered without the visitor's data, the browser `Context` still loads the
visitor's stored quirks and scores from local storage as it is created, and `<Personalize>`
evaluates them in the first render. A returning visitor whose data picks a non-default variant gets
a hydration error: React discards the server HTML and renders the whole page again in the browser.
Hydrate with an empty `Context`, then switch to the visitor's after mount. The recipe replaces the
provider on every page, so it fits a site where every page is static. When some pages render with
`enableNextSsr`, keep their `serverUniformContext` and transfer state, and give the empty context to
the static pages alone.

```tsx
// pages/_app.tsx. Create the empty one first: each Context constructor registers itself as the one
// the Canvas editor drives (window.__UNIFORM_CONTEXTUAL_EDITING_CONTEXT__), and the last one wins.
const hydrationContext =
  typeof window === "undefined"
    ? undefined
    : new Context({ manifest, defaultConsent: false, partitionKey: "hydration" });
const context = createUniformContext();

function VisitorContext({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <UniformContext context={hydrated ? context : (hydrationContext ?? context)} includeTransferState="never">
      {children}
    </UniformContext>
  );
}
```

- Its own `partitionKey` keeps it away from the stored visitor data, and `defaultConsent: false`
  keeps its storage empty.
- `children` comes from `App`, so after the switch only the components that read the context
  render again.
- `includeTransferState="never"`: static pages ship without server state.
- `useQuirks()` keeps the quirks of the context it mounted with. A component that calls it before
  the switch shows the empty context's `{}` until the visitor's quirks next change; render it after
  the switch.
- Give the component that writes CDP quirks the visitor's `Context` as a prop. The provider's is
  the empty one until hydration: quirks written there are lost, and the effect runs again after the
  switch, looking the visitor up twice.

## Caching

Keep the mapped quirks in a cookie set on the response: the identity they belong to, the quirks,
and an expiry. Look up again only when the identity changes or the entry expires. Middleware runs
on every request, and profile APIs are rate-limited
([Segment's limit](segment.md#endpoint-and-auth)). Cache "no profile" too, since new visitors are
most of the traffic. Keep raw traits and the CDP token on the server: the cookie holds the mapped
quirks. Leave `httpOnly` off so the browser can read them, on the App Router and in the
browser-only path.

In the browser-only path the browser decides when to call the lookup route, so the cookie also
holds a key built from the cookies that identify the visitor: the CDP's IDs and the demo override
([mock-profile-api.md](mock-profile-api.md#switching-profiles)). Apply the cached quirks while that
key matches and the cookie lives; otherwise call the route, which sets a new cookie. Check again on
every client-side navigation: the CDP library sets its ID after the first page loads, and the Page
Router navigates without a reload.

## Failures

A 404 means the visitor has no profile: map it as one (`traitsToQuirks(null)`) and cache it. On a
timeout, a 429 or a 5xx, catch the error, keep the quirks already cached (if any), leave the cache
unchanged, and let the page render.

## Consent

Uniform personalizes visitors with or without consent; consent decides whether quirks are stored
in cookies. On the Page Router, `new Context({ requireConsentForPersonalization: true })` makes
personalization wait for consent; the App Router middleware always personalizes. Follow the
project's consent handling (on the App Router, `handleUniformRoute` takes `defaultConsent` per
request). If the CDP lookup itself needs consent, run it only for visitors who gave it.
