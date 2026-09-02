---
name: creating-uniform-agent-skills
description: Guides contributors through creating, reworking, and validating agent skills in the uniformdev/agent-skills repository — deciding what content belongs in a skill, verifying it against the shipped packages rather than memory or docs, wiring the generated plugin output, and measuring the result with the eval harness. Use when adding a skill for a new framework or product area, reworking an existing skill, or responding to review feedback or an eval failure on a skill.
license: MIT
metadata:
  author: uniformdev
  version: "2.0.0"
---

# Creating and reworking agent skills for this repository

How to add or rework content in `uniformdev/agent-skills` so it actually changes agent
behaviour, survives SDK releases, and can be shown to help. Format conventions are in the
templates; the judgement calls are here, because those are the ones review and evals actually
catch.

Architecture context: [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## When to apply

- Adding a skill for a new framework or product area (Nuxt, Astro, automations, routing)
- **Reworking** an existing skill — `uniform-sdk`, `uniform-experience-modeling`,
  `uniform-content-modeling`, `uniform-nextjs-*`, `uniform-mesh`
- Responding to review feedback or an eval failure against a skill

## The one-line version

**A skill is a set of instructions for doing a job — not a copy of the documentation.** Domain
context earns its place only where the agent cannot get it itself. Everything below is a
consequence of that.

## Four decisions that matter more than format

### 1. Instructions over reference

Write the sequence of moves for a task, the decisions inside it, and the traps. Do not restate
API surface for its own sake. A skill that reads like docs will go stale faster than the docs
and cost tokens every time it loads.

### 2. Defer when the answer is in the installed package — inline it when it isn't

The rule that resolves most "should this be in the skill?" arguments:

| The fact lives… | Do this |
|---|---|
| In `node_modules` (types, JSDoc, exports) | **Teach discovery.** Give the grep, not the list |
| Only in a hosted doc, a schema that doesn't exist yet, or nowhere | **Inline it.** The agent cannot look it up |

See [references/deciding-content.md](references/deciding-content.md).

### 3. Verify every claim against the artifact

Not against memory, and not against the docs page alone. **Where types and prose disagree, the types win** — say so in the skill when you
hit it, because the reader will otherwise trust the prose.

See [references/verifying-against-source.md](references/verifying-against-source.md).

### 4. Negative knowledge is the most valuable content you can add

Types tell an agent what exists. They cannot tell it what *doesn't* — and confident invention
is the failure mode that costs most. "There is no `ErrorBoundary` in the design system", "there
is no `useOpenDialog` hook", "`teamAdminRequired` has no `false`". Collect these as you verify,
and give them their own section.

## Workflow: a new skill

1. **Scaffold** `skills/uniform-<topic>/SKILL.md` plus `references/`, per
   [references/skill-template.md](references/skill-template.md). `name` must match the
   directory.
2. **Write the description last, and deliberately.** It is the entire activation lever — the
   body only loads if the description matched. Evals never name the skill in the prompt, so a
   skill that doesn't self-activate scores as a skill that doesn't work.
3. **Verify the content** against the shipped packages and real examples.
4. **Validate**: `npm run validate` — it globs `skills/`, so a new directory is picked up
   automatically. There is no per-skill npm script to add.
5. **Add an eval fixture** if the skill makes claims worth defending, and expect to iterate on
   it: [references/evals-and-rework.md](references/evals-and-rework.md).

## Workflow: reworking an existing skill

The pattern this repo uses:

1. **Establish the baseline first.** Run the skill's existing arms so you have a before number.
   Without it you cannot tell a regression from noise.
2. **Copy the skill to a candidate** — `skills/uniform-<topic>-<variant>/` — and change only the
   thing under test. Stage it in the fixture's `.skills-src/` and add candidate arms.
3. **Run both agents.** Same fixture, same `EVAL.ts`, same judge, so the skill is the only
   variable.
4. **Promote only if it matches or beats the incumbent**, then delete the candidate, its arms,
   and its fixture symlink. Record the outcome and the cost in the pull request — including
   what got slower.
5. **Do not conclude from one run.** Every experiment is `runs: 1`. 
   - If the candidate loses, check the logs for a reason. If you find one, fix it and re-run.
   - If the candidate wins, re-run to confirm. If it loses on the second run, check the logs
     and fix it before promoting.

## Repo mechanics that are easy to miss

- **Editing a skill description requires `npm run build:plugins`**, which regenerates the
  client manifests and the README skill inventory fenced by the `<!-- begin:skill-inventory -->`
  markers. `npm run validate:plugins` is the same script under `--check` and is what CI runs, so
  committing a description without rebuilding fails the build.
- **Contributor-facing skills do not belong in `skills/`.** That directory is the plugin payload
  shipped to customers. This skill lives outside it for that reason.
- **Single source of truth.** Two skills should not restate the same constraint — grep before
  adding, and link instead of duplicating.

## Resources

- [Deciding what belongs in a skill](references/deciding-content.md) — the defer/inline test,
  what to cut, and the content types that earn their tokens
- [Verifying against source](references/verifying-against-source.md) — how to read the shipped
  packages and examples, and the drift this has caught
- [Evals and reworking](references/evals-and-rework.md) — fixtures, the A/B candidate loop,
  reading results honestly
- [Skill template and checklist](references/skill-template.md) — frontmatter, structure,
  conventions
- [CONTRIBUTING.md](../../../CONTRIBUTING.md) — architecture, distribution, generated output
