import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';

// The agent is asked to receive product updates from a PIM and write them into Uniform. Each
// assertion encodes a claim from the uniform-automations skill:
//   - Kind: deterministic sync work belongs in a handler, not in Scout
//   - Triggers: an inbound call is an `incomingWebhook` trigger, not a server the customer runs
//   - Secrets are read as literal `process.env.UNIFORM_ENV_*`; a computed lookup reads undefined
//     at runtime because the deploy step inlines secrets by scanning the source
//   - Authenticity is checked in the handler, before the body is trusted, and a failed check is
//     the `unauthorized` outcome
//   - Writes go through a management client, which requires declared `permissions`

const read = (p: string) => readFileSync(p, 'utf-8');

function collect(dir = '.', exts = /\.(ts|tsx|js|mjs|json)$/): string[] {
  // Every agent's skill-discovery root is skipped, so an arm is never graded against the
  // guidance it was given. This matters more here than on any other fixture: uniform-automations
  // ships `templates/*.automation.ts`, which are real TypeScript automations. Grade those and
  // the with-skill arm passes every assertion without the agent writing a line.
  //
  // Keep in step with DISCOVERY_ROOT in experiments/lib/skill-install.ts.
  const skip = new Set([
    'node_modules',
    'dist',
    '.git',
    '.claude',
    '.agents',
    '.copilot-plugin',
    '.cursor',
    '.skills-src',
    '__agent_eval__',
  ]);
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = dir === '.' ? entry : `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...collect(full, exts));
    else if (exts.test(entry) && entry !== 'EVAL.ts') out.push(full);
  }
  return out;
}

// Comments are stripped before every content assertion. The skill's own prose ("read secrets as a
// literal process.env.UNIFORM_ENV_*") is exactly the kind of thing an agent quotes back in a
// comment, and failing a run for agreeing with us would measure nothing.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const files = () => collect().map((f) => ({ f, content: read(f) }));
const tsFiles = () =>
  files()
    .filter(({ f }) => /\.tsx?$/.test(f))
    .map(({ f, content }) => ({ f, content: stripComments(content) }));

/** Modules named the way the skill prescribes — the filename is the automation's public ID. */
const automationModules = () => tsFiles().filter(({ f }) => /\.automation\.tsx?$/.test(f));

/**
 * What to grade. Prefer correctly-named modules; fall back to whatever module defines an
 * automation, then to all source. Without the fallback a wrong filename would cascade into
 * every later assertion and report a skill gap that is really one missed convention.
 */
function graded(): { f: string; content: string }[] {
  const named = automationModules();
  if (named.length) return named;
  const defining = tsFiles().filter(({ content }) => /define(Scout)?Automation\s*\(/.test(content));
  return defining.length ? defining : tsFiles();
}

const gradedText = () =>
  graded()
    .map(({ content }) => content)
    .join('\n');

const deps = (): Record<string, string> =>
  files()
    .filter(({ f }) => f === 'package.json' || f.endsWith('/package.json'))
    .reduce<Record<string, string>>((acc, { content }) => {
      try {
        const pkg = JSON.parse(content);
        return { ...acc, ...pkg.dependencies, ...pkg.devDependencies };
      } catch {
        return acc;
      }
    }, {});

/** Values of every `type:` key — the trigger discriminants live here. */
const declaredTypes = () =>
  [...gradedText().matchAll(/type\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);

test('the sync ships as a Uniform automation module', () => {
  expect(
    automationModules().map(({ f }) => f),
    'expected a `*.automation.ts` module: automations are authored in the repo and deployed with the Uniform CLI, and the filename is the automation\'s public ID. An Express/Next route makes the customer operate the server they asked not to'
  ).not.toEqual([]);
  expect(
    deps()['@uniformdev/automations-sdk'],
    'expected @uniformdev/automations-sdk as a dependency — automations are defined with it'
  ).toBeDefined();
});

test('the PIM call arrives on an incomingWebhook trigger', () => {
  expect(
    declaredTypes(),
    'an inbound HTTP call from an external system is the `incomingWebhook` trigger, which gives the automation a URL and delivers `{ method, headers, query, rawBody }`'
  ).toContain('incomingWebhook');
});

test('deterministic sync work runs in a handler, not through Scout', () => {
  const text = gradedText();
  expect(
    text,
    'this job is deterministic — parse, look up, write — so it belongs in a handler: cheaper, testable and repeatable. Reach for Scout only where the task is genuinely judgement-shaped'
  ).toMatch(/export\s+default\s+defineAutomation\s*\(/);
  expect(
    text,
    'defineScoutAutomation runs an agent (and spends AI credits) on every product update, for work that has no judgement in it'
  ).not.toMatch(/defineScoutAutomation|ScoutClient/);
});

test('the shared secret is read as a literal UNIFORM_ENV_ variable', () => {
  const text = gradedText();
  expect(
    text,
    'project secrets reach the automation as `UNIFORM_ENV_`-prefixed environment variables, so the secret named PIM_WEBHOOK_SECRET is read as process.env.UNIFORM_ENV_PIM_WEBHOOK_SECRET'
  ).toContain('process.env.UNIFORM_ENV_');
  expect(
    text,
    'the deploy step inlines secrets by scanning the source for literal accesses, so a computed lookup like process.env[name] compiles, deploys, and reads undefined at runtime'
  ).not.toMatch(/process\.env\s*\[/);
});

test('a failed secret check returns the unauthorized outcome', () => {
  expect(
    gradedText(),
    "a request that fails the shared-secret check is `{ outcome: 'unauthorized' }` — the outcome is what run history shows, and swallowing it as success or failure hides an attempt from whoever is looking"
  ).toMatch(/outcome\s*:\s*['"`]unauthorized['"`]/);
});

