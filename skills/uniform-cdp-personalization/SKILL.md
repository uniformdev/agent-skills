---
name: uniform-cdp-personalization
description: Integrates Customer Data Platform (CDP) profiles—such as Segment—into Uniform personalization as quirks. Audits current quirk setups, implements server-side profile lookups, maps CDP traits and audiences to targetable quirks, stages definitions for deployment, and builds mock profile APIs with switching for local dev and demos. Resolves flickering or delayed CDP personalization. Use when connecting Uniform to Segment/CDPs, mapping audiences to quirks, or building demo persona switchers for Next.js App & Pages routers.
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# CDP personalization with Uniform quirks

Brings what a customer data platform (CDP) knows about a visitor into Uniform personalization,
where it arrives as quirks: string values stored on the visitor. Audit how the project gets CDP
data into quirks today, then build what is missing: a server-side profile lookup, the mapping from
traits to quirk values, the quirk definitions authors target, and a mock profile API for
development and demos.

The SDK calls used here (`handleUniformRoute`, `context.update`, the Page Router context factory)
are covered by the `uniform-nextjs-app-router` and `uniform-nextjs-page-router` skills, if
installed.

## Workflow

1. **Audit**, read-only: the SDK, how quirks are set today, the Uniform project and the CDP →
   [audit.md](references/audit.md#scope).
2. **Ask** the choices that have more than one valid answer, in one call →
   [audit.md](references/audit.md#questions).
3. **Report** what works, what is broken and what is missing, ending with the mapping plan →
   [audit.md](references/audit.md#the-report).
4. **Map** traits to string quirk values in one function that the lookup and the mock share →
   [mapping.md](references/mapping.md).
5. **Wire** the lookup where the SDK evaluates personalization, cached per visitor; on the App
   Router that is the middleware and the browser context → [wiring.md](references/wiring.md).
6. **Mock** the profile API and profile switching, when chosen →
   [mock-profile-api.md](references/mock-profile-api.md).
7. **Define** one quirk per mapped trait, then create the definitions or hand the user the
   commands → [mapping.md](references/mapping.md#definitions).
8. **Verify and close**: typecheck; with the mock on, switch through every fixture profile and
   check the quirks applied; write the [closing report](references/audit.md#the-closing-report).

## What does not exist

- No public Uniform package connects Segment or any other CDP; there is no
  `@uniformdev/context-segment`.
- No Segment integration to install in Uniform: a quirk matches a trait only because code writes
  it ([segment.md](references/segment.md#identity)).
- No `quirks` option on `new Context()`; quirks enter through `update()` or the server state.

## Resources

- [Audit and questions](references/audit.md) — scope recipes, the questions, when not to ask, the
  report and the closing report
- [Mapping](references/mapping.md) — what criteria compare, trait types, the mapping function,
  quirk IDs, stale values, definitions and how they reach Uniform
- [Wiring](references/wiring.md) — where each SDK evaluates personalization, identity, caching,
  failures, consent
- [Mock profile API](references/mock-profile-api.md) — contract, fixtures, the opt-in flag,
  profile switching, demo UI variants
- [Segment](references/segment.md) — endpoint and auth, requesting traits, identity, audiences
