import type { ExperimentConfig } from '@vercel/agent-eval';
import { installSkills } from './lib/skill-install.js';
import { GENERIC_EVALS } from './lib/generic-evals.js';

// Treatment: fixtures stage their skill(s) in an agent-neutral `.skills-src/` (symlinks to
// ../../../../skills/<name>). installSkills() copies every staged skill into Claude's
// discovery folder (`.claude/skills`) — the same install model as the mesh eval, and what
// the plugin does when it ships `skills/`. `.skills-src` is covered by the fingerprint, so
// editing a skill invalidates cached results natively. The pass-rate delta vs. baseline is
// the measured value of the skill.
const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  model: 'anthropic/claude-sonnet-4.6',
  // Every Claude fixture at once — see lib/generic-evals.ts. installSkills() takes no skill
  // names, so each fixture gets exactly what it staged. The mesh fixture has its own
  // experiments (experiments/mesh-*.ts).
  evals: GENERIC_EVALS,
  runs: 1,
  earlyExit: false,
  // Paired with baseline.ts — change both together, and see the note there for why 1800.
  timeout: 1800,
  copyFiles: 'changed',
  // Pinned so nothing self-grades — see baseline.ts.
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: installSkills('claude'),
};

export default config;
