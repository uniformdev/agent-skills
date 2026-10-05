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
only in server code. Never fall back to the mock when credentials are missing: a deploy that lost
its token would then show demo profiles to real visitors. With no credentials and no flag, write
no CDP quirks and log one warning.

## Switching profiles

Every demo UI works the same way: choosing a profile sets an override identity cookie, then
reloads the page. The lookup honours the override only while the flag is on, otherwise any visitor
could read any profile.

"New visitor" clears the override. `context.forget(true)` would also clear the visitor's scores,
test assignments and every other quirk; use it only when that is the intent.

## Demo UI

Ask which variant to build, with no recommended default:

| Variant | Fits | Costs |
|---|---|---|
| Floating panel, rendered only while the flag is on | Local development, most demos | No Uniform changes |
| Profiles page (for example `/demo/profiles`), one card per fixture | Sales demos that start from a shareable page | One route |
| Canvas component that authors place on a page | Demos whose copy authors edit | A component definition, staged and handed to the user like the quirks |
| Link only: `?demoProfile=<id>` sets the override | Scripted demos and screenshots | Nothing to render |

The UI chooses a profile, never quirk values, for the same reason the mock returns raw traits.
