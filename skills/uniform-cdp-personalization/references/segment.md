# Segment Profile API

## Endpoint and auth

```text
GET https://profiles.segment.com/v1/spaces/<space_id>/collections/users/profiles/<id_type>:<id>/traits
```

EU workspaces use `profiles.euw1.segment.com`. The access token (Unify settings → API access) is the
Basic auth username, with a blank password: `Authorization: Basic base64("<token>:")`. Call it from
the server only: the API sends no CORS headers, and the token reads every profile in the space. The
default limit is 100 requests per second per space; above it Segment answers 429.

Read the space ID and the token from `SEGMENT_SPACE_ID` and `SEGMENT_API_KEY`, the names
[Uniform's Segment guide](https://docs.uniform.app/docs/integrations/data/segment) uses, so a
project that followed it works unchanged; a project with its own names keeps them. Make the host
configurable for EU workspaces. Build the Basic header in code from the token itself, keeping a
single variable. The token is the Profile API access token. A source's write key is a different
value, which the guide keeps in `NEXT_PUBLIC_ANALYTICS_WRITE_KEY` for Analytics.js.

## Requesting traits

`/traits` returns 10 traits by default, so a trait the mapping needs can silently drop out. Pass
`include=<key>,<key>` with exactly the keys the mapping reads. A response looks like this:

```json
{ "traits": { "frequent_buyers": true, "orders_last_90_days": 4 },
  "cursor": { "url": "…", "has_more": false, "next": "" } }
```

An unknown profile is a 404 with
`{ "error": { "code": "not_found", "message": "Profile was not found." } }`.

## Identity

The identifier is `anonymous_id:<id>` or `user_id:<id>`, URL-encoded (`+` becomes `%2B`).
An `ajs_anonymous_id` cookie written by Analytics.js Classic is JSON-encoded and arrives as
`"<uuid>"`, quotes included; strip them when present. `ajs_user_id` can hold the string `null`:
treat that as an anonymous visitor, or every visitor is looked up as `user_id:null`.

[Uniform's Segment guide](https://docs.uniform.app/docs/integrations/data/segment) uses the raw
cookie value, requests the default traits, and spreads them into quirks as they are; the mapping in
this skill replaces those steps.

## Audiences and computed traits

- An audience is a boolean trait keyed by the audience key: `true` while the visitor is in it,
  `false` after they leave. Computed traits keep their snake_case key and value type.
- Anonymous lookups find only audiences built with **Include Anonymous Users**. To add it to an
  existing audience, [recreate the audience](https://segment.com/docs/engage/audiences/): the
  setting is fixed once the audience is built.
