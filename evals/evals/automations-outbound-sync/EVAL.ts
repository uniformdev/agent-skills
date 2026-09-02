import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';

// The agent is asked to push published product entries to an external search index. Each
// assertion encodes a claim from the uniform-automations skill:
//   - Kind: deterministic outbound work belongs in a handler, not in Scout
//   - Binding: outbound-on-publish binds to `entry.published`, not a workflow stage and not a save
//   - Filter: cheap type check is CEL on the trigger (`==`, not JS `===`); `entry.published`
//     carries `input.type`, unlike `workflow.transition`
//   - Secrets are read as literal `process.env.UNIFORM_ENV_*`; the call itself is `fetch`, not a
//     search-vendor SDK that has to fit the 1 MB bundle ceiling
//   - Deploying changes a live project, so it is left to the user

const SEARCH_URL = 'https://search.internal.example.com/indexes/products';

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

// Comments are stripped before every content assertion. The skill's own prose ("bind outbound
// work to entry.published, not a stage") is exactly the kind of thing an agent quotes back in a
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

/** Module specifiers actually imported, so a package named in prose can't trip a negative check. */
const imports = () =>
  [...gradedText().matchAll(/(?:from\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);

/** The CEL filter expressions, whether written as a plain string or a template literal. */
const filters = () =>
  [...gradedText().matchAll(/filter\s*:\s*(`[^`]*`|'[^']*'|"[^"]*")/g)].map((m) => m[1]);

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

test('binds to entry.published, not a stage, a save, or an inbound webhook', () => {
  const types = declaredTypes();
  expect(
    types,
    'an outbound push when content goes live binds to `entry.published` — that event is the deliberate publish, and it is the skill\'s shape for Uniform → another system'
  ).toContain('entry.published');

  expect(
    types.filter((t) => t === 'workflow.transition'),
    'a workflow stage is the binding for work that happens TO content (review, translate, enrich). Pushing a published product downstream is not that job, and inventing an editorial stage for it makes publish a two-step process the prompt said not to'
  ).toEqual([]);

  const saveEvents = types.filter((t) => /^(entry|composition)\.(changed|updated|saved)$/.test(t));
  expect(
    saveEvents,
    'a save is not a publish. Binding outbound sync to `entry.changed` pushes drafts the author is still editing'
  ).toEqual([]);

  expect(
    types.filter((t) => t === 'incomingWebhook'),
    '`incomingWebhook` is the other direction: an external system calling Uniform. This job is Uniform calling out on publish'
  ).toEqual([]);
});

test('deterministic outbound work runs in a handler, not through Scout', () => {
  const text = gradedText();
  expect(
    text,
    'this job is deterministic — read the published payload, POST it — so it belongs in a handler: cheaper, testable and repeatable. Reach for Scout only where the task is genuinely judgement-shaped'
  ).toMatch(/export\s+default\s+defineAutomation\s*\(/);
  expect(
    text,
    'defineScoutAutomation runs an agent (and spends AI credits) on every publish, for work that has no judgement in it'
  ).not.toMatch(/defineScoutAutomation|ScoutClient/);
});

test('the type check is a CEL filter on the trigger, not JavaScript', () => {
  const filter = filters().join('\n');
  expect(
    filter,
    'expected a CEL `filter` on the trigger — every cheap predicate belongs there, because a filtered-out event creates no run at all, so it costs nothing and leaves no noise in run history'
  ).not.toEqual('');
  expect(
    filter,
    '`entry.published` carries the content type, so `input.type == "product"` is a total filter and the right place for "only products"'
  ).toMatch(/input\.type/);

  // The type id lives in a constant (filters are strings built with a template literal), so it is
  // asserted against the module rather than against the filter expression.
  expect(gradedText(), 'filter on the `product` content type id from the prompt').toContain('product');

  expect(
    filter,
    'CEL compares with `==`, not `===` — a JavaScript triple-equals is a deploy-time syntax error, and the run never starts'
  ).not.toMatch(/===/);
  expect(
    filter,
    'CEL is not JavaScript: `.includes(` / `.match(` are evaluation errors, which record a `failure` run rather than dropping the event'
  ).not.toMatch(/\.includes\s*\(|\.match\s*\(/);
});

test('the search service is called with fetch, not a vendor SDK', () => {
  const text = gradedText();
  expect(
    text,
    `expected a fetch to ${SEARCH_URL} — the runtime already has fetch, and the 1 MB bundle ceiling is why the skill reaches for it instead of a search-vendor SDK`
  ).toMatch(/fetch\s*\(/);
  expect(text, `expected the search service URL from the prompt (${SEARCH_URL})`).toContain(SEARCH_URL);

  const foreign = imports().filter((spec) =>
    /^(algoliasearch|@algolia\/|@elastic\/elasticsearch|meilisearch|typesense)/.test(spec)
  );
  expect(
    foreign,
    'a search-vendor SDK is a second package measured against the 1 MB ceiling, for a single POST the runtime can already make'
  ).toEqual([]);
});

test('the API key is read as a literal UNIFORM_ENV_ variable', () => {
  const text = gradedText();
  expect(
    text,
    'project secrets reach the automation as `UNIFORM_ENV_`-prefixed environment variables, so the secret named SEARCH_API_KEY is read as process.env.UNIFORM_ENV_SEARCH_API_KEY'
  ).toContain('process.env.UNIFORM_ENV_SEARCH_API_KEY');
  expect(
    text,
    'the deploy step inlines secrets by scanning the source for literal accesses, so a computed lookup like process.env[name] compiles, deploys, and reads undefined at runtime'
  ).not.toMatch(/process\.env\s*\[/);
});

test('the secret value never reaches the logs', () => {
  // Naming the variable in a log is correct and encouraged ("UNIFORM_ENV_SEARCH_API_KEY is
  // not configured"); interpolating its value is not. Only the latter is failed here.
  const offenders = graded()
    .flatMap(({ f, content }) =>
      content
        .split('\n')
        .map((text, i) => ({ where: `${f}:${i + 1}`, text: text.trim() }))
        .filter(({ text }) => /\blog\.\w+\s*\(/.test(text))
        .filter(({ text }) =>
          /\$\{[^}]*(process\.env\.UNIFORM_ENV_|secret|token|apiKey|api_key)[^}]*\}/i.test(text)
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
