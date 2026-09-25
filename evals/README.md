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
| `nextjs-breadcrumbs` | `uniform-breadcrumbs` | brownfield + LLM judge | adding breadcrumbs to a correct project: the trail read from the project map node tree (`getNodes` + `includeAncestors`) rather than invented by splitting the URL, keyed on the matched route, dynamic ancestor paths expanded with `Route`, **crumb titles resolved through `RouteClient.get` with a `select` projection** rather than from project map metadata, `releaseId` forwarded, non-navigable nodes left unlinked, `<nav aria-label>` / `<ol>` / `aria-current="page"` semantics, `BreadcrumbList` JSON-LD; judge grades ancestor-chain correctness, `:token` hrefs, server-only access, safe degradation and the title source |
| `nextjs-page-router-breadcrumbs` | `uniform-breadcrumbs`, `uniform-nextjs-page-router` | brownfield + LLM judge | the same task and the **same PROMPT.md, byte for byte**, on the Page Router (`canvas-next` + `canvas-react`, `withUniformGetServerSideProps`, `registerUniformComponent`): tests the skill's framework-neutrality claim rather than trusting it, is the only eval coverage `uniform-nextjs-page-router` has, and is where the judge catches Uniform clients constructed at page module scope |

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
framework-neutral and defers where the five inputs live, which client is server-only and how the
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
before matching, so an agent cannot pass by quoting the requirement in a `// TODO`. 15 tests: 14
deterministic plus one judge criterion.

The fixture carries a synced page component definition at `uniform-data/component/page.yaml`
whose `titleParameter` is `headline` — deliberately neither `title` nor `pageTitle`. The skill
tells the agent to read that field off the definition rather than guess it, and a guessed field
id is accepted by the Route API and returns nothing, so every crumb silently falls back to its
node name with no error anywhere. Before the definition existed there was nothing in the tree to
read and any field name passed the projection assertions; the check now reads the value out of
the fixture and requires it inside the `only: [...]` array, so it stays name-independent.

Validated offline before each paid run, against captured project trees: a reference built from
the skill's own code blocks passes 13/13 deterministic, while the captured project of the
previous project-map-titles skill fails exactly the three title-source assertions. (Its fourth
failure, `extends the existing project`, is an artifact of `copyFiles: 'changed'` — a captured
tree carries no `package.json`, so that assertion cannot be read offline.)

The single judge criterion covers what regex cannot see: whether the crumbs really are the
ancestor chain in order, whether an unexpanded `:token` can reach an href, whether the last
crumb is a non-link, whether the project map is only read on the server, whether an unbuildable
trail renders nothing instead of throwing, and whether the title really comes from a Route API
call on the *expanded* path with the current page excluded.

#### 2026-09-22 results (`runs: 1` each)

Three arms, one fixture, same agent/model/judge/timeout — the skill is the only variable. The
incumbent is the previous project-map-titles version of `uniform-breadcrumbs`, kept installed
under its own arm for the comparison; the candidate is the Route API rework that shipped.

| Arm | Skill installed | Pass | Wall-clock |
|---|---|---|---|
| `breadcrumbs-claude-baseline` | none | 0% | 325s |
| `nextjs-breadcrumbs-claude-incumbent` | project-map titles | 0% | 348s |
| `nextjs-breadcrumbs-claude-routeapi` | Route API titles (shipped) | **100%** | 378s |

`vercel-ai-gateway/claude-code` · `anthropic/claude-sonnet-4.6`. All three arms were temporary
and have been deleted; the fixture is back on the generic `baseline` / `with-skill` pair.

The incumbent's four failures are the rework's whole case: the three title-source assertions
plus the judge. Its judge note names the defect exactly — it titled crumbs from
`withCompositionData: true` and node names, and never forwarded `releaseId`.

The baseline's failure is not the URL-splitting one you would expect: it finds `getNodes` with
`includeAncestors` unaided every time. What it misses is registering the component, expanding
dynamic paths with `Route`, and every part of the title source.

**Which assertions it misses is not stable across runs**, and only two baseline runs have been
measured. The first failed seven of fourteen, including `nodes with no page behind them are not
turned into links` and `titles are not read from project map composition metadata`; the second
(below) passed both of those and failed six of fifteen. Read the recurring set as the finding —
registration, `Route` expansion, the title source, `releaseId` — and treat any single assertion
outside it as one run's behaviour rather than a property of the task.

**The candidate failed its own first run, and that failure was a skill defect worth recording.**
The agent copied the trail module faithfully, including the fact that the sample guarded every
Route API call with `try/catch` but left `projectMap.getNodes` unguarded — so an API failure
would throw out of a component an author placed and take the page down. Judge criterion (5)
caught it; 13 of 13 deterministic assertions passed. The fix moved the guard inside the module
(`fetchChain`), so a caller cannot forget it, and the two runs after it both pass.

**Still `runs: 1` per arm.** Two passing candidate runs, one of them on a skill version that has
since changed. Read it as "the shipped skill closes a gap the previous one did not", not as a
stable pass rate.

#### 2026-09-22, re-measured after the `titleParameter` assertion

The numbers above were measured before `uniform-data/component/page.yaml` and the fourteenth
deterministic test existed, and the run that produced the 100% set
`TITLE_PARAMS = ["title", "pageTitle"]` — a guess the fixture's definition now contradicts. The
arm was re-run on the current fixture, everything else held constant:

| Arm | Skill installed | Pass | Wall-clock |
|---|---|---|---|
| `breadcrumbs-titleparam-baseline` | none | 0% (6 of 15 failed) | 361s |
| `breadcrumbs-titleparam` | Route API titles (shipped) | **100%** (14/14 + judge) | 377s |

