# Identity delegation

> ⚠️ **Developer Preview.** The SDK tags this API `@deprecated` to mean *beta — may change with
> breaking changes*. Requires **HTTPS** (including in local development) and **Identity
> delegation enabled on the integration** by Uniform.

Lets your integration call Uniform APIs **as the signed-in author**, without shipping a secret
to the browser or asking authors for an API key. You need a backend either way: Uniform's APIs
are not CORS-open, so a browser-only integration cannot call them at all.

The code lives in two places:

| Half | Import from | What you use |
|---|---|---|
| Integration UI | `@uniformdev/mesh-sdk-react` | `DelegationProvider`, `DelegationGate`, `useDelegation`, `useDelegationFetch` |
| Your backend (BFF) | `@uniformdev/mesh-sdk/server` | `DelegationTokenClient`, `sealDelegationSession` / `unsealDelegationSession`, `serializeSessionCookie`, `parseCookies`, `needsRefresh`, `verifyCsrf` |

## The flow

1. **UI**: `DelegationProvider` calls `sdk.getSessionToken()`, a postMessage to the dashboard
   parent frame. The dashboard returns a **one-time session token** that proves the current
   user's identity and expires in seconds (`SESSION_TTL_SECONDS`). The author may see a consent
   step.
2. **Your BFF**: the UI POSTs that token to your route. You exchange it via
   `DelegationTokenClient.exchangeSessionToken()` using your **integration secret, which never
   leaves the server**, then seal the resulting access token into a JWE and set it as an
   `HttpOnly` cookie. The browser never sees a usable token.
3. **Every later call**: your BFF routes read the cookie, unseal it, and call Uniform with
   `Authorization: Bearer <accessToken>`. The frontend only ever talks to your own routes.

Because the cookie is `HttpOnly`, JavaScript cannot tell whether a session exists — hence
`checkActive()`, a `GET` to your own status route.

## UI wiring

```tsx
'use client'; // App Router only
import {
  DelegationProvider, DelegationGate, useDelegationFetch, useUniformMeshSdk,
} from '@uniformdev/mesh-sdk-react';

function Inner() {
  const fetchWithDelegation = useDelegationFetch(); // adds the CSRF header, retries once on expiry
  // fetchWithDelegation('/api/composition?id=…')
}

export default function Tool() {
  const sdk = useUniformMeshSdk();
  return (
    <DelegationProvider
      sdk={sdk}
      checkActive={async () => (await fetch('/api/status')).ok}
      onSessionToken={async (sessionToken) => {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mesh-csrf': '1' },
          body: JSON.stringify({ sessionToken }),
        });
        if (!res.ok) throw new Error('exchange failed');
      }}
    >
      <DelegationGate><Inner /></DelegationGate>
    </DelegationProvider>
  );
}
```

`DelegationGate` renders the loading / disabled / error states for you; override any of them via
`loadingComponent`, `disabledComponent`, `errorComponent`. `useDelegation()` gives the raw
`{ status, error, reacquire }`, where status is `idle | acquiring | active | disabled | error`.

## BFF wiring

```ts
import {
  DELEGATION_COOKIE_NAME, DelegationTokenClient, needsRefresh, parseCookies,
  sealDelegationSession, serializeSessionCookie, unsealDelegationSession,
} from '@uniformdev/mesh-sdk/server';

// POST /api/session — the exchange
const { accessToken, refreshToken, expiresAt } = await new DelegationTokenClient({
  apiHost: process.env.UNIFORM_API_HOST!,
  integrationId: process.env.UNIFORM_INTEGRATION_ID!,
  integrationSecret: process.env.UNIFORM_INTEGRATION_SECRET!, // server only, never shipped
}).exchangeSessionToken(sessionToken);

res.setHeader(
  'Set-Cookie',
  serializeSessionCookie(
    DELEGATION_COOKIE_NAME,
    await sealDelegationSession({ accessToken, refreshToken, expiresAt }, process.env.MESH_SESSION_SECRET!)
  )
);

// Any guarded route — load or reject
const jwe = parseCookies(req.headers.cookie)[DELEGATION_COOKIE_NAME];
const session = jwe ? await unsealDelegationSession(jwe, process.env.MESH_SESSION_SECRET!) : null;
if (!session || needsRefresh(session)) {
  res.setHeader('Set-Cookie', serializeSessionCookie(DELEGATION_COOKIE_NAME, '', { maxAge: 0 }));
  return res.status(401).json({ code: 'delegation_expired' });
}
```

`serializeSessionCookie` defaults matter: `Path=/`, `Max-Age` 8 hours (the refresh-token
lifetime), and `Partitioned` (CHIPS) **on**, because the integration runs as a cross-site iframe
and CHIPS keys the cookie per embedding site.

## Expiry and recovery

The access token is short-lived (~15 minutes). Two recovery paths, both already handled if you
use the provider and `useDelegationFetch`:

- **Mid-session call**: your BFF returns `401` with `code: 'delegation_expired'`.
  `useDelegationFetch` re-exchanges and **retries the request once**; a second expiry is
  returned to the caller as-is.
- **Tab returns after being hidden**: the provider re-runs `checkActive()` and, if the session
  is gone, the full exchange. On by default.

`refreshToken` is `undefined` when the author consented for **this session only** — the BFF then
cannot silently rotate and must re-handshake through the frame. Handle that rather than assuming
a refresh token exists.

## Security rules

- **The integration secret stays on the server.** The session token is bearer-replayable inside
  its few-second window, which is exactly why the exchange is server-side.
- **Never enable permissive CORS on guarded BFF routes.** The `x-mesh-csrf: 1` header is a
  **constant, not a secret**; it defends only because browsers cannot set custom headers on
  cross-origin requests without a preflight, and these routes are not CORS-open. Opening CORS
  lets any site pass the check.
- **Check `Origin`/`Referer` against an allowlist** with `verifyCsrf` — pass origin strings only.
  `requireSecFetchSite` is off by default because Safari and older Firefox omit that header.
- **Refresh tokens are not single-use.** A captured refresh token is replayable until expiry by
  an attacker who also holds the integration secret. Treat both as equally sensitive.

## Authorization, which is a different question

Delegation answers *who* the request is for, not *whether* they may. For that:

- **Manifest**: `access.teamAdminRequired` on a location restricts it to team admins (typed
  `?: true` — set it or omit it, there is no `false`).
- **Runtime**: `metadata.user` carries `isAdmin`. `hasRole` and `hasPermissions` are standalone
  functions that *take* the user, not methods on it — `hasRole('developer', metadata.user)`,
  `hasPermissions(['…'], metadata.user)`. Use them for defence in depth inside the UI.

## Reference

- Reference example — full BFF routes, CSRF helper, and demo tool:
  https://github.com/uniformdev/examples/tree/main/mesh/mesh-auth
- Docs: https://docs.uniform.app/docs/integrations/mesh-integrations/identity-delegation
- Full server surface (token verification via JWKS, error classification, and more):
  ```bash
  grep "^export" node_modules/@uniformdev/mesh-sdk/dist/server/index.d.mts
  ```
