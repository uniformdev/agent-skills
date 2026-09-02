import type { ExperimentConfig } from '@vercel/agent-eval';
import { baseline } from './lib/skill-install.js';

// Arm A (control) on Cursor CLI: no skill, no AGENTS.md.
//
// Cursor uses its own API directly (CURSOR_API_KEY), not the Vercel AI Gateway, so — like the
// Copilot arms — these numbers are comparable to the Cursor baseline and to nothing else.
// The judge stays pinned to Claude so Cursor never self-grades.
const config: ExperimentConfig = {
  agent: 'cursor',
  // Cursor's CLI model set is its own, and api.cursor.com/v0/models is not authoritative
  // for it — the CLI accepts ids the API does not list, and rejects some it does, including
  // agent-eval's adapter default. Pin an id the CLI has actually accepted.
  model: 'cursor-grok-4.6-high-fast',
  evals: 'mesh-data-connector',
  runs: 1,
  earlyExit: false,
  // Matched to every other mesh arm; unmeasured for Cursor, revise once there is a run.
  timeout: 1800,
  copyFiles: 'changed',
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: baseline(),
};

export default config;
