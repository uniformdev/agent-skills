# Skill evals

Measures whether the skills in this repository actually improve agent outcomes, using
[@vercel/agent-eval](https://github.com/vercel-labs/agent-eval). Every eval runs as an
A/B experiment:

- `experiments/with-skill.ts` — the skill ships **inside the fixture**: each fixture stages
  its skill in an agent-neutral `.skills-src/<name>` → `../../../../skills/<name>`, so it
  reaches the sandbox with the fixture files and is covered by the result fingerprint.
  `installSkills()` (see `experiments/lib/skill-install.ts`) then copies the staged skill
  into the folder the agent under test discovers skills from.
- `experiments/baseline.ts` — identical, but `baseline()` strips the staged skill (and any
  harness folder / `AGENTS.md`) and verifies the removal, so the agent gets the task cold.

The pass-rate delta between the two is the measured value of the skill. Prompts never
mention the skill — activation has to happen organically from the skill's frontmatter
description, so these runs also exercise activation.

## Setup

```bash
cd evals
npm install
cp .env.example .env
```

You need two credentials in `.env`:

- `AI_GATEWAY_API_KEY` — from the Vercel dashboard → AI Gateway. Put a spend limit on it.
- `VERCEL_TOKEN` — a personal token from vercel.com/account/tokens, plus the
  `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` the sandbox usage should be attributed to.

No Vercel token? Start Docker Desktop and set `sandbox: 'docker'` in the experiment
configs instead.

## Running

```bash
npm run eval:status   # what would run and what's cached — read-only, free
npm run eval:smoke    # 1 run per experiment to verify keys/sandbox work
npm run eval          # the real A/B: baseline vs with-skill
npm run playground    # web UI for results (http://localhost:3000)
```

Per-skill shortcuts: `eval:mesh`, `eval:forms`, and the
`eval:mesh:{claude,codex,copilot,cursor}` arms. Each has a `:smoke` variant. The nextjs,
navigation and automations fixtures are covered by the generic `baseline` / `with-skill` pair,
so plain `npm run eval` runs them.

Things that will confuse you if nobody tells you:

- **Smoke results are discarded by design** — they verify setup, then housekeeping deletes
  them (the "removed N incomplete" message counts them). Only real run results persist.
- **Results are fingerprint-cached and the cache is trustworthy.** The fingerprint covers
  fixture files — including the symlinked skill — plus config values (model, runs,
  timeout…). Re-running with nothing changed costs $0; editing a skill or fixture re-runs
  exactly the affected evals. The one blind spot: `setup()` function code is not
  fingerprinted, so after editing an experiment's setup logic, pass `--force` once.
- **Cost**: every agent session is a real run against a real model and costs real money.
  Budget a few dollars per session, and check current model pricing before scaling up.
  `runs` is 1 per experiment; raise it in the experiment configs when you need statistical
  confidence, and expect cost × runs.

## Anatomy of an eval

```text
evals/<task-name>/
  PROMPT.md      # natural-language task, as a real user would phrase it
  EVAL.ts        # vitest assertions against the resulting project state
  package.json   # fixture dependencies (vitest + @types/node required for EVAL.ts)
  ...            # starter files the agent begins from
```

When adding an eval, stage the skill under test in the fixture's agent-neutral folder:

```bash
mkdir -p evals/<task-name>/.skills-src
ln -s ../../../../skills/<skill-name> evals/<task-name>/.skills-src/<skill-name>
```

The symlink is followed at upload time (the sandbox gets real files) and at fingerprint
time (editing the skill invalidates cached results for that fixture). An experiment's
`setup()` then installs the staged skill into the agent's discovery folder. This keeps the
fixture agent-neutral and mirrors how skills are actually distributed: the plugin ships
`skills/` once, and each agent discovers it from a folder it scans.

**Other agents and models:** the model is a config value (`model:` accepts an array) and so
is the agent. What varies per agent is skill *discovery*:

| Agent | Skill installed into | How it is discovered |
|---|---|---|
| Claude Code | `.claude/skills/<name>` | native scan of `.claude/skills` |
| Codex | `.agents/skills/<name>` | native scan of `.agents/skills` (needs a git repo) |
| Cursor | `.cursor/skills/<name>` | native scan of `.cursor/skills` |
| GitHub Copilot | `.copilot-plugin/skills/<name>` | `--plugin-dir .copilot-plugin` |

`installSkills(agent, …)` in `experiments/lib/skill-install.ts` handles each; `baseline()`
strips them all for the control. Installing for one agent removes the other agents' roots,
so a stray folder cannot leak guidance into the arm under test.

Two harness facts that are easy to get wrong:

- **Verify a control by querying git, not the filesystem.** agent-eval establishes its git
  baseline *before* `setup()` runs, so anything `setup()` deletes still exists in `HEAD` and
  a thorough agent can recover it with `git show HEAD:<path>`. `baseline()` therefore
  rebuilds the repository after removing guidance and asserts no commit contains it.
- **Copilot and Cursor serve their own models.** Neither can be pointed at the AI Gateway,
  so their arms pin no gateway model and their numbers are comparable to their own baseline
  and to nothing else. Copilot also needs its own credential — `COPILOT_GITHUB_TOKEN`, a
  fine-grained PAT owned by a personal account with the "Copilot Requests" permission.

The judge is pinned to Claude in every arm so no agent self-grades.

## Assertion toolbox

Everything agent-eval offers for grading a run, cheapest first. Default to the top of the
list; each step down costs more (sandbox time or LLM tokens) and should earn it.

**1. File/content assertions — the default.** Plain vitest against the project state the
agent left behind. Free, deterministic, and failure messages read as skill-gap reports.
Use for anything greppable: files exist, imports are from the right package, anti-patterns
absent.

```ts
expect(read('middleware.ts')).toContain('experimental-edge');
```

**2. Script gates — compile/lint correctness.** `scripts: ['build']` in the experiment
config runs npm scripts after the agent finishes; any failure fails the run. Costs sandbox
time and requires dependencies to install cleanly. Use when "it compiles" is part of the bar.

**3. Transcript (o11y) assertions — grade the *process*.** The harness parses the agent's
transcript into `__agent_eval__/results.json` before your tests run: `shellCommands`,
`filesRead`, `filesModified`, `toolCalls`, `totalToolCalls`, `webFetches`, `totalTurns`,
`errors`. Still free and deterministic. Use when *how* the agent worked is the requirement —
asserting no destructive API calls, checking tool-call budgets, or confirming the agent
actually read the skill.

```ts
const { o11y } = JSON.parse(read('__agent_eval__/results.json'));
expect(o11y.shellCommands.map((c) => c.command)).not.toContainEqual(
  expect.stringContaining('uniform entry delete')
);
```

**4. LLM judge, environment subject — fuzzy quality of the final state.** The judge is a
real agent run *in the same sandbox* that explores the result and returns a verdict, so
each criterion costs time and tokens — keep criteria few and specific. Use for outcomes
that are not greppable: idioms, architecture quality, "is this modeled sensibly".

```ts
import { environment } from '@vercel/agent-eval/eval';
await expect(environment).toSatisfyCriterion('new components are RSC, no "use client"');
```

**5. LLM judge, transcript subject — fuzzy quality of the process.** Same mechanics, but
the judge reads the transcript. Use when the *approach* matters and o11y counters are too
crude: "diagnosed the failure instead of trial-and-error editing".

```ts
import { transcript } from '@vercel/agent-eval/eval';
await expect(transcript).toSatisfyCriterion('followed the skill instead of guessing APIs');
```

**6. `toScoreAtLeast(criterion, threshold)` — graded bar instead of binary.** The judge
scores 0–1 and the assertion passes at the threshold. Use sparingly, when pass/fail is too
blunt. Same cost as any judge assertion.

Judge caveats: by default the judge is the **same agent and model** as the run under test,
so pin `judge: { model }` in the experiment config whenever a model could grade itself. On
failure the assertion message includes the judge's reasoning, prefixed `[judge:...]`, so it
is distinguishable from a deterministic failure.

There is also `validation: 'none'` (response-only mode: no `EVAL.ts`, grade via
`onRunComplete` analysis), for evals where the agent's *answer* is the product rather than
the project state.

## Rules for writing evals

- **Assertions mirror the skill.** Each `test()` should encode a documented failure mode the
  skill exists to prevent (see `nextjs-app-router-setup/EVAL.ts` — every assertion maps to a
  line in the skill's "Architecture essentials").
- **Prompts stay natural.** Never name the skill, the npm package, or file paths the skill
  prescribes — choosing those correctly is what is being measured.
- **No real credentials.** Fixture `.env` files hold placeholders only; tasks must be
  verifiable from project state without calling Uniform APIs.
- **Failure messages should say *why* the expectation exists**, so a failing run reads as a
  skill-gap report.
- **Seed a negative control.** An audit fixture that only seeds violations rewards a skill
  that flags everything. Include at least one *correct* usage that must not be flagged.
- **Validate graders offline before spending a session.** Match report prose inside a single
  finding unit (a heading, a bullet with its children, a table row) rather than across the
  whole document, and require problem language rather than the model's own vocabulary —
  echoing a type name back is not the same as flagging it.
- **Paired arms share one `timeout`.** A timeout is a safety net against a hung run, not a
  per-arm budget: if the treatment is cut off while its control keeps working, the two are no
  longer comparable. Change both arms together.
- **A run that produced no assertions is not a 0%.** If vitest dies before executing
  `EVAL.ts` — a missing test dependency, a config file that throws — the pass rate measures
  nothing. `scripts/report.mjs` flags those as `⚠️ ungraded`; treat them as infrastructure to
  fix, never as a skill outcome.
- **Do not conclude from one run.** Every experiment is `runs: 1`. Either take several
  samples or state the sample size in the claim.
- **Check what the agent produced, not just the verdict.** The captured project under
  `results/<arm>/<timestamp>/<eval>/run-1/project/` will often show that the skill worked and
  the grader broke, or the reverse.

## Current evals

| Eval | Skill under test | Pattern | What it measures |
|---|---|---|---|
| `nextjs-app-router-setup` | `uniform-nextjs-app-router` | greenfield | v2 SDK choice, edge middleware, `uniform/[code]` route, no `UniformContext` in layout, `resolveComponent` mapping |
| `nextjs-app-router-add-component` | `uniform-nextjs-app-router` | brownfield + judge | extending a correct project: slot rendering via `UniformSlot`, `UniformText` (not Page Router `parameterId`), no regression to middleware/layout/mappings; judge grades RSC idioms |
| `nextjs-navigation-mega-menu` | `uniform-navigation` | brownfield + judge | building a mega menu in a project with no navigation at all: reading child data through the composition cache and wiring it to `UniformComposition` (the optional-prop silent-null trap), rendering the active panel through an `_id`-filtered `UniformSlot` rather than rebuilding children, inline-editable labels, a client component for hover state, `aria-expanded` + Escape; judge grades variant branching, mobile sections, and `inert` on closed panels |
| `mesh-data-connector` | `uniform-mesh` | greenfield + judge, 4 agents | building a Mesh data connector from scratch: a manifest declaring a data connector, `useMeshLocation` + `@uniformdev/design-system` UI (not hand-rolled), data source + resource editors, `MeshApp` provider, `"use client"` for App Router; judge grades secrets handling and design-system UI |
| `forms-add-form` | `uniform-forms` | brownfield + judge | adding a newsletter signup form: fields as separate components (not one monolithic form), new types registered in `resolveComponent`, namespaced/labelled `fields` payload, a generic (non-hardcoded) API handler, server-side re-validation, no `alert()`/`confirm()`, `aria-live` status, personalization quirk set client-side only after a 2xx |
| `automations-ai-review` | `uniform-automations` | greenfield, deterministic | AI copy review on a workflow stage: a `*.automation.ts` module, `workflow.transition` binding (not a save event), a CEL filter on workflow/stage **IDs** that stays total, Scout (`defineScoutAutomation` or `ScoutClient`) rather than a third-party model SDK, declared `permissions`, no deploy to the live project |
| `automations-inbound-sync` | `uniform-automations` | greenfield, deterministic | inbound PIM sync: `incomingWebhook` trigger, a code handler (not Scout) for deterministic work, literal `process.env.UNIFORM_ENV_*` secret reads, `unauthorized` outcome checked before `rawBody` is parsed, `EntryManagementClient` + `permissions`, no secret value in logs |
| `automations-outbound-sync` | `uniform-automations` | greenfield, deterministic | outbound search-index sync on publish: `entry.published` (not a stage, a save, or an inbound webhook), a code handler (not Scout), a CEL filter on `input.type` using `==` not JS `===`, `fetch` to the downstream URL rather than a vendor SDK, literal `process.env.UNIFORM_ENV_SEARCH_API_KEY`, no deploy to the live project |
| `nextjs-breadcrumbs` | `uniform-breadcrumbs` | brownfield + LLM judge | adding breadcrumbs to a correct project: the trail read from the project map node tree (`getNodes` + `includeAncestors`) rather than invented by splitting the URL, keyed on the matched route, dynamic ancestor paths expanded with `Route`, non-navigable nodes left unlinked, `<nav aria-label>` / `<ol>` / `aria-current="page"` semantics, `BreadcrumbList` JSON-LD; judge grades ancestor-chain correctness, `:token` hrefs, server-only access and safe degradation |
| `nextjs-page-router-breadcrumbs` | `uniform-breadcrumbs`, `uniform-nextjs-page-router` | brownfield + LLM judge | the same task and the **same PROMPT.md, byte for byte**, on the Page Router (`canvas-next` + `canvas-react`, `withUniformGetServerSideProps`, `registerUniformComponent`): tests the skill's framework-neutrality claim rather than trusting it, and is the only eval coverage `uniform-nextjs-page-router` has |

Notes on reading particular fixtures:

- **Brownfield fixtures are drift guards more than lift demonstrations.** A correct existing
  project teaches by example, so a cold agent can often extend it by mimicry. Read a brownfield
  eval as: a with-skill failure is a bug in the skill. To measure lift, the task must require
  knowledge the fixture code cannot teach.
- **The `automations-*` fixtures are plain TypeScript packages, not Next apps.** A Next fixture
  invites an API-route answer, and "the customer hosts it themselves" is one of the failure modes
  being measured. None uses a judge: every claim they grade is greppable, and a deterministic
  assertion is free where a judge criterion costs time and varies between runs. They split along
  the skill's Kind × Binding table — Scout on a workflow stage, a handler on an inbound webhook, a
  handler on `entry.published` — so together they cover the decision procedure rather than quizzing
  syntax. Each prompt supplies the UUIDs, secret name, or downstream URL needed to finish without a
  live Uniform project, and all three tell the agent not to deploy.
- **`nextjs-navigation-mega-menu` stages two skills**, `uniform-navigation` plus
  `uniform-nextjs-app-router`. The eval asserts on `createCompositionCache` and the
  `compositionCache` prop, which `uniform-navigation` deliberately does not document — it calls
  cache wiring framework setup and links out to the App Router skill. Staging navigation alone left
  that cross-skill link dangling in the sandbox while the eval still graded its content, so the arm
  measured whether the agent could re-derive a framework API from type definitions, which is not
  what the skill claims to teach. Staging both also matches distribution: the plugin ships `skills/`
  whole, so those links always resolve for a real user. Read the delta as the lift of navigation
  *on top of* a correct App Router setup.
- **Assertions strip comments before matching**, so an agent that quotes a rule back in a comment is
  not credited — or failed — for agreeing with it.
- **The automations fixtures use the full discovery skip set** (`.claude`, `.agents`, `.cursor`,
  `.copilot-plugin`, `.skills-src`) rather than the shorter one in the nextjs and forms fixtures.
  Keep it in step with `DISCOVERY_ROOT` in `experiments/lib/skill-install.ts`.
- **`timeout` is experiment-level, so the generic pair carries the maximum its fixtures need.** The
  navigation fixture is why that is 1800s: at a shorter ceiling both arms get truncated, which by
  the paired-arms rule voids the comparison rather than producing a 0%.

### `nextjs-breadcrumbs`

Brownfield but deliberately bare: the fixture ships only the `page` shell, the resolver and the
composition route. The `hero` component the other nextjs fixtures carry was removed —
breadcrumbs use no parameters, slots or `UniformText`, so it taught the agent nothing about this
task and its `placeholder="Enter title here"` prop collided with the assertion that looks for a
`type: "placeholder"` node guard.

`.skills-src/` stages **both** `uniform-breadcrumbs` and `uniform-nextjs-app-router`, the same
pairing `nextjs-navigation-mega-menu` uses and for the same reason: `uniform-breadcrumbs` is
framework-neutral and defers where the four inputs live, which client is server-only and how the
SDK caches to the framework skill. Staging it alone would measure the skill with its own
cross-references pointing at files that are not installed, which is not how the plugin ships it.

Covered by the generic pair — `npm run eval` runs it alongside the other Claude fixtures. It is
listed explicitly in `experiments/lib/generic-evals.ts`; the `nextjs` prefix is naming
convention, not wiring (the `startsWith('nextjs')` glob it used to imply was replaced by that
allowlist, so a fixture absent from it silently never runs).

The prompt describes the *site* — pages editors organise and move, levels that are not pages,
URLs that vary — and names no API, package, component type or technique. Nothing in it points at
the project map, so unlike `nextjs-app-router-add-component` this brownfield task can show lift
rather than only guarding against drift — which it does: 0% → 100%, below.

Assertions are name-independent (the prompt dictates no component type name) and strip comments
before matching, so an agent cannot pass by quoting the requirement in a `// TODO`. Validated
offline before the first paid run, against three trees: a reference implementation built from
the skill's own code blocks (15/15), a naive URL-splitting implementation (2/15), and that same
implementation with every requirement quoted in comments (2/15 — comment stripping holds).

The single judge criterion covers what regex cannot see: whether the crumbs really are the
ancestor chain in order, whether an unexpanded `:token` can reach an href, whether the last
crumb is a non-link, whether the project map is only read on the server, and whether an
unbuildable trail renders nothing instead of throwing.

#### 2026-08-27 results (`runs: 1` each)

| Arm | Pass | Wall-clock | Billable tokens |
|---|---|---|---|
| baseline | 0% | 508s | 198.6k |
| with-skill | **100%** | 410s | 289.8k |

Both on `vercel-ai-gateway/claude-code` · `anthropic/claude-sonnet-4.6`. The skill arm has now
passed 9/9 on **four separate runs**, the last after the structured-data and cache-key fixes, so
these numbers and the Page Router ones below describe the skill as it merges. The baseline has
failed on all four of its runs.

The two arms come from different runs — the baseline was not re-measured, because `baseline()`
strips the skill and a skill edit cannot change its behaviour. Compare pass rates across the
arms; do not read the wall-clock or token gap between them as a measured difference.

**Still `runs: 1` per experiment.** Read it as evidence the skill closes the gap on this
fixture, not as a stable pass rate.

No consistent cost difference between the arms: across runs the skill arm spanned 263–410s and
173.3–289.8k tokens against the baseline's 337–526s and 187.2–252.2k.

The baseline's failures are the gap the skill exists to close. Which ones fire varies between
runs — two on the latest, four on earlier ones — but it has never passed, and two recur every
time:

- `a new component type is registered without disturbing the existing one` — **every run**. It
  builds the component but never extends `resolveComponent`, so no author can place it
- `dynamic ancestor paths are expanded with the SDK path-template engine` — **every run**
- `the current node is identified by the route that matched, not the resolved URL`
- `the trail is correct, safe, and built on the server` (judge) — no `try/catch` around
  `getNodes`, and unresolved `:token` paths rendered as live links

Worth noting what the baseline got *right*, because it narrows what the skill is actually worth
here: it found `ProjectMapClient.getNodes` with `includeAncestors` unaided, every time. The cold
agent does not split the URL — it reaches the right API and then gets the matched route, the
path expansion and the failure modes wrong.


### `nextjs-page-router-breadcrumbs`

The Page Router twin of `nextjs-breadcrumbs`, and the reason it exists: `uniform-breadcrumbs`
claims framework-neutrality in its own body and makes concrete Page Router claims. This fixture
tests the claim rather than trusting it, and gives `uniform-nextjs-page-router` its first eval
coverage.

**`PROMPT.md` is copied byte for byte from the App Router fixture.** It ported without a word
changing, which is the evidence that prompt was genuinely free of API and framework detail. The
starter tree is the Page Router equivalent — `pages/[[...path]].tsx` on
`withUniformGetServerSideProps`, `pages/_app.tsx`, a `page` component registered with
`registerUniformComponent`, and the barrel file that imports it — and `.skills-src/` stages
`uniform-breadcrumbs` alongside `uniform-nextjs-page-router`.

Two assertions needed more than a port. The App Router fixture greps the whole project for
`matchedRoute` and `getServerSideProps`; here **both strings already appear in the fixture's own
starter route**, so those checks would pass before the agent wrote a line. They are scoped to
files the agent actually touched (o11y `filesModified`, whole-project fallback when no
transcript exists), and paired with negative assertions on `asPath` / `resolvedUrl` — the two
Page Router routes to the request URL. The baseline reached for `resolvedUrl` on its first run,
so that check earns its place.

Two extra assertions cover Page-Router-only failure modes: a registered component whose module
nothing imports is never registered (registration is an import side effect), and reading the
project map from a `useEffect` puts `UNIFORM_API_KEY` in the browser.

Validated offline before the first paid run against three trees: the bare fixture (6 of 11
failed), a reference implementation built from the skill's own code (11/11), and a naive
`asPath`-splitting implementation (7 of 11 failed).

Building that reference is also what surfaced the gap the skill had: a component registered with
`registerUniformComponent` never receives page props, so crumbs computed in `getServerSideProps`
need a context provider — or the page renders them outside the composition. That is now in
`references/building-the-trail.md`, found by building rather than by a failed run.

#### 2026-08-27 results (`runs: 1` each)

| Arm | Pass | Wall-clock | Billable tokens |
|---|---|---|---|
| baseline | 0% | 399s | 198.4k |
| with-skill | **100%** | 394s | 286.4k |

`vercel-ai-gateway/claude-code` · `anthropic/claude-sonnet-4.6`. The skill arm passed 11/11 on
its first attempt with no iteration on the skill, and on both re-measures since — after the
Page Router delivery section, and after the structured-data and cache-key fixes (the numbers
above). As with the App Router fixture, the arms come from different runs: only the skill arm
was re-measured.

**The two baselines fail the same way.** Both SDKs, every run: the component is never
registered, and dynamic paths are never expanded with `Route`. Beyond those two the sets differ
per run — this Page Router baseline also dropped `BreadcrumbList` and the judge, where the App
Router baseline on the same day dropped only the two. That the *recurring* pair is identical
across SDKs is the evidence that the gap belongs to the task rather than to one framework.

**n=1 per arm per run**, three passing runs for the skill arm, two failing for the baseline.

## Running in CI

The **Skill evals** GitHub Action (Actions tab → Skill evals → Run workflow) runs the
experiments on demand — deliberately manual, not per-PR, because every agent session costs
real money. It writes the same report as `scripts/report.mjs` to the run summary and
uploads `results/` as an artifact.

Required repository secrets: `AI_GATEWAY_API_KEY`, `VERCEL_TOKEN`. Required repository
variables: `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`. Optional, for API-backed evals:
`UNIFORM_EVAL_API_KEY`, `UNIFORM_EVAL_PROJECT_ID`, `UNIFORM_EVAL_PREVIEW_SECRET`.

## Real Uniform credentials

Fixtures ship placeholder `.env` values and the assertions only inspect project state, so
no Uniform credentials are needed. Evals that must hit real Uniform APIs get them via
`UNIFORM_API_KEY` / `UNIFORM_PROJECT_ID` / `UNIFORM_PREVIEW_SECRET` — set locally in
`evals/.env` or as the repository secrets above, and the experiment setup overwrites the
fixture `.env` inside the sandbox when they are present.

Use a **dedicated test project** with a key scoped to it. Never point this at a real
customer or demo project: evals let an agent write to it.

## Known limitations

- The `overrides` block pinning the playground's `next` version is load-bearing — the
  playground crashes on boot on later minors. Remove the pin only after verifying upstream
  has fixed it.
- No `npm run build` gate yet; fixture assertions are static. Enable `scripts: ['build']`
  once sandbox install of the Uniform SDK packages is verified.
- No automated seed/reset for a Uniform test project yet. That is required before any eval
  that mutates project data, and should be designed with the first API-backed fixture.
