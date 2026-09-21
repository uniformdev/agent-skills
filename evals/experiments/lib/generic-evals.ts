/**
 * The fixtures the generic `baseline` / `with-skill` pair covers.
 *
 * Every fixture listed here is Claude Code plus a skill staged in `.skills-src/`, which
 * is the whole of what `baseline()` and `installSkills('claude')` need — neither reads a
 * fixture name. So one pair measures all of them, and each still gets its own row in the
 * report and its own cache entry, because results and fingerprints are keyed by
 * (experiment, eval) rather than by experiment alone.
 *
 * `mesh-data-connector` is absent because it runs a 4-agent matrix (experiments/mesh-*.ts)
 * and `agent` is an experiment-level setting — one experiment cannot span agents.
 *
 * An explicit allowlist rather than a `startsWith` glob: a new fixture needing its own
 * agent, model or setup is then excluded by default instead of being silently swept in
 * and run under the wrong arm.
 *
 * Shared by both arms deliberately. The pair must always cover the same fixture set — a
 * treatment measured over a different set than its control is not a comparison.
 */
export const GENERIC_EVALS = [
  'automations-ai-review',
  'automations-inbound-sync',
  'automations-outbound-sync',
  'forms-add-form',
  'nextjs-app-router-add-component',
  'nextjs-app-router-setup',
  'nextjs-breadcrumbs',
  'nextjs-navigation-mega-menu',
  'nextjs-page-router-breadcrumbs',
];
