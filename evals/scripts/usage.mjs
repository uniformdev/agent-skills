#!/usr/bin/env node
// Aggregates score, wall-clock, and token usage per experiment from evals/results/.
//
// The harness's summary.json records passRate and meanDuration but no token counts, and
// nothing records USD — exact spend lives in the Vercel AI Gateway dashboard (and, for
// Copilot arms, in GitHub's AI-credit accounting). Tokens are recoverable from the raw
// transcripts, which is what this reads.
//
// Usage: node scripts/usage.mjs [experiment-glob]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
const filter = process.argv[2];

const dirs = (p) =>
  existsSync(p)
    ? readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
    : [];

/**
 * Sum token usage from one raw transcript. Claude nests usage under `message.usage` with
 * `cache_read_input_tokens`; Codex puts it at `usage` with `cached_input_tokens` plus a
 * `reasoning_output_tokens` counter. Unknown shapes contribute nothing rather than throwing —
 * a new agent should show 0 tokens, not break the report.
 */
function tokensFromTranscript(file) {
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, records: 0 };
  if (!existsSync(file)) return totals;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const u = event?.message?.usage ?? event?.usage;
    if (!u) continue;
    totals.records += 1;
    // Three conventions, and they are NOT interchangeable — reading them naively produces
    // a wildly wrong cross-agent comparison:
    //
    //   Claude  — per-message records; `cache_read_input_tokens` is SEPARATE from
    //             `input_tokens`, and `cache_creation_input_tokens` is the fresh-write cost.
    //   Codex   — one cumulative record; `cached_input_tokens` is a SUBSET of `input_tokens`,
    //             so fresh input = input_tokens - cached_input_tokens. Adding both double-counts.
    //   Cursor  — one cumulative record, camelCase; `cacheReadTokens` is separate, and
    //             `cacheWriteTokens` is always 0 (not reported).
    const rawInput = u.input_tokens ?? u.inputTokens ?? 0;
    const nestedCache = u.cached_input_tokens ?? 0; // Codex-style subset
    const separateCache = u.cache_read_input_tokens ?? u.cacheReadTokens ?? 0;

    totals.input += rawInput - nestedCache;
    totals.cacheRead += nestedCache + separateCache;
    totals.output += u.output_tokens ?? u.outputTokens ?? 0;
    totals.cacheWrite +=
      u.cache_creation_input_tokens ?? u.cache_write_input_tokens ?? u.cacheWriteTokens ?? 0;
    totals.reasoning += u.reasoning_output_tokens ?? u.reasoningTokens ?? 0;
  }
  return totals;
}

/**
 * Copilot reports spend only as a stdout footer, which copilot-run.mjs folds into the
 * transcript as an HTML comment (there are no per-message usage records to sum). Surface it
 * verbatim rather than pretending it is comparable to the token columns.
 */
function copilotUsage(file) {
  if (!existsSync(file)) return null;
  const head = readFileSync(file, 'utf8').slice(0, 2000);
  const credits = head.match(/^ai_credits:\s*(.+)$/m);
  const tokens = head.match(/^tokens:\s*(.+)$/m);
  if (!credits && !tokens) return null;
  return [credits && `credits ${credits[1].trim()}`, tokens && tokens[1].trim()]
    .filter(Boolean)
    .join(' \u00b7 ');
}

const fmt = (n) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const rows = [];
const seen = new Set();

for (const experiment of dirs(resultsDir).sort()) {
  if (filter && !experiment.includes(filter)) continue;
  for (const timestamp of dirs(join(resultsDir, experiment)).sort().reverse()) {
    for (const evalName of dirs(join(resultsDir, experiment, timestamp))) {
      const key = `${experiment}/${evalName}`;
      if (seen.has(key)) continue; // latest result wins, matching report.mjs
      seen.add(key);
      const evalDir = join(resultsDir, experiment, timestamp, evalName);
      const summaryPath = join(evalDir, 'summary.json');
      if (!existsSync(summaryPath)) continue;
      const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

      const agg = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, records: 0 };
      let runs = 0;
      let copilot = null;
      for (const run of dirs(evalDir).filter((d) => d.startsWith('run-'))) {
        runs += 1;
        const raw = join(evalDir, run, 'transcript-raw.jsonl');
        const t = tokensFromTranscript(raw);
        for (const k of Object.keys(agg)) agg[k] += t[k];
        copilot = copilot ?? copilotUsage(raw);
      }
      rows.push({ experiment, evalName, timestamp, summary, agg, runs, copilot });
    }
  }
}

if (rows.length === 0) {
  console.log('No results found.');
  process.exit(0);
}

console.log('| Experiment | Eval | Pass | Mean s | In | Out | Reasoning | Cache r/w | Billable* |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows.sort((a, b) => a.experiment.localeCompare(b.experiment))) {
  const billable = r.agg.input + r.agg.output + r.agg.cacheWrite; // cacheRead is discounted
  console.log(
    `| \`${r.experiment}\` | ${r.evalName} | ${r.summary.passRate ?? '—'} | ${
      r.summary.meanDuration != null ? Math.round(r.summary.meanDuration) : '—'
    } | ${fmt(r.agg.input)} | ${fmt(r.agg.output)} | ${fmt(r.agg.reasoning)} | ${fmt(
      r.agg.cacheRead
    )} / ${fmt(r.agg.cacheWrite)} | ${r.copilot ?? fmt(billable)} |`
  );
}
console.log(
  '\n\\* Billable = fresh input + output + cache-write; cache-read is billed at a large discount'
);
console.log(
  'and is listed separately. Codex nests its cached tokens inside input_tokens, so fresh input is'
);
console.log(
  'input - cached; Claude and Cursor report cache reads separately. Claude also emits per-message'
);
console.log(
  'records while Codex/Cursor emit one cumulative record, so cache-read totals are NOT comparable'
);
console.log('across agents — only fresh input + output is.');
console.log(
  'listed separately. These are token counts, not USD — read actual spend off the AI Gateway'
);
console.log('dashboard, since gateway pricing is not derivable from the transcripts.');
