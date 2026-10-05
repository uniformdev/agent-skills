---
name: uniform-cdp-personalization
description: Brings customer data platform (CDP) profiles into Uniform personalization as quirks. Audits how a project sets quirks today, then adds a server-side profile lookup, maps CDP traits and audiences onto quirk values authors can target, stages the quirk definitions for the user to push, and builds an opt-in mock profile API with profile switching for local development and demos. Segment's Profile API is the worked example; the workflow applies to any CDP with a profile lookup. Use when asked to personalize a Uniform site from Segment or another CDP; to map CDP audiences, computed traits or segments onto quirks; when CDP-based personalization never matches, applies only after a reload, or flickers; when building a fake CDP, demo visitor profiles or a persona switcher for a Uniform demo; or when reviewing an existing CDP integration. Covers the Next.js App Router and Page Router SDKs.
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
are documented in [uniform-nextjs-app-router](../uniform-nextjs-app-router/SKILL.md) and
[uniform-nextjs-page-router](../uniform-nextjs-page-router/SKILL.md).

## Workflow

1. **Audit**, read-only: the SDK, how quirks are set today, the Uniform project and the CDP →
   [audit.md](references/audit.md#scope).
2. **Ask** the choices that have more than one valid answer, in one call →
   [audit.md](references/audit.md#questions).
3. **Report** what works, what is broken and what is missing, ending with the mapping plan →
   [audit.md](references/audit.md#the-report).
4. **Map** traits to string quirk values in one function that the lookup and the mock share →
   [mapping.md](references/mapping.md).
5. **Wire** the lookup where the SDK evaluates personalization, cached per visitor →
   [wiring.md](references/wiring.md).
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
