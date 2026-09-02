import type { ExperimentConfig } from '@vercel/agent-eval';
import { baseline } from './lib/skill-install.js';

// Arm A (control) on Codex: no skill, no AGENTS.md.
// Judge is pinned to Claude so codex output is not self-graded (see JudgeConfig).
// Use a Codex-tuned model (the CLI expects one; a general chat model like gpt-4.1-mini
// underperforms badly here) — adjust the tier if a cheaper *-codex model is enabled.
const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/codex',
  // A gateway can list a model in /v1/models that is not actually deployed and 404s on
  // /v1/responses — verify a pin resolves before recording numbers against it.
  model: 'openai/gpt-5.3-codex',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  // Codex is slow on this fixture — a short ceiling times out even the control. Give all
  // Codex arms headroom so a timeout does not mask the real output.
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: baseline(),
};

export default config;
