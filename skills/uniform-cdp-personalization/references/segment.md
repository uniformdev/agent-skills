# Segment Profile API

## Endpoint and auth

```text
GET https://profiles.segment.com/v1/spaces/<space_id>/collections/users/profiles/<id_type>:<id>/traits
```

EU workspaces use `profiles.euw1.segment.com`. The access token (Unify settings → API access) is
the Basic auth username, with a blank password: `Authorization: Basic base64("<token>:")`. Call
it from the server only. The API has no CORS, and the token reads every profile in the space. The
default limit is 100 requests per second per space; above it Segment answers 429.

## Requesting traits

`/traits` returns 10 traits unless asked for more, so a trait the mapping needs can be silently
missing. Pass `include=<key>,<key>` with exactly the keys the mapping reads. A response looks like
this:

```json
{ "traits": { "frequent_buyers": true, "orders_last_90_days": 4 },
  "cursor": { "url": "…", "has_more": false, "next": "" } }
```

An unknown profile is a 404 with
`{ "error": { "code": "not_found", "message": "Profile was not found." } }`.

## Identity

The identifier is `anonymous_id:<id>` or `user_id:<id>`, URL-encoded (`+` becomes `%2B`).
An `ajs_anonymous_id` cookie written by Analytics.js Classic is JSON-encoded and arrives as
`"<uuid>"`, quotes included; strip them when present.

[Uniform's Segment guide](https://docs.uniform.app/docs/integrations/data/segment) uses the raw
cookie value, requests no `include`, and spreads the raw traits into quirks; the mapping in this
skill replaces those steps.

## Audiences and computed traits

- An audience is a boolean trait keyed by the audience key: `true` while the visitor is in it,
  `false` after they leave. Computed traits keep their snake_case key and value type.
- Anonymous lookups find only audiences built with **Include Anonymous Users**. An existing
  audience [cannot be edited to add it](https://segment.com/docs/engage/audiences/); it has to be
  recreated.
