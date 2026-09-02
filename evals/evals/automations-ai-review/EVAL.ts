import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';

// The agent is asked for an AI copy review that fires when an editor moves a post into a
// workflow stage. Each assertion encodes a claim from the uniform-automations skill:
//   - the work is a Uniform automation module, not app code the customer has to host
//   - Binding: content work binds to `workflow.transition`, never to a save event
//   - Filter: compares workflow/stage IDs, and stays total (a transition payload carries no
//     content type)
//   - Kind: judgement work goes through Scout, not a hand-rolled LLM call
//   - Identity: `permissions` is what gives the automation any authority at all

const WORKFLOW_ID = '3f6b0f9e-1c2a-4d5b-8e7f-9a0b1c2d3e4f';
const REVIEW_STAGE_ID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

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

// Comments are stripped before every content assertion. The skill's own prose ("bind to a stage
// rather than entry.changed") is exactly the kind of thing an agent quotes back in a comment, and
// failing a run for agreeing with us would measure nothing.
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

test('the review ships as a Uniform automation module', () => {
  expect(
    automationModules().map(({ f }) => f),
    'expected a `*.automation.ts` module: automations are authored in the repo and deployed with the Uniform CLI, and the filename is the automation\'s public ID. Hosting this as app code or a serverless route makes the customer operate infrastructure they asked not to'
  ).not.toEqual([]);
});

test('the module default-exports an automation definition', () => {
  expect(
    gradedText(),
    'an automation module default-exports the result of defineAutomation/defineScoutAutomation — that default export is the whole runtime contract Uniform invokes'
  ).toMatch(/export\s+default\s+define(Scout)?Automation\s*\(/);
});

test('depends on the automations SDK', () => {
  expect(
    deps()['@uniformdev/automations-sdk'],
    'expected @uniformdev/automations-sdk as a dependency — automations are defined with it'
  ).toBeDefined();
});

test('binds to the workflow stage transition, not a save event', () => {
  const types = declaredTypes();
  expect(
    types,
    'the trigger must be `workflow.transition`: work that happens TO content binds to a stage the automation owns, because a stage transition is a deliberate editorial action'
  ).toContain('workflow.transition');

  const saveEvents = types.filter((t) => /^(entry|composition)\.(changed|updated|saved|published)$/.test(t));
  expect(
    saveEvents,
    'AI on a save event burns credits on every keystroke-level save and mutates content the author is still editing. Bind the review to the AI Review stage instead'
  ).toEqual([]);
});

test('filters on workflow and stage IDs, and the filter stays total', () => {
  const filter = filters().join('\n');
  expect(
    filter,
    'expected a CEL `filter` on the trigger — every cheap predicate belongs there, because a filtered-out event creates no run at all, so it costs nothing and leaves no noise in run history'
  ).not.toEqual('');
  expect(filter, 'filter on `input.newStage.workflowId`').toContain('newStage.workflowId');
  expect(filter, 'filter on `input.newStage.stageId`').toContain('newStage.stageId');

  expect(
    filter,
    'filter on stage IDs, not stage names — names get edited and the automation silently stops firing'
  ).not.toMatch(/stageName|workflowName/);
  expect(
    filter,
    'a `workflow.transition` payload does not carry the content type, so `input.type` is an evaluation error, which records a `failure` run rather than dropping the event. Do the type check in the handler'
  ).not.toMatch(/input\.type\b/);

  // The IDs themselves live in constants (filters are strings built with a template literal), so
  // they are asserted against the module rather than against the filter expression. This is also
  // the check that catches a template copied over with its placeholder UUIDs left in.
  const text = gradedText();
  expect(text, `expected the project's workflow id (${WORKFLOW_ID})`).toContain(WORKFLOW_ID);
  expect(text, `expected the AI Review stage id (${REVIEW_STAGE_ID})`).toContain(REVIEW_STAGE_ID);
});

test('the judgement step runs on Uniform AI, not a hand-rolled LLM call', () => {
  const text = gradedText();
  const usesScout = /defineScoutAutomation\s*\(/.test(text) || /ScoutClient/.test(text);
  expect(
    usesScout,
    'the review is judgement-shaped work, so it belongs to Scout: either defineScoutAutomation (instructions, no code) or defineAutomation + ScoutClient when you want deterministic control around the AI step'
  ).toBe(true);

  const foreign = imports().filter((spec) =>
    /^(openai|@anthropic-ai\/|@google\/generative-ai|@mistralai\/)/.test(spec)
  );
  expect(
    foreign,
    'a third-party model SDK means a second vendor, a second key to store, and a bundle measured against the 1 MB ceiling — Uniform bills AI credits for Scout and the automation already carries an identity that can call it'
  ).toEqual([]);
  expect(
    text,
    'do not call a model provider HTTP API directly; invoke Scout'
  ).not.toMatch(/api\.(openai|anthropic)\.com/);
});

test('declares the permissions the automation runs with', () => {
  expect(
    gradedText(),
    'no `permissions` means no `uniformCredentials` and no Uniform API access at all — an automation that reads an entry and transitions a stage cannot work without a role'
  ).toMatch(/permissions\s*:/);
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
