import type { ExperimentConfig } from '@vercel/agent-eval';
import { baseline } from './lib/skill-install.js';
import { GENERIC_EVALS } from './lib/generic-evals.js';

// Control: the agent gets no Uniform skill. Fixtures stage their skill in `.skills-src/`;
// baseline() strips it (plus any harness folder / AGENTS.md) and verifies the removal, because
// a silently-failed delete would contaminate the control.
const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  model: 'anthropic/claude-sonnet-4.6',
  // Every Claude fixture at once — see lib/generic-evals.ts. The mesh fixture runs a
  // dedicated 4-agent matrix (experiments/mesh-*.ts) with its own baseline.
  evals: GENERIC_EVALS,
  runs: 1,
  earlyExit: false,
  // Paired with with-skill.ts — change both together (see evals/README.md).
  //
  // `timeout` is experiment-level; agent-eval has no per-eval override. So this is the
  // maximum over the covered fixtures, not a per-fixture budget: nextjs-navigation-mega-menu
  // needs 1800 (both its arms run past 900s, and a 900s ceiling cut a run off mid-task). Carrying the cheaper fixtures at 1800 costs nothing
  // on a healthy run — a timeout only takes effect on a hung one, and there it means waiting
  // 30 minutes to find out rather than 15. Sizing down instead would truncate nav and report
  // it as 0%, which reads as a skill defect rather than the infra failure it is.
  timeout: 1800,
  copyFiles: 'changed',
  // Pinned so nothing self-grades: nextjs-app-router-add-component, forms-add-form and
  // nextjs-navigation-mega-menu all use `toSatisfyCriterion`.
  judge: { agent: 'vercel-ai-gateway/claude-code', model: 'anthropic/claude-sonnet-4.6' },
  setup: baseline(),
};

export default config;
