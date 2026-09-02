import type { ExperimentConfig } from '@vercel/agent-eval';
import { baseline } from './lib/skill-install.js';
// Side-effect import: registers `copilot` in agent-eval's agent registry.
import './lib/copilot-agent.js';

// Arm A (control) on GitHub Copilot CLI: no skill, no AGENTS.md.
//
// `model` is deliberately omitted, unlike every other arm. Copilot serves its own models
// and cannot be pointed at Vercel AI Gateway, so there is nothing to pin — the CLI picks,
// and the runner passes no --model. The consequence: the Copilot delta is comparable to
// the Copilot baseline and to nothing else. Judge stays pinned to Claude so grading is
// consistent with the other arms and Copilot never self-grades.
const config: ExperimentConfig = {
  agent: 'copilot',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  // Same ceiling as every other mesh arm — a control that gets less wall-clock than its
  // treatment cannot be compared to it. Unmeasured for Copilot; revise once there is a run.
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: baseline(),
};

export default config;
