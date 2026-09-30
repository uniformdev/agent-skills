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

**An assertion that cannot fail measures nothing.** One that every current scaffold satisfies
("the generated client sends the header" when the generator always writes it) only separates
"ran the generator" from "didn't", which might be already covered by another assertion. Fold it in or drop it.

## Prune against the baseline

After the baseline run, list the assertions it **passed**. Each one is behaviour the agent has
without the skill, so the skill text that defends it is a candidate to cut. Keep it only when
you can say why — a failure seen on another run, another agent, or a harder variant of the
fixture — and write that reason in the pull request. A skill whose baseline passes most of its
assertions is either not needed or not being measured by the right assertions; find out which
before merging.

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

## What goes in `evals/README.md`

The final state only: the fixture's row in the inventory table, the design notes a future reader
needs to interpret it (why this starter tree, why this assertion is scoped the way it is), and
**one** current results line. Dated re-measurements, deleted temporary arms, offline-validation
history and "the first draft of this assertion was wrong" belong in the pull request. A README
that narrates its own development ends up contradicting itself.

## The pull request

Write it last, from the final run, and regenerate every number in it — test counts, line counts
and pass rates drift while you iterate. Two tables, not a pass rate:

**Per arm — what the agent actually built**, one sentence each. "0% vs 100%" says the skill
changed something; this says what:

| Arm | Pass rate | Wall-clock | What the agent built |
|---|---|---|---|
| baseline | 0% (0 / 13) | 1057 s | hand-rolled `fetch` client behind a proxy API route, its own component set with invented type ids, definitions written into `uniform-data/` |
| with-skill | 100% (13 / 13) | 177 s | CLI scaffold, reconcile step as written, resolver gated with the existing components untouched, package staged with `mode: 'create'`, push handed to the user |

**Per assertion — baseline vs with-skill**, one row per `test()`, named for the failure mode
rather than the test id:

| Assertion | Baseline | With skill |
|---|---|---|
| runtime package is a dependency | ✗ | ✓ |
| existing integration not damaged | ✓ | ✓ |
| scaffold reconciled to build | n/a | ✓ |
| push handed to the user | — | — |

Legend under the table: `n/a` for an assertion that skips (say when), `—` for unasserted (say
why — e.g. no transcript captured). Every ✓ in the baseline column needs a sentence on why the
skill text behind it stays; see [Prune against the baseline](#prune-against-the-baseline). Then
the sample size (`n = 1 per arm` is normal — say it), what the fixture does not exercise, and
the history this README no longer carries.

## Cost

Every run is a real agent session — budget a few dollars each, and more for Codex. Consequences:
scope fixtures small, prefer deterministic assertions, re-run only the arms that see your change
(baselines are unaffected by a skill edit, so their prior results stand), and check
`npm run eval:status` first to see what is actually stale.
