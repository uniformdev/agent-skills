import type { ExperimentConfig } from '@vercel/agent-eval';
import { installSkills } from './lib/skill-install.js';

// With-skill arm on Cursor CLI: the uniform-mesh skill staged in `.cursor/skills/`.
//
// Deliberately NOT delivered as a plugin — see the note in lib/skill-install.ts. Plugin-bundled
// skills never reach the headless cursor-agent registry, so a plugin-shaped arm would measure
// nothing and look like the skill had no effect.
const config: ExperimentConfig = {
  agent: 'cursor',
  // See mesh-cursor-baseline.ts for why this id and not `composer-1.5` or a bare `grok-4.6`.
  model: 'cursor-grok-4.6-high-fast',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: installSkills('cursor', ['uniform-mesh']),
};

export default config;
