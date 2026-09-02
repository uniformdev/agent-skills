import type { ExperimentConfig } from '@vercel/agent-eval';
import { installSkills } from './lib/skill-install.js';

// With-skill arm on Claude Code: the uniform-mesh skill.
const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  model: 'anthropic/claude-sonnet-4.6',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  // Must match mesh-claude-baseline's ceiling: a treatment that gets less wall-clock than
  // its control cannot be compared to it, so the timeout is a safety net for both arms at
  // the same value, never a per-arm handicap.
  //
  // It is generous because the design-system guidance teaches discovery from the installed
  // package instead of shipping a catalog, and the agent spends real time grepping and
  // type-checking. Matches both Codex arms.
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: installSkills('claude', ['uniform-mesh']),
};

export default config;
