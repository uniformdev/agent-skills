import type { ExperimentConfig } from '@vercel/agent-eval';
import { baseline } from './lib/skill-install.js';

// Arm A (control) on Claude Code: no skill, no AGENTS.md.
const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  model: 'anthropic/claude-sonnet-4.6',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  // The cold control needs more room than the guided arm: without a recipe it explores.
  // Generous so the eval measures produced-output quality, not just a timeout. Kept equal
  // to mesh-claude-skill's ceiling — paired arms share one timeout, see README.
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: baseline(),
};

export default config;
