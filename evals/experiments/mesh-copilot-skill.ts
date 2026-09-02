import type { ExperimentConfig } from '@vercel/agent-eval';
import { COPILOT_PLUGIN_DIR, installSkills } from './lib/skill-install.js';
// Side-effect import: registers `copilot` in agent-eval's agent registry.
import './lib/copilot-agent.js';

// With-skill arm on GitHub Copilot CLI: the uniform-mesh skill, delivered the way the
// shipped plugin delivers it — as a local Agent Plugins directory loaded with
// --plugin-dir. `installSkills('copilot', …)` stages the manifest + skills/; the
// pluginDir below tells the in-sandbox runner which directory to load.
//
// See mesh-copilot-baseline.ts for why no model is pinned.
const config: ExperimentConfig = {
  agent: 'copilot',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  agentOptions: { pluginDir: COPILOT_PLUGIN_DIR },
  setup: installSkills('copilot', ['uniform-mesh']),
};

export default config;
