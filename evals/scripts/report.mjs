#!/usr/bin/env node
// Renders a markdown report from evals/results/. Used by the GitHub Action
// (piped into $GITHUB_STEP_SUMMARY) and handy locally: node scripts/report.mjs
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');

const dirs = (p) =>
  existsSync(p)
    ? readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
    : [];

const rows = [];
const failures = [];
const ungraded = [];
const seen = new Set(); // latest result per (experiment, eval) wins

// A vitest run that dies before executing anything emits no assertion lines at all. That is
// categorically different from a run whose assertions failed, but `summary.json` records
// both as 0% — which reads as "the skill regressed" when the truth is "nothing was
// measured". Seen in practice: an agent dropped vitest from package.json, so the harness's
// injected vitest.config.ts could not resolve `vitest/config` and vitest died at startup. Classify on the absence of assertion lines rather than on error strings, so
// new failure signatures are still caught; the markers only explain the cause.
const ASSERTION_LINE = /^\s*[✓×]/;
const CAUSE_MARKERS =
  /(Startup Error|failed to load config|Cannot find module '[^']*'|No test files found)/;

const gradingFailure = (evalTxt) => {
  const lines = evalTxt.split('\n');
  if (lines.some((l) => ASSERTION_LINE.test(l))) return null;
  const cause = lines.map((l) => l.match(CAUSE_MARKERS)?.[1]).find(Boolean);
  return cause ?? 'no assertions executed';
};

for (const experiment of dirs(resultsDir).sort()) {
  for (const timestamp of dirs(join(resultsDir, experiment)).sort().reverse()) {
    for (const evalName of dirs(join(resultsDir, experiment, timestamp))) {
      if (seen.has(`${experiment}/${evalName}`)) continue;
      seen.add(`${experiment}/${evalName}`);
      const evalDir = join(resultsDir, experiment, timestamp, evalName);
      const summaryPath = join(evalDir, 'summary.json');
      if (!existsSync(summaryPath)) continue;
      const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
      const causes = [];
      // Collect failed assertion lines from each run's vitest output
      for (const run of dirs(evalDir).filter((d) => d.startsWith('run-'))) {
        const evalTxt = join(evalDir, run, 'outputs', 'eval.txt');
        if (!existsSync(evalTxt)) continue;
        const content = readFileSync(evalTxt, 'utf-8');

        const cause = gradingFailure(content);
        if (cause) {
          causes.push(cause);
          ungraded.push({ experiment, eval: evalName, run, cause });
          continue; // no assertions to report — the grader never got that far
        }

        const failed = content
          .split('\n')
          .filter((l) => l.trimStart().startsWith('×'))
          .map((l) => l.trim());
        if (failed.length) failures.push({ experiment, eval: evalName, run, failed });
      }
      const allRunsUngraded = causes.length > 0 && causes.length === summary.totalRuns;
      rows.push({
        experiment,
        eval: evalName,
        // Never print a pass rate nothing was measured against.
        passRate: allRunsUngraded ? '⚠️ ungraded' : (summary.passRate ?? '?'),
        passed: allRunsUngraded ? `0/${summary.totalRuns} graded` : `${summary.passedRuns}/${summary.totalRuns}`,
        meanDuration: summary.meanDuration ? `${Math.round(summary.meanDuration)}s` : '?',
        timestamp,
      });
    }
  }
}

let md = '## Skill eval report\n\n';
if (rows.length === 0) {
  md += '_No results found. Did the eval run produce output?_\n';
} else {
  md += '| Experiment | Eval | Pass rate | Runs | Mean duration |\n|---|---|---|---|---|\n';
  for (const r of rows) {
    md += `| ${r.experiment} | ${r.eval} | ${r.passRate} | ${r.passed} | ${r.meanDuration} |\n`;
  }
  if (ungraded.length) {
    md += '\n### Ungraded runs (infra, not skill)\n\n';
    md +=
      'These runs produced no assertion results, so their pass rate measures nothing. Fix the\n' +
      'harness/fixture cause and re-run before reading them as a skill outcome.\n\n';
    for (const u of ungraded) {
      md += `- **${u.experiment} / ${u.eval} / ${u.run}** — ${u.cause}\n`;
    }
    md += '\n';
  }
  if (failures.length) {
    md += '\n### Failed assertions\n\n';
    for (const f of failures) {
      md += `**${f.experiment} / ${f.eval} / ${f.run}**\n`;
      for (const line of f.failed) md += `- ${line}\n`;
      md += '\n';
    }
    md +=
      '\n_Failed baseline assertions are the skill gap being measured; failed with-skill assertions are regressions to fix._\n';
  }
}

process.stdout.write(md);
