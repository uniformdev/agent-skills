import type { Sandbox, SetupFunction } from '@vercel/agent-eval';
import { uniformEnvFiles } from './uniform-env.js';

/**
 * Shared skill-mounting for all evals.
 *
 * Fixtures stage their skill(s) in an agent-neutral `.skills-src/` (symlinks to
 * `/skills`) and, when they have one, the agent-agnostic instructions as `AGENTS.md`.
 * No harness-specific skill folder is committed. An experiment's setup() then either:
 *
 *   - `baseline()`      — strips all guidance for the cold control, and
 *   - `installSkills()` — copies the skill(s) from `.skills-src` into the folder the
 *                         agent discovers skills from, mirrors the instructions for
 *                         Claude, and removes the staging dir + the other agents'
 *                         conventions.
 *
 * This mirrors how the plugin distributes them: skills are defined once in `skills/`, and
 * each harness discovers them from its own folder. The pass-rate delta between
 * `installSkills` and `baseline` is the measured value of the skill.
 */

export type Agent = 'claude' | 'codex' | 'copilot' | 'cursor';

/** Directory the Copilot arm stages its local plugin in; passed to `--plugin-dir`. */
export const COPILOT_PLUGIN_DIR = '.copilot-plugin';

// Where each agent discovers skills, relative to the project root.
//
// Copilot is the odd one out, but not for the reason you would guess. Verified against
// copilot 1.0.80: it ALSO reads `.agents/skills/<name>/SKILL.md` with no plugin and no
// `--plugin-dir` at all — a skill staged there activates by description match, same as on
// Codex. We deliberately do not use that path. The plugin ships to Copilot as a plugin
// (root `plugin.json`), so staging a local plugin dir and loading it with `--plugin-dir`
// is the arm that mirrors the real distribution artifact; `.agents/skills` would measure a
// delivery route we do not ship.
//
// The consequence is that removing the other agents' roots below is load-bearing for
// Copilot specifically, not just tidiness: leave `.agents/` in place and a Copilot arm
// would silently read whatever the Codex arm staged there.
const SKILLS_DIR: Record<Agent, string> = {
  claude: '.claude/skills',
  codex: '.agents/skills',
  copilot: `${COPILOT_PLUGIN_DIR}/skills`,
  // Cursor reads `.cursor/skills/` (or `.agents/skills/`) anywhere in the repo. It must NOT be
  // a plugin dir: skills bundled in a plugin are loaded by Cursor's plugin subsystem but never
  // reach the agent's skill registry in the headless `cursor-agent` CLI — an IDE/CLI parity gap
  // Cursor tracks as a bug. Staging the bare directory is what actually reaches the CLI agent.
  cursor: '.cursor/skills',
};

/**
 * Root of each agent's discovery folder. Installing for one agent removes the others'
 * roots, so a stray folder cannot leak guidance into the arm under test.
 */
const DISCOVERY_ROOT: Record<Agent, string> = {
  claude: '.claude',
  codex: '.agents',
  cursor: '.cursor',
  copilot: COPILOT_PLUGIN_DIR,
};

const ALL_ROOTS = Object.values(DISCOVERY_ROOT);

/**
 * Minimal Agent Plugins v1 manifest for the staged Copilot plugin. Only `$schema` and
 * `name` are required by the schema, and the eval needs nothing else — this is a
 * delivery vehicle for the skill, not a copy of the shipped manifest.
 */
const COPILOT_PLUGIN_MANIFEST = JSON.stringify(
  {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: 'uniform',
    description: 'Uniform skills, staged for an eval run.',
  },
  null,
  2
);

/**
 * Rebuild the sandbox's git repo so removed guidance is unrecoverable.
 *
 * agent-eval establishes its git baseline BEFORE setup() runs (`git init && git add . &&
 * git commit -m "init"`), so anything setup deletes still exists in `HEAD`. A thorough agent
 * can, and has, recovered a whole skill with `git show HEAD:.skills-src/<name>/SKILL.md`,
 * turning the cold control into a with-skill run and scoring a false 100%.
 *
 * Deleting `.git` and re-initialising leaves no commit containing the guidance. This is safe
 * because the harness captures agent output with `git add . && git diff HEAD --name-status`,
 * i.e. relative to whatever HEAD is at capture time — not to a SHA it recorded earlier.
 */
