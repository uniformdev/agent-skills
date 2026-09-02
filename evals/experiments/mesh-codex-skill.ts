import type { ExperimentConfig } from '@vercel/agent-eval';
import { installSkills } from './lib/skill-install.js';

// With-skill arm on Codex: the uniform-mesh skill (discovered from .agents/skills).
const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/codex',
  // See mesh-codex-baseline.ts on verifying a model pin actually resolves.
  model: 'openai/gpt-5.3-codex',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  // Must match mesh-codex-baseline's ceiling, and generous enough that a pass is not a
  // coin-flip against the clock.
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: installSkills('codex', ['uniform-mesh']),
};

export default config;