The agent wrote `const TITLE_PARAMETER = "headline"` — it read the value out of the definition
rather than guessing it, which is the whole of what the assertion was added to check.

**The control was re-run too, and it was not optional.** `uniform-data/component/page.yaml` sits
in the starter tree the control reads as well, so the recorded 0% had been measured against a
different project than the treatment — which is the comparison this file warns against two
sections up. It is still 0%, and the fixture does not leak the answer: both baseline agents
opened `uniform-data` (six and two transcript mentions) and `headline` appears in neither
produced project, because what they are missing is the Route API projection, not the field
name.

Offline validation before that paid run is what made it worth spending. Against the captured
pre-assertion winning tree the new suite scores **13 of 14**, failing only the new assertion; a
reference implementation assembled from the shipped skill's own code blocks, with the one
substitution its sample comment demands, passes **14 of 14**. It also caught a broken assertion:
the first draft required the field id to appear literally inside the projection's `only: [...]`
array, which the reference implementation fails, because the id reaches the projection through an
option rather than as a literal at the call site. That draft would have failed the paid run for a
reason that had nothing to do with the agent. It matches a quoted literal in the trail modules
instead.

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
`uniform-breadcrumbs` alongside `uniform-nextjs-page-router`. It carries the same
`uniform-data/component/page.yaml` definition as the App Router fixture, and the same assertion
that the projected title field is the definition's `titleParameter` rather than a guess: 17
tests, 16 deterministic plus one judge criterion.

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

Validated offline before each paid run: a reference implementation built from the skill's own
code blocks passes 15/15 deterministic, and the captured project of the previous
project-map-titles skill fails the three title-source assertions.

Building that reference is also what surfaced the gap the skill had: a component registered with
`registerUniformComponent` never receives page props, so crumbs computed in `getServerSideProps`
need a context provider — or the page renders them outside the composition. That is now in
`references/building-the-trail.md`, found by building rather than by a failed run.

#### 2026-09-22 results (`runs: 1` each)

| Arm | Skill installed | Pass | Wall-clock |
|---|---|---|---|
| `breadcrumbs-claude-baseline` | none | 0% | 488s |
| `nextjs-page-router-breadcrumbs-claude-incumbent` | project-map titles | 0% | 430s |
| `nextjs-page-router-breadcrumbs-claude-routeapi` | Route API titles (shipped) | **100%** | 397s |

`vercel-ai-gateway/claude-code` · `anthropic/claude-sonnet-4.6`. All three arms were temporary
and have been deleted; the fixture is back on the generic `baseline` / `with-skill` pair.

The incumbent fails the identical three title-source assertions as on the App Router, which is
what makes the defect a property of the skill rather than of one framework's wiring.

**Both baselines fail the same way**, on both SDKs and on every run measured: the component is
never registered, and dynamic paths are never expanded with `Route`. That the recurring pair is
identical across SDKs is the evidence that the gap belongs to the task rather than to one
framework. The Page Router baseline is the more stable of the two — both measured runs failed
exactly the same assertions, with only the added `titleParameter` check joining the set.

**This fixture is where the judge earned its cost.** The candidate passed its first run, then
failed after the App Router failure-policy fix — not from that fix, but because the judge read
the Page Router sample more carefully than the previous run had: it constructed `RouteClient`
and `ProjectMapClient` at the top level of `pages/[[...path]].tsx`. A page module in the Page
Router is a client module, so those constructions — and their `process.env.UNIFORM_API_KEY`
reads — sit behind Next's `getServerSideProps` transform rather than behind a guarantee, and no
reviewer can tell from the file whether they were eliminated. Criterion 4 failed; all 15
deterministic assertions passed, so regex would never have found it.

The fix is in `references/building-the-trail.md`: a lazy `getTrailClients()` in its own module,
called from inside the handler, so nothing is constructed at import time. The skill also stopped
recommending the handler's `client` option, because that option is evaluated at module scope and
therefore costs exactly the exposure being avoided. The winning run reproduces the shape — a
`lib/breadcrumbs/clients.ts`, and no `new RouteClient` or `UNIFORM_API_KEY` anywhere in the page
file.

That is two separate skill defects this one rework surfaced, both found by the judge and neither
visible to a deterministic assertion. Worth remembering the next time a judge criterion looks
expensive.

**n=1 per arm.** The candidate has two passing runs, one of them on a skill version that has
since changed; the incumbent and both baselines have one failing run each.

#### 2026-09-22, re-measured after the `titleParameter` assertion

Same story as on the App Router: the numbers above predate the component definition and the
sixteenth deterministic test, and that run passed `titleParameter: ["title", "pageTitle"]` from
`pages/[[...path]].tsx`. Offline against the captured tree the new suite scores **15 of 16**,
failing only the new assertion. Re-run on the current fixture:

| Arm | Skill installed | Pass | Wall-clock |
|---|---|---|---|
| `breadcrumbs-titleparam-baseline` | none | 0% (6 of 17 failed) | 679s |
| `breadcrumbs-titleparam` | Route API titles (shipped) | **100%** (16/16 + judge) | 450s |

The agent wrote `const TITLE_PARAMETER = 'headline'` in the route module — same result as on the
App Router, from the same definition, which is the evidence that reading the title parameter is a
property of the skill rather than of one framework's wiring. Its baseline failed the same six
assertions as the App Router's, and the same five as its own first run plus the new one. Both
fixtures ran under one temporary `breadcrumbs-titleparam` / `breadcrumbs-titleparam-baseline`
pair, since deleted.

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
