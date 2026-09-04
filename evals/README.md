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
navigation, automations and search fixtures are covered by the generic `baseline` / `with-skill`
pair, so plain `npm run eval` runs them.

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
| `search-add-faceted-search` | `uniform-search` | brownfield, deterministic | adding Uniform Search to a correct App Router project: the components and definitions scaffolded with the `create-uniform-search` CLI (asserted from the transcript) rather than reinvented, `@uniformdev/search` installed, the search types registered through the compat adapter without rewriting existing server components, public env vars declared without clobbering existing credentials, the `mono-*` theme actually imported (not just written to disk), definitions staged as the vendored CLI package with `mode: 'create'` next to its config and not in `uniform-data/`, the package authored in the project's default locale, and the push handed to the user (no `sync push`, no MCP mutations) |

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
- **`search-add-faceted-search` measures delegation, not reinvention.** `uniform-search` ships no
  code; it sends the agent to the `create-uniform-search` npm CLI for the components and the
  definitions package. A cold agent cannot know that CLI exists and is being asked to invent a
  search stack, so the baseline gap is large by design; the first assertion checks the transcript
  for the CLI invocation, and the rest target where a with-skill run can still go wrong — the
  resolver shape (the compat adapter must be gated, not chained, and the existing `Hero` not
  rewritten), the package staged next to its `create`-mode config, the locale (the fixture's default
  is `en-US` so the step is exercised, not trivially satisfied), and the hand-off. Deterministic
  only. The Uniform side — the push, the integration's parameter types, opening the page slot — is
  not exercised, because fixtures do not call a live project.
- **Assertions strip comments before matching**, so an agent that quotes a rule back in a comment is
  not credited — or failed — for agreeing with it.
- **The automations fixtures use the full discovery skip set** (`.claude`, `.agents`, `.cursor`,
  `.copilot-plugin`, `.skills-src`) rather than the shorter one in the nextjs and forms fixtures.
  Keep it in step with `DISCOVERY_ROOT` in `experiments/lib/skill-install.ts`.
- **`timeout` is experiment-level, so the generic pair carries the maximum its fixtures need.** The
  navigation fixture is why that is 1800s: at a shorter ceiling both arms get truncated, which by
  the paired-arms rule voids the comparison rather than producing a 0%.

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
- A fixture with a `postcss.config.*` must use the **object** plugin form
  (`plugins: { "@tailwindcss/postcss": {} }`), not Next's string-array form. Vitest runs inside
  the project and loads that config through Vite's PostCSS loader, which rejects string plugins
  with `Invalid PostCSS Plugin found at: plugins[0]` — the run then dies before `EVAL.ts` executes
  and reports as `⚠️ ungraded`. Next.js accepts both forms.
