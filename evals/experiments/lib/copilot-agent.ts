/**
 * GitHub Copilot CLI as an agent-eval agent.
 *
 * agent-eval ships adapters for claude-code, codex, cursor, gemini, and opencode —
 * not Copilot. Since 1.5.0 the registry is open (`AgentType = BuiltInAgentType |
 * (string & {})` plus a public `registerAgent`), so a Copilot arm is a local
 * registration rather than a fork. Importing this module registers it; the mesh
 * Copilot experiments import it for that side effect.
 *
 * Two caveats to keep in mind when reading Copilot numbers:
 *
 *   1. **Not model-comparable to the other arms.** Every other experiment pins a
 *      model through Vercel AI Gateway. Copilot serves its own models and cannot be
 *      pointed at the gateway, so a Copilot baseline-vs-skill delta is meaningful
 *      *within* Copilot and not against the Claude/Codex numbers.
 *   2. **`AgentDefinition` and `runWithDefinition` are not public exports.** They
 *      are reached by subpath import, which works because the package publishes no
 *      `exports` map. That is the one thing here that a minor agent-eval bump can
 *      break — if it does, this file is where it breaks, loudly, at import time.
 */
import { fileURLToPath } from 'node:url';
import { registerAgent } from '@vercel/agent-eval';
import type { Agent, AgentRunOptions } from '@vercel/agent-eval';
import { runWithDefinition } from '@vercel/agent-eval/dist/lib/agents/plugin/orchestrator.js';
import type { AgentDefinition } from '@vercel/agent-eval/dist/lib/agents/plugin/contract.js';

/** Registry name used by `agent: 'copilot'` in an experiment config. */
export const COPILOT_AGENT = 'copilot';

/**
 * Auth env var. Copilot CLI accepts COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN
 * in that order of precedence; we use the most specific one so setting GH_TOKEN for
 * some other tool cannot silently retarget the eval.
 *
 * The token must be a fine-grained PAT owned by a *personal* account with the
 * "Copilot Requests" permission. A GitHub Actions installation token
 * (`secrets.GITHUB_TOKEN`) is rejected by the endpoint, so the Skill evals workflow
 * needs a real PAT in secrets, not the default token.
 */
export const COPILOT_TOKEN_ENV = 'COPILOT_GITHUB_TOKEN';

/**
 * Pinned so a CLI release cannot silently change eval results. 1.0.80 is the version
 * whose flag surface this adapter was written against (`--prompt`, `--allow-all-tools`,
 * `--plugin-dir`, `--model`, `--share`, `--no-color`). Bump deliberately, and re-read
 * `copilot --help` when you do.
 */
export const COPILOT_CLI_VERSION = '1.0.80';

/** Build the Copilot CLI definition. */
export function createCopilotDefinition(): AgentDefinition {
  return {
    name: COPILOT_AGENT,
    displayName: 'GitHub Copilot CLI',
    // Copilot resolves the model itself; 'auto' is its own documented value for that.
    // Experiments omit `model` so the CLI decides and the runner passes no --model.
    defaultModel: 'auto',
    // Not one of agent-eval's parsers ('claude-code' | 'codex' | 'opencode'), which is
    // deliberate: the --share transcript is markdown, not JSONL. Transcript parsing is
    // best-effort and returns null for unknown agents, so this degrades quietly.
    o11yAgentName: COPILOT_AGENT,
    runnerPath: fileURLToPath(new URL('./copilot-run.mjs', import.meta.url)),
    getApiKeyEnvVar() {
      return COPILOT_TOKEN_ENV;
    },
    install(_options: AgentRunOptions) {
      return [
        {
          kind: 'command' as const,
          cmd: 'npm',
          args: ['install'],
          retryOnce: true,
          errorPrefix: 'npm install failed',
          errorBody: 'last10' as const,
        },
        {
          kind: 'command' as const,
          cmd: 'npm',
          args: ['install', '-g', `@github/copilot@${COPILOT_CLI_VERSION}`],
          errorPrefix: 'Copilot CLI install failed',
          errorBody: 'stderr' as const,
        },
      ];
    },
    // Everything is CLI flags + env; no config file to write.
    configFiles() {
      return [];
    },
    authEnv(options: AgentRunOptions) {
      return { [COPILOT_TOKEN_ENV]: options.apiKey };
    },
  };
}

/** Create the Copilot Agent, wrapping the shared orchestrator. */
export function createCopilotAgent(): Agent {
  const definition = createCopilotDefinition();
  return {
    name: definition.name,
    displayName: definition.displayName,
    definition,
    getApiKeyEnvVar: definition.getApiKeyEnvVar,
    getDefaultModel() {
      return definition.defaultModel;
    },
    run(fixturePath: string, options: AgentRunOptions) {
      return runWithDefinition(definition, fixturePath, options);
    },
  };
}

// Side effect on import: make `agent: 'copilot'` resolvable. Idempotent in practice —
// the experiments that need it each import this module, and Node caches it.
registerAgent(createCopilotAgent());