const SCRUB_GIT_HISTORY = [
  'rm -rf .git',
  'git init -q',
  'git config user.email "agent-eval@localhost"',
  'git config user.name "agent-eval"',
  'git add -A',
  'git commit -q -m "baseline" --allow-empty',
].join('\n');

async function writeEnv(sandbox: Sandbox) {
  const env = uniformEnvFiles();
  if (env) await sandbox.writeFiles(env);
}

/** Cold control: remove the staging dir, every harness folder, and the instructions. */
export function baseline(): SetupFunction {
  return async (sandbox) => {
    await writeEnv(sandbox);
    await sandbox.runCommand('rm', [
      '-rf',
      '.skills-src',
      ...ALL_ROOTS,
      'AGENTS.md',
      'CLAUDE.md',
    ]);
    const checkArgs = ['!', '-e', '.skills-src'];
    for (const root of ALL_ROOTS) checkArgs.push('-a', '!', '-e', root);
    const check = await sandbox.runCommand('test', checkArgs);
    if (check.exitCode !== 0)
      throw new Error('baseline setup: skill folders still present after removal');

    // Removing the files is not enough — see SCRUB_GIT_HISTORY.
    const scrub = await sandbox.runCommand('sh', ['-c', SCRUB_GIT_HISTORY]);
    if (scrub.exitCode !== 0)
      throw new Error(`baseline setup: git history scrub failed: ${scrub.stderr}`);
    const leak = await sandbox.runCommand('sh', [
      '-c',
      'git log --all --name-only --pretty=format: | grep -c "skills-src" || true',
    ]);
    if (leak.stdout.trim() !== '0')
      throw new Error(
        `baseline setup: guidance still recoverable from git (${leak.stdout.trim()} paths)`
      );
  };
}

/**
 * Install skills from `.skills-src` into the agent's discovery folder.
 * Pass specific skill names, or omit `names` to install every staged skill.
 */
export function installSkills(agent: Agent, names?: string[]): SetupFunction {
  return async (sandbox) => {
    await writeEnv(sandbox);
    const dir = SKILLS_DIR[agent];
    const list = names && names.length ? names.map((n) => `"${n}"`).join(' ') : '$(ls .skills-src)';
    const otherRoots = ALL_ROOTS.filter((root) => root !== DISCOVERY_ROOT[agent]);
    const script = [
      'set -e',
      `mkdir -p "${dir}"`,
      `for s in ${list}; do cp -RL ".skills-src/$s" "${dir}/$s"; done`,
      // Codex discovers skills from $CWD/.agents/skills and $REPO_ROOT/.agents/skills.
      // The sandbox is not a git repo, so init one to make $REPO_ROOT resolve to the
      // project root — otherwise Codex may not surface the staged skill.
      agent === 'codex' ? 'command -v git >/dev/null 2>&1 && git init -q || true' : '',
      // Copilot loads the staged directory as a plugin, which requires a manifest at
      // its root next to skills/.
      agent === 'copilot'
        ? `cat > "${COPILOT_PLUGIN_DIR}/plugin.json" <<'MANIFEST'\n${COPILOT_PLUGIN_MANIFEST}\nMANIFEST`
        : '',
      // Instructions: Claude reads AGENTS.md/CLAUDE.md, so mirror it if present. Codex
      // and Copilot both read AGENTS.md natively (Copilot's --no-custom-instructions
      // flag documents exactly that), so they only need CLAUDE.md gone.
      agent === 'claude' ? '[ -f AGENTS.md ] && cp AGENTS.md CLAUDE.md || true' : 'rm -f CLAUDE.md',
      'rm -rf .skills-src',
      `rm -rf ${otherRoots.map((root) => `"${root}"`).join(' ')}`,
    ]
      .filter(Boolean)
      .join('\n');
    const res = await sandbox.runCommand('sh', ['-c', script]);
    if (res.exitCode !== 0) throw new Error(`${agent} install setup failed: ${res.stderr}`);

    // Same rebuild as baseline(). Here it serves a second purpose: the staged skill is
    // created after the harness's baseline commit, so without this the skill counts as a file
    // the *agent* produced in `copyFiles: 'changed'`. Re-committing makes it part of the
    // baseline, leaving the captured diff to show only the agent's own work.
    const scrub = await sandbox.runCommand('sh', ['-c', SCRUB_GIT_HISTORY]);
    if (scrub.exitCode !== 0)
      throw new Error(`${agent} install setup: git history scrub failed: ${scrub.stderr}`);
  };
}
