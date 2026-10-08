# Auditing a project and asking the user

## Scope

Read only. Collect all of this before you change anything.

### Code

Search the source of every package, skipping `node_modules` and build output, for:

- **The SDK**, in every `package.json` (a monorepo has several): `@uniformdev/next-app-router` on
  the App Router, `@uniformdev/canvas-next` with `@uniformdev/context-next` on the Page Router. The
  SDK decides where quirks have to be set ([wiring.md](wiring.md#where-quirks-have-to-be-set)); any
  other setup follows that table's last row.
- **Code that writes or clears quirks today** (`quirks`, `useQuirks`, `forget(`). The CDP lookup
  joins these or replaces them, so report each one with what it sets.
- **The middleware or proxy file** (`middleware.*`, `proxy.*`) and the options it passes. On the
  App Router, the lookup runs there.
- **How each Page Router page renders.** Pages with `getStaticProps` personalize in the browser
  only; pages with `getServerSideProps` and `enableNextSsr` personalize on the server. The mix
  decides the lookup question below and whether the [static-pages recipe](wiring.md#static-pages)
  applies.
- **CDP code already there**: the CDP's SDK package, calls to its profile endpoint, its identity
  cookies. Segment: `@segment/analytics-next` or `AnalyticsBrowser`, `analytics.load`, `identify`,
  `page` or `track` calls, `cdn.segment.com`, the `ajs_anonymous_id` and `ajs_user_id` cookies,
  `collections/users/profiles`. Audit an existing lookup and build on it.
- **Consent handling** (`defaultConsent`, `storeConsent`). It decides whether quirks persist in
  cookies, and whether to ask the consent question below.

The CDP's browser library sets the visitor ID every lookup needs (Segment: Analytics.js and its
`ajs_*` cookies). Report it under Broken and ask the library question below if nothing loads that
library, in the code or through a tag manager the user names.

Look for demo UI the project already has, and extend it: a component that writes quirks or calls
`forget`, a persona or profile switcher in the component resolver or the project's component
definitions, a profile page.

### Uniform project

`uniform.config.ts`, when the project has one, names the sync directory (`uniform-data/` by
default). List existing quirks with `npx uniform context quirk list`, or read the sync directory's
`quirk/` when the project syncs them. Signals with `QK` criteria read quirks too
(`npx uniform context signal list`, or `signal/`). Reuse a quirk that already means the same
thing: a second one splits authors' rules between two IDs.

### CDP

Ask the user for what lives in the CDP: the traits and audiences marketing wants to target, the
values each can take, and how a profile is fetched (endpoint or SDK call, identifier, auth,
region). Segment: [segment.md](segment.md). For another CDP, such as mParticle, take these from the
user or from the CDP's own API docs.

## Questions

Ask in one call: a structured question tool when there is one, otherwise a numbered list with the
defaults marked. Ask the choices that have more than one valid answer:

| Question | Default | Trade-off |
|---|---|---|
| Where to look up profiles (App Router) | Middleware (Recommended) | Middleware personalizes the first HTML and costs one lookup per visitor per cache period. The browser keeps the server free, but the page switches variant after it loads |
| Where to look up profiles (Page Router) | With `enableNextSsr`: on the server (Recommended). Static pages: [the browser](wiring.md#static-pages) (Recommended) | The server personalizes the first HTML. The browser keeps the server free, but the page switches variant after it loads. Moving static pages to per-request rendering gives up the static build |
| Load the CDP's browser library (when the audit found nothing loading it) | Load it when its public key is set, behind the project's consent handling (Segment: Analytics.js with `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`) | Lookups run for real visitors once the library sets their ID. It is a tracking script, so the site's consent rules apply. The user may load it elsewhere, such as a tag manager |
| What to build (multi-select) | Lookup and mapping, staged quirk definitions, and the mock when CDP credentials are missing. Creating the definitions in Uniform now ([mapping.md](mapping.md#getting-them-into-uniform)) and, with CDP credentials, a [demo against the real CDP](mock-profile-api.md#demo-against-the-real-cdp) are options, off by default | — |
| Demo UI | The user picks: list the four variants and their costs in [mock-profile-api.md](mock-profile-api.md#demo-ui) | — |
| Identity (when the site has logins) | User ID when logged in, otherwise the CDP's anonymous ID | Email puts personal data in URLs and logs |
| Consent (when the project has no consent handling) | Look up every visitor the CDP identifies, and keep Uniform's `defaultConsent: false`: its own data stays in memory until the visitor consents | The cache cookie holds each visitor's mapped quirks. Where the site's privacy rules ask for consent first, run the lookup only for visitors who gave it ([wiring.md](wiring.md#consent)); the site then needs a way to collect it |

Bucket thresholds and the cache period go in the mapping plan below, where the user confirms them
with everything else.

## When to skip the questions

| The user said | Do |
|---|---|
| Don't ask, apply everything | Take the defaults: stage the definitions for the user to push, and build the profile switching every demo UI shares, leaving the UI itself to the user. In the closing report, list the demo UI choice as open and every default as assumed |
| Don't ask, and left the traits and audiences unnamed | Build the lookup, the cache and the mock around an empty rule set, with the empty and unknown profiles as the mock's only fixtures. Leave the definitions until the traits are known, and list the traits to target as open in the closing report. Propose traits only when the user asked you to choose (next row) |
| Named placeholders ("audience X, trait Y"), or asked you to choose | Propose keys from what the site offers and asks visitors for: its products, sign-up forms, campaigns, existing signals. Mark them proposed in the mapping plan, and in the closing report as still to confirm in the CDP |
| Audit or review only | Write the report and stop |
| One named piece ("add a mock") | Scope everything to it |

## The report

```markdown
# CDP personalization audit

<SDK> · <CDP> · identity: <source> · quirks set today: <where, or nowhere>

## Works
## Broken
- `<file>:<line>` — <what visitors or authors get>. Fix: <one sentence>.
## Missing

## Mapping plan
| CDP key | Quirk ID | Values | Definition |
|---|---|---|---|
| `<trait>` | `<camelCaseId>` | `<v1>`, `<v2>` (thresholds, marked assumed) | new / existing |

Cache period: <minutes> (assumed)
```

Have the user confirm or edit the mapping plan before you build. When they said not to ask, build
from the plan as it stands.

## The closing report

- Files changed, and files staged for Uniform.
- Commands for the user to run, in order ([mapping.md](mapping.md#getting-them-into-uniform)).
- Environment variables to set where the site is deployed.
- What to check in the CDP ([segment.md](segment.md#audiences-and-computed-traits) for Segment).
- Notes for authors: the values each quirk takes, and that `!=` also matches visitors the CDP knows
  nothing about.
- Every default you assumed, and every CDP key you proposed.
