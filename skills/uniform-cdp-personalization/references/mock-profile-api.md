# Mock profile API

## Contract first

Make the mock answer the way the CDP does: the same status codes and the same response body. Plug
it in where the production client sends its request, as a `fetch` replacement or an alternative
base URL. URL building, auth, the trait list, 404 handling and the mapping then run unchanged.
For a CDP used through an SDK, replace the SDK call in the same way. A mock that returns quirks
directly keeps passing while the production mapping is broken.

## Fixture profiles

Keep fixtures in a JSON file keyed by the identifier the CDP uses (for example
`anonymous_id:demo-frequent-buyer`), with raw trait values: real booleans and numbers, the CDP's
own keys. Cover:

- each option of every quirk,
- the values on both sides of every bucket threshold,
- an empty profile,
- an unknown identifier, answered with the CDP's 404.

## The opt-in flag

Turn the mock on with its own server-side environment variable, for example `CDP_MOCK=true`, read
in server code only. The flag is the mock's only switch: a deploy that lost its token then shows
real visitors the default variants instead of demo profiles. When the credentials and the flag are
both missing, skip the CDP lookup and log one warning.

The browser learns that the mock, or the [demo against the real CDP](#demo-against-the-real-cdp), is
on from the lookup's answer (a field such as `demo: "mock"`), so the server alone decides; keep the
flags out of public environment variables. That answer lives in the
[cache cookie](wiring.md#caching). On the App Router, the middleware treats a cookie whose `demo`
field disagrees with the current flags as expired. In the browser-only path the server sees the change
only when the cookie expires, so after a flag changes the demo UI keeps its old state for the cache
period: tell the user to delete the cache cookie after switching a flag.

## Switching profiles

Every demo UI works the same way: choosing a profile sets an override identity cookie, then reloads
the page. On the App Router the middleware looks the new visitor up on that reload. In the
browser-only path, call the lookup route before reloading, so the reloaded page renders the new
visitor's variants straight away. The lookup honours the override only while a demo flag is on, so
viewing the site as someone else stays limited to demos.

"New visitor" clears the override. `context.forget()` would also clear the visitor's scores, test
assignments and every other quirk, and reset consent to `defaultConsent`; use it only when that is
the intent.

## Demo against the real CDP

To show the site as real profiles, add a second server-side flag, for example `CDP_DEMO=true`. It
turns on the same profile switching against the real CDP: the UI takes any identifier as the CDP's
profile explorer shows it (Segment: `anonymous_id:<id>` or `user_id:<id>`) instead of fixtures.
The response also says whether the CDP found the profile, so the user can tell an unknown ID from
a broken mapping. The lookup already trusts the CDP's cookie, which any visitor can set, so the flag
adds a UI over a trust that already exists; still keep it to local and demo environments.

## Demo UI

The variants offered in the [demo UI question](audit.md#questions):

| Variant | Fits | Costs |
|---|---|---|
| Floating panel, rendered only while the flag is on | Local development, most demos | Front-end code only |
| Profiles page (for example `/demo/profiles`), one card per fixture | Sales demos that start from a shareable page | One route |
| Canvas component that authors place on a page | Demos whose copy authors edit | A component definition, staged and handed to the user like the quirks |
| Link only: `?demoProfile=<id>` sets the override | Scripted demos and screenshots | The parameter handler only |

The UI chooses a profile; the mapping sets the quirk values. Put a floating panel at the bottom
left: chat widgets usually take the bottom right. In `next dev`, Next's dev badge sits at the bottom
left, so lift the panel above it.
