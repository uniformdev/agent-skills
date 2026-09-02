/**
 * GitHub Copilot CLI in-sandbox runner.
 *
 * Shipped INTO the sandbox by agent-eval's orchestrator and executed there as
 * `node __agent_eval__/run.mjs '<AgentRunInput JSON>'`. Zero-dependency (only
 * `node:*` builtins) — the sandbox has the fixture's deps and the `copilot` CLI,
 * and cannot import anything from @vercel/agent-eval.
 *
 * Mirrors the shape of the package's own runners (cursor/run.mjs is the reference):
 * dual-mode (runnable + importable), always writes a RunnerResult, exits 0 so the
 * host distinguishes "runner ran" from "agent succeeded".
 *
 * Two Copilot-specific choices, both verified against copilot 1.0.80 `--help`:
 *
 *   - `--allow-all-tools` is not optional. The CLI's own help says it is "required
 *     for non-interactive mode", so `-p` without it stalls on a permission prompt.
 *   - the transcript comes from `--share <path>`, which writes the session as
 *     markdown after a non-interactive run. It is NOT JSONL, and 'copilot' is not
 *     one of agent-eval's o11y parsers, so nothing parses it — it is carried for the
 *     judge and for human debugging. The share file is written to the OS temp dir,
 *     never the workspace, so it cannot pollute `copyFiles: 'changed'`.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Build the Copilot CLI argument list.
 *
 * @param {{prompt:string, model?:string, agentOptions?:Record<string,unknown>}} input
 * @param {string} sharePath absolute path the session markdown is written to
 * @returns {string[]}
 */
export function buildCopilotCliArgs(input, sharePath) {
  const args = ['--prompt', input.prompt, '--allow-all-tools', '--no-color'];

  // Skills reach Copilot the way the shipped plugin delivers them: as a local
  // plugin directory (plugin.json + skills/), loaded with --plugin-dir. The
  // baseline arm passes no pluginDir, so the flag is absent entirely.
  const pluginDir = input.agentOptions?.pluginDir;
  if (typeof pluginDir === 'string' && pluginDir) {
    args.push('--plugin-dir', pluginDir);
  }

  // Only pass --model when the experiment pinned one. Omitted → the CLI picks,
  // which is the honest default: Copilot serves its own models and cannot be
  // pointed at Vercel AI Gateway like the other arms.
  if (input.model) {
    args.push('--model', input.model);
  }

  args.push('--share', sharePath);
  return args;
}

/**
 * Read the session markdown `--share` produced, if it exists.
 *
 * @param {string} sharePath
 * @returns {string|null}
 */
export function readShareTranscript(sharePath) {
  try {
    const contents = readFileSync(sharePath, 'utf8');
    return contents.trim() ? contents : null;
  } catch {
    // No share file: the run failed before completion, or the CLI declined to
    // write one. The output string is still captured either way.
    return null;
  }
}

/**
 * Pull the CLI's own usage footer out of stdout.
 *
 * Copilot prints its spend as human-readable lines at the end of a non-interactive run:
 *
 *   AI Credits 2.15 (5s)
 *   Tokens     ↑ 16.9k (16.9k cached) • ↓ 54 (44 reasoning)
 *
 * This is the ONLY place Copilot reports cost — the `--share` transcript omits it, and the
 * harness persists a trimmed result.json that drops agent stdout entirely. So the numbers are
 * lost unless they are folded into the transcript, which is what the caller does with this.
 *
 * @param {string} output combined stdout+stderr
 * @returns {string|null} a machine-greppable block, or null when nothing matched
 */
export function extractUsageFooter(output) {
  if (!output) return null;
  const credits = output.match(/^\s*AI Credits\s+(.+)$/m);
  const tokens = output.match(/^\s*Tokens\s+(.+)$/m);
  if (!credits && !tokens) return null;
  const lines = ['<!-- copilot-usage'];
  if (credits) lines.push(`ai_credits: ${credits[1].trim()}`);
  if (tokens) lines.push(`tokens: ${tokens[1].trim()}`);
  lines.push('-->');
  return lines.join('\n');
}

/**
 * Run Copilot over the workspace at `input.cwd` and return a RunnerResult.
 *
 * Auth arrives via process.env (COPILOT_GITHUB_TOKEN, set by the orchestrator from
 * the definition's authEnv) and is passed straight through. The runner never
 * handles the secret itself.
 *
 * @param {import('@vercel/agent-eval/dist/lib/agents/plugin/contract.js').AgentRunInput} input
 * @returns {Promise<import('@vercel/agent-eval/dist/lib/agents/plugin/contract.js').RunnerResult>}
 */
export async function runAgent(input) {
  // Outside input.cwd on purpose — a share file in the workspace would be captured
  // as a file the agent "generated".
  const sharePath = join(tmpdir(), 'copilot-session.md');
  const args = buildCopilotCliArgs(input, sharePath);

  const res = spawnSync('copilot', args, {
    cwd: input.cwd,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const output = stdout + stderr;
  const agentExitCode = res.status == null ? -1 : res.status;

  const shared = readShareTranscript(sharePath);
  try {
    rmSync(sharePath, { force: true });
  } catch {
    // Best-effort cleanup; the sandbox is torn down anyway.
  }

  // Prepend the usage footer so cost survives into the persisted transcript.
  const usage = extractUsageFooter(output);
  const transcript = shared || usage ? [usage, shared].filter(Boolean).join('\n\n') : null;

  // Copilot does not report the resolved model in a machine-readable place, so
  // observedModel stays null (same as cursor and gemini in the package itself).
  const observedModel = null;

  if (res.error || agentExitCode !== 0) {
    const errorLines = output.trim().split('\n').slice(-5).join('\n');
    const fallback = res.error
      ? `Failed to run copilot: ${res.error.message}`
      : `Copilot CLI exited with code ${agentExitCode}`;
    return {
      ok: false,
      output,
      transcript,
      observedModel,
      error: errorLines || fallback,
      agentExitCode,
    };
  }

  return { ok: true, output, transcript, observedModel, error: null, agentExitCode };
}

/* ─────────────────────────── runnable (CLI) entry ─────────────────────────── */

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const input = JSON.parse(process.argv[2]);

  let result;
  try {
    result = await runAgent(input);
  } catch (e) {
    result = {
      ok: false,
      output: '',
      transcript: null,
      observedModel: null,
      error: e && e.message ? e.message : String(e),
      agentExitCode: -1,
    };
  }

  try {
    mkdirSync(dirname(input.resultPath), { recursive: true });
    writeFileSync(input.resultPath, JSON.stringify(result));
  } catch {
    // Host falls back to the marker line below.
  }

  process.stdout.write(
    '__AGENT_RESULT__ ' +
      JSON.stringify({
        ok: result.ok,
        observedModel: result.observedModel,
        error: result.error,
        agentExitCode: result.agentExitCode,
      }) +
      '\n'
  );

  process.exit(0);
}
