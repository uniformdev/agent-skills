# Auditing a project and asking the user

## Scope

Read only. Collect all of this before changing anything.

### Code

```bash
# SDK in use, in every package.json (monorepos have several)
grep -rnoE '"@uniformdev/(next-app-router|canvas-next|context-next|context-react|context)"' --include=package.json --exclude-dir=node_modules .
# Where quirks are written or wiped today
grep -rnE '\bquirks\b|useQuirks|forget\(' --include='*.[jt]s' --include='*.[jt]sx' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=.next .
# Middleware or proxy, and the options it passes
find . \( -name node_modules -o -name .next \) -prune -o \( -name 'middleware.*' -o -name 'proxy.*' \) -print
# Page Router: static pages (getStaticProps) or per-request rendering (getServerSideProps, enableNextSsr)
grep -rnE 'getStaticProps|getServerSideProps|enableNextSsr' --include='*.[jt]s' --include='*.[jt]sx' --exclude-dir=node_modules --exclude-dir=.next .
# CDP calls and identity cookies already in the code: grep for the CDP's own SDK package,
# profile endpoint and cookie names. Segment:
grep -rnE 'collections/users/profiles|ajs_(anonymous|user)_id|analytics\.(load|identify|page|track)|cdn\.segment\.com|@segment/analytics-next|AnalyticsBrowser' --include='*.[jt]s' --include='*.[jt]sx' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=.next .
# Consent
grep -rnE 'defaultConsent|storeConsent' --include='*.[jt]s' --include='*.[jt]sx' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=.next .
```

With neither Next.js SDK installed (`next-app-router`, or `canvas-next` with `context-next`), wire by
the "Any other setup" row in
[wiring.md](wiring.md#where-quirks-have-to-be-set).

Lookups need an identity, and the CDP's browser library is what sets it (Segment: Analytics.js and
its `ajs_*` cookies). When neither the code nor anything the user names, such as a tag manager,
loads that library, no visitor can be looked up: report it under Broken and ask the library
question below.

Look for demo UI the project already has, to extend rather than duplicate: a component that
writes quirks or calls `forget`, a persona or profile switcher in the component resolver or the
project's component definitions, a profile page.

### Uniform project

The sync directory is the one `uniform.config.ts` serializes to (`uniform-data/` by default); a
project without a sync config has none. List existing quirks with `npx uniform context quirk list`,
or read the sync directory's `quirk/` when the project syncs them. Signals with `QK` criteria read
quirks too (`npx uniform context signal list`, or `signal/`). Reuse a quirk that already means the
same thing: a second one splits authors' rules between two IDs.

### CDP

Ask what the code cannot show: which traits and audiences marketing wants to target and the values
each can take, and how a profile is fetched (endpoint or SDK call, identifier, auth, region).
Segment: [segment.md](segment.md).

## Questions

Ask in one call: a structured question tool when there is one, otherwise a numbered list with the
defaults marked. Ask only what has more than one valid answer:

| Question | Default | Trade-off |
|---|---|---|
| Where to look up profiles (App Router) | Middleware (Recommended) | Middleware personalizes the first HTML and costs one lookup per visitor per cache period. The browser costs nothing on the server, but the page switches variant after it loads |
| Where to look up profiles (Page Router) | With `enableNextSsr`: on the server (Recommended). Static pages: [the browser](wiring.md#static-pages) (Recommended) | The server personalizes the first HTML. The browser keeps the server free, but the page switches variant after it loads. Moving static pages to per-request rendering gives up the static build |
| Load the CDP's browser library (only when nothing loads it) | Load it when its public key is set, behind the project's consent handling (Segment: Analytics.js with `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`) | Without it, lookups never run for real visitors. It is a tracking script, so the site's consent rules apply. The user may load it elsewhere, such as a tag manager |
| What to build (multi-select) | Lookup and mapping, staged quirk definitions, and the mock when there are no CDP credentials. Creating the definitions in Uniform now ([mapping.md](mapping.md#getting-them-into-uniform)) and, with CDP credentials, a [demo against the real CDP](mock-profile-api.md#demo-against-the-real-cdp) are options, off by default | — |
| Demo UI | No default: list the four variants and their costs in [mock-profile-api.md](mock-profile-api.md#demo-ui) | — |
| Identity (only when the site has logins) | User ID when logged in, otherwise the CDP's anonymous ID | Email puts personal data in URLs and logs |

Ask about consent only when the project has no consent handling. Bucket thresholds and the cache
period go in the mapping plan below, where the user confirms them with everything else.

## When not to ask

| The user said | Do |
|---|---|
| Don't ask, apply everything | Take the defaults: stage the definitions without creating them, and build the profile switching every demo UI shares with no UI on top. List the demo UI choice as open, and every default as assumed, in the closing report |
| Don't ask, but named no traits or audiences | Invent none, unless they asked you to choose (next row). Build the lookup, the cache and the mock with an empty rule set, stage no definitions, and give the mock only the empty and unknown profiles. List the traits to target as open in the closing report |
| Named placeholders ("audience X, trait Y"), or asked you to choose | Propose keys from what the site offers and asks visitors for: its products, sign-up forms, campaigns, existing signals. Mark them proposed in the mapping plan, and as not yet confirmed in the CDP in the closing report |
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

Unless the user said not to ask, have them confirm or edit the mapping plan before building.

## The closing report

- Files changed, and files staged for Uniform.
- Commands for the user to run, in order ([mapping.md](mapping.md#getting-them-into-uniform)).
- Environment variables to set where the site is deployed.
- What to check in the CDP ([segment.md](segment.md#audiences-and-computed-traits) for Segment).
- Notes for authors: the values each quirk takes, and how `!=` treats visitors without CDP data.
- Every default that was assumed rather than chosen, and every CDP key that was proposed rather
  than given.
