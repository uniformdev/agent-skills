import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

const read = (p: string) => readFileSync(p, 'utf-8');

const EXISTING_FILES = new Set([
  'components/Hero.tsx',
  'components/Page.tsx',
  'components/DefaultNotFound.tsx',
  'components/resolveComponent.ts',
]);

function sourceFiles (dir = '.'): string[] {
  const skip = new Set(['node_modules', '.next', '.git', '.claude', '.agents', '__agent_eval__']);
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = dir === '.' ? entry : `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && entry !== 'EVAL.ts') out.push(full);
  }
  return out;
}

const files = () => sourceFiles().map((f) => ({ f, content: read(f) }));
const newFiles = () => files().filter(({ f }) => !EXISTING_FILES.has(f));
const findApiRoute = () => newFiles().find(({ f }) => /^app\/api\/.*route\.tsx?$/.test(f));

test('new form fields are separate components, not one monolithic form', () => {
  const controlFiles = newFiles().filter(
    ({ f, content }) => f.startsWith('components/') && /<(input|select|textarea)/i.test(content)
  );
  expect(
    controlFiles.length,
    'expected at least 2 new component files rendering form controls (a container plus separate field components) — a Uniform form is a composition of components, not one file with every input hardcoded'
  ).toBeGreaterThanOrEqual(2);
});

test('new component types are registered in resolveComponent', () => {
  const resolver = read('components/resolveComponent.ts');
  const quoted = new Set((resolver.match(/["'`](\w+)["'`]/g) ?? []).map((s) => s.slice(1, -1)));
  const newTypes = [...quoted].filter((t) => t !== 'page' && t !== 'hero');
  expect(
    newTypes.length,
    'resolveComponent must map at least one new component.type for the form (page/hero are the only two before this task)'
  ).toBeGreaterThan(0);
});

test('submission posts to a single API route', () => {
  expect(findApiRoute(), 'expected a submissions API route under app/api/**/route.ts').toBeDefined();
});

test('payload namespaces field data under `fields`, with a label per field', () => {
  const route = findApiRoute()!;
  const clientFiles = newFiles().filter(({ f }) => f.startsWith('components/'));
  const combined = [route, ...clientFiles].map(({ content }) => content).join('\n');
  expect(
    combined,
    "the payload must carry the skill's contract key `formIdentifier` so the backend can route submissions (see the payload contract in SKILL.md)"
  ).toMatch(/formIdentifier/);
  // `fields` as a payload key (`fields:`), shorthand property (`{ formIdentifier, fields }`),
  // or property access on the server (`body.fields`) — a bare /fields/ would false-pass on
  // e.g. a state variable named `fields`.
  expect(
    combined,
    "field values must be namespaced under a `fields` key (see submission.md) so a field named e.g. \"type\" cannot collide with the payload's own metadata"
  ).toMatch(/\.fields\b|\bfields\s*:|[{,]\s*fields\s*[,}]/);
  // `label` as an object key, not bare /label/ — every form has <label> elements in JSX,
  // which is not what this assertion is about.
  expect(
    combined,
    "each field entry should carry a human-readable `label` key alongside its value, so a generic handler can render output without knowing the form's shape"
  ).toMatch(/\blabel\s*:/);
});

test('the API route reads fields generically, not as a hardcoded list', () => {
  const route = findApiRoute()!;
  expect(
    route.content,
    'the handler must iterate the submitted fields (Object.entries/Object.keys/for..in over `fields`) rather than only destructuring specific named fields — Canvas authors can add fields with no deploy, and a hardcoded list silently drops them'
  ).toMatch(/Object\.(entries|keys|values)\(|for\s*\(\s*(const|let)\s+\w+\s+in\s+/);
});

test('the API route re-validates required fields server-side', () => {
  const route = findApiRoute()!;
  expect(
    route.content,
    "client-side `required` is a UX hint only and is trivial to bypass — the route must re-check required fields itself"
  ).toMatch(/required/i);
});

test('no alert()/confirm() for submit feedback', () => {
  const newComponentFiles = newFiles().filter(({ f }) => f.startsWith('components/'));
  for (const { f, content } of newComponentFiles) {
    expect(
      content,
      `${f} must not use alert()/confirm() for submit result UX — render state in the page instead`
    ).not.toMatch(/\b(alert|confirm)\(/);
  }
});

test('submit state is rendered with aria-live', () => {
  const newComponentFiles = newFiles().filter(({ f }) => f.startsWith('components/'));
  expect(
    newComponentFiles.some(({ content }) => /aria-live/.test(content)),
    'the submit result (success/error) should be announced via aria-live, not a silent DOM change'
  ).toBe(true);
});

test('existing integration is not damaged', () => {
  const resolver = read('components/resolveComponent.ts');
  expect(resolver).toMatch(/['"`]hero['"`]/);
  expect(resolver).toMatch(/['"`]page['"`]/);
  const middleware = read('middleware.ts');
  expect(middleware, 'middleware must keep the edge runtime').toContain('experimental-edge');
  expect(read('app/layout.tsx')).not.toContain('UniformContext');
});

test('fields self-register through shared state, not slot introspection', async () => {
  await expect(environment).toSatisfyCriterion(`
    The new form field components (email field, checkbox field) are independent,
    reusable components that can be used to build up a generic form according to
    an author's need. An author should be able to add a new field type to
    this form in the future without changing the container component.
  `);
});