test('authenticity is checked before the body is trusted', () => {
  const module = graded().find(({ content }) => /outcome\s*:\s*['"`]unauthorized['"`]/.test(content));
  if (!module) return; // already reported by the assertion above
  const authAt = module.content.search(/outcome\s*:\s*['"`]unauthorized['"`]/);
  const parseAt = module.content.search(/JSON\.parse\s*\(/);
  if (parseAt === -1) return; // rawBody consumed some other way; nothing to order
  expect(
    authAt,
    `${module.f}: verify the request before parsing rawBody, never after — the signature is over the exact bytes received, and parsing an unverified body is work done on behalf of an unauthenticated caller`
  ).toBeLessThan(parseAt);
});

test('writes go through a management client with declared permissions', () => {
  const text = gradedText();
  expect(
    deps()['@uniformdev/canvas'],
    'expected @uniformdev/canvas as a dependency — automations call the Uniform APIs through the SDK clients'
  ).toBeDefined();
  expect(
    text,
    'write entries with EntryManagementClient. Delivery-shaped content has patterns and data resources resolved, so saving it back unlinks patterns and destroys data resource definitions'
  ).toMatch(/EntryManagementClient/);
  expect(
    text,
    'no `permissions` means no `uniformCredentials` and no Uniform API access at all, so an automation that writes entries cannot work without a role'
  ).toMatch(/permissions\s*:/);
});

test('the secret value never reaches the logs', () => {
  // Naming the variable in a log is correct and encouraged ("UNIFORM_ENV_PIM_WEBHOOK_SECRET is
  // not configured"); interpolating its value is not. Only the latter is failed here.
  const offenders = graded()
    .flatMap(({ f, content }) =>
      content
        .split('\n')
        .map((text, i) => ({ where: `${f}:${i + 1}`, text: text.trim() }))
        .filter(({ text }) => /\blog\.\w+\s*\(/.test(text))
        .filter(({ text }) =>
          /\$\{[^}]*(process\.env\.UNIFORM_ENV_|secret|token|signature)[^}]*\}/i.test(text)
        )
    )
    .map(({ where, text }) => `${where}  ${text}`);
  expect(
    offenders,
    'run logs are unredacted, readable by anyone with the Manage Automations permission, and retained for 7 days — log the operation and the entity id, never a secret or a whole payload that might carry one'
  ).toEqual([]);
});

test('did not deploy to the live project', () => {
  // o11y is written by the harness before these tests run; treat it as optional so a harness
  // change degrades to "unasserted" rather than taking the whole file down with it (an EVAL.ts
  // that throws is reported as ungraded, which measures nothing at all).
  if (!existsSync('__agent_eval__/results.json')) return;
  const { o11y } = JSON.parse(read('__agent_eval__/results.json'));
  const commands: string[] = (o11y?.shellCommands ?? []).map((c: { command: string }) => c.command);
  expect(
    commands.filter((c) => /uniform\s+automation\s+(deploy|delete)/.test(c)),
    'deploying changes a live project, so it is the user\'s call — the automation should be left ready with a note that `npx uniform automation deploy` publishes it'
  ).toEqual([]);
});
