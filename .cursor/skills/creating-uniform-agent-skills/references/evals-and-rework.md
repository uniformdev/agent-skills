# Evals and reworking a skill

A skill change is a behavioural claim. The harness in `evals/` is how the claim gets tested.
Full harness docs: [evals/README.md](../../../../evals/README.md). This covers what a skill
author needs.

## What an eval measures

Each eval is an A/B: `baseline` (the skill stripped) versus `with-skill`, over a fixture, graded
by `EVAL.ts`. The pass-rate delta is the skill's value. Prompts never name the skill, so every
run also tests whether the description self-activates.

Two readings that matter:

- **A `baseline` failure is the gap you are measuring.** Good.
- **A `with-skill` failure is a bug in the skill.** Not a flaky test — read it as a defect report
  and find the missing instruction.

## Adding an eval for a skill

```bash
mkdir -p evals/evals/<task-name>/.skills-src
ln -s ../../../../skills/<skill-name> evals/evals/<task-name>/.skills-src/<skill-name>
```

Then `PROMPT.md` (how a real user would ask, never naming the skill), `EVAL.ts` (vitest against
the resulting project state), and `package.json` for the fixture. The `.skills-src/` symlink is
agent-neutral: each experiment's `setup()` copies it into whichever folder that agent scans, so
one fixture serves Claude Code and Codex.

**Assertions mirror the skill.** Every `test()` should encode a documented failure mode the skill
exists to prevent, with a failure message that reads as a skill-gap report. And make them
actually check what they claim.

**Prefer deterministic over judge.** A judge call costs ~35s and varies between runs. A regex
assertion is free, runs every time, and can be validated offline against captured runs before
you spend a session.

## The rework loop

1. **Baseline first.** Run the existing arms. Without a before number you cannot tell a
   regression from variance.
2. **Candidate as a separate skill.** Copy `skills/uniform-<topic>/` to
   `skills/uniform-<topic>-<variant>/`, change only the thing under test, and set the `name`
   frontmatter to match the new directory.
3. **Stage it and add arms.** Symlink it into the fixture's `.skills-src/` and add
   `<fixture>-<agent>-<variant>.ts` experiments that install it by name. Same fixture, same
   `EVAL.ts`, same judge as the incumbent arms — the skill must be the only variable.
4. **Run both agents.** Cross-agent results diverge.
5. **Promote or drop.** If it matches or beats the incumbent, copy the content across, delete the
   candidate directory, its arms, and its fixture symlink. Record the outcome *and the cost* in
   the pull request, so a future reader does not revert it on a hunch.

## Reading results honestly

- **`runs: 1` on every experiment.** One green run is not evidence. Either take several samples or state the sample size in
  the claim — "no evidence of a regression at n=3", never "proven equivalent".
- **`⚠️ ungraded` is not `0%`.** If vitest dies before executing `EVAL.ts` — a pruned test
  dependency, a config that throws — the run measured nothing. `scripts/report.mjs` labels these;
  do not read one as a skill failure.
- **Paired arms share one `timeout`.** If the treatment is cut off while its control keeps
  working, the comparison is void. Change both together.
- **Check what the agent produced, not just the verdict.** The captured project under
  `evals/results/<arm>/<ts>/<eval>/run-1/project/` will often show that the skill worked and the
  grader broke, or vice versa.

## Cost

Every run is a real agent session — budget a few dollars each, and more for Codex. Consequences:
scope fixtures small, prefer deterministic assertions, re-run only the arms that see your change
(baselines are unaffected by a skill edit, so their prior results stand), and check
`npm run eval:status` first to see what is actually stale.
