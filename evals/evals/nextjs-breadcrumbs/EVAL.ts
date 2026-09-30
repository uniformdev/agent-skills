import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// The agent adds breadcrumbs to a Next.js App Router project that has none. The prompt
// describes the *site* — pages organised by editors, levels that are not pages, URLs that
// vary — and names no API, package, component type or technique.
//
// Only checks that fail without the uniform-breadcrumbs skill are kept, so each one is a gap
// the skill closes. What an agent gets right unaided — reading the tree with getNodes,
// breadcrumb markup, leaving the existing project intact — is not asserted.
//
// Assertions are deliberately NAME-INDEPENDENT: the prompt does not dictate a component type
// name or a file name, so an agent that picks its own reasonable names must not be failed for
// it. Trail semantics that regex cannot see are left to the single judge criterion.

const read = (p: string) => readFileSync(p, 'utf-8');

function collect(dir = '.', exts = /\.(ts|tsx|js|jsx|json)$/): string[] {
  const skip = new Set([
    'node_modules', '.next', '.git', '.claude', '.agents', '.skills-src', '__agent_eval__',
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

const files = () => collect().map((f) => ({ f, content: read(f) }));
const sourceFiles = () => files().filter(({ f }) => /\.(ts|tsx|js|jsx)$/.test(f));

// Comments are stripped before every pattern match: an agent that quotes the requirement
// ("read the ancestors from the project map") in a comment must not pass a test on the
// strength of the comment, and must not fail one for agreeing with us.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = () => sourceFiles().map(({ content }) => stripComments(content)).join('\n');

// Component types mapped in the resolver, collected as string literals rather than by name:
// the prompt never dictates what the breadcrumbs component type is called.
const resolverTypes = (): string[] => {
  const resolvers = sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .filter(({ content }) => /ResolveComponentFunction|resolveComponent/.test(content));
  const found = new Set<string>();
  for (const { content } of resolvers) {
    for (const m of content.matchAll(/type\s*===\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
    for (const m of content.matchAll(/^\s*['"]([A-Za-z][A-Za-z0-9_-]{2,40})['"]\s*:/gm)) {
      found.add(m[1]);
    }
  }
  return [...found];
};

test('a new component type is registered without disturbing the existing one', () => {
  const types = resolverTypes();
  expect(
    types,
    '"page" was already mapped in components/resolveComponent.ts — extend the resolver, do not replace it'
  ).toContain('page');
  expect(
    types.filter((t) => t !== 'page'),
    'the breadcrumbs component must be registered in the resolver so a composition can place it'
  ).not.toEqual([]);
});

test('dynamic ancestor paths are expanded with the SDK path-template engine', () => {
  const src = code();
  expect(
    src,
    'dynamic segments must be filled from the request\'s dynamic input values before an ' +
      'ancestor node path can become an href'
  ).toMatch(/dynamicInputs|dynamicInputValues/);
  expect(
    src,
    'expand ancestor path templates with Route from @uniformdev/project-map — it is the same ' +
      'engine route matching uses, and it URL-encodes values that a hand-rolled replace does not'
  ).toMatch(/\.expand\s*\(/);
});

// Modules that build the trail — the ones that talk to the project map or are named for the
// job. Assertions about the trail's inputs are scoped to them so a stray word elsewhere cannot
// pass a run.
const breadcrumbModules = () =>
  sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .filter(({ content }) => /getNodes|[Bb]readcrumb/.test(content));

test('crumb titles are resolved through the Route API with a projection', () => {
  const src = code();
  expect(
    src,
    'each linked ancestor\'s title must come from RouteClient.get on its expanded path — the ' +
      'Route API is the only read that resolves locale, editions, dynamic inputs and data-bound ' +
      'parameters; the project map client returns node metadata, not content'
  ).toMatch(/getRouteClient|RouteClient/);
  expect(
    src,
    'the Route API call must carry a `select` projection so the response is the title ' +
      'parameter and no slots, not the whole composition tree per crumb'
  ).toMatch(/select\s*:\s*\{/);
  expect(
    src,
    'the projection must name the title field with `fields: { only: [...] }` — an unprojected ' +
      'route response is several kilobytes per ancestor'
  ).toMatch(/only\s*:/);
});

// The page component definition shipped with the fixture names its own title parameter, and
// it is deliberately neither `title` nor `pageTitle`: the skill says to read `titleParameter`
// off the definition rather than guess, and a guessed field id is a silent no-op — the
// projection returns nothing and every crumb quietly falls back to its node name.
const titleParameter = (): string => {
  const definition = read('uniform-data/component/page.yaml');
  const match = /^titleParameter:\s*(\S+)\s*$/m.exec(definition);
  if (!match) throw new Error('fixture lost uniform-data/component/page.yaml titleParameter');
  return match[1];
};

test('the projected title field is read from the component definition, not guessed', () => {
  const field = titleParameter();
  // Matched as a quoted literal anywhere in the trail modules, not inside the `only: [...]`
  // array: the field id is an input to the trail, so it legitimately reaches the projection
  // through a constant or an option rather than as a literal at the call site.
  expect(
    breadcrumbModules().map(({ content }) => content).join('\n'),
    `the projected title field must be the page component definition's titleParameter ` +
      `("${field}", in uniform-data/) — a guessed id is accepted by the API and matches ` +
      'nothing, so every crumb silently falls back to its node name with no error anywhere'
  ).toMatch(new RegExp(`['"\`]${field}['"\`]`));
});

test('release context is forwarded to the title lookup', () => {
  expect(
    breadcrumbModules().map(({ content }) => content).join('\n'),
    'pass releaseId through to RouteClient.get — without it an editor previewing a release ' +
      'sees base titles in the trail while the page itself shows the release'
  ).toMatch(/releaseId/);
});

// App Router only — the Page Router twin has no streaming escape hatch, so its copy of this
// suite deliberately does not assert this.
test('the trail does not block the page render', () => {
  const src = code();
  // Either mechanism is correct: the SDK's per-component boundary, declared on the
  // resolveComponent result, or a React <Suspense> the component renders around its own
  // async work. What is asserted is that a boundary exists at all.
  const viaResolver = /suspense\s*:/.test(src);
  const viaReact = /<Suspense[\s/>]/.test(src);
  expect(
    viaResolver || viaReact,
    'the trail awaits a project map call plus one route call per ancestor before it can ' +
      'render, and an author can place it on any page — without a Suspense boundary the whole ' +
      'page waits for it. Declare one on the resolveComponent result (`suspense: { fallback }`) ' +
      'or wrap the async work in <Suspense>'
  ).toBe(true);
  // A hand-rolled <Suspense fallback={<X/>}/> is correct JSX; only the resolver form is checked.
  if (viaResolver) {
    expect(
      src,
      'on the resolveComponent result the SDK calls createElement() on `fallback`, so it must be ' +
        'a component reference — `fallback: BreadcrumbsFallback`, never `fallback: <BreadcrumbsFallback />`'
    ).not.toMatch(/fallback\s*:\s*</);
  }
});

test('the trail is correct, safe, and built on the server', async () => {
  await expect(environment).toSatisfyCriterion(
    'This is a breadcrumbs component for a Uniform CMS site in a Next.js App Router project, ' +
      'built from the project map node hierarchy. Verify that: ' +
      '(1) the crumbs are the current page\'s ancestors in node order from the root down — ' +
      'not siblings, not descendants, and not derived from segments of the request URL; ' +
      "(2) every linked ancestor's href is its path template expanded with the current " +
      "request's dynamic input values, so no href like \"/products/:category\" can ever " +
      'reach the page; ' +
      '(3) the last crumb represents the current page and is not a link; ' +
      '(4) the project map is only ever read on the server — no "use client" on any module ' +
      'that constructs a Uniform client or reads UNIFORM_API_KEY, and no client-side fetch of ' +
      'project map nodes; ' +
      '(5) a trail that cannot be built — an API failure, or a single crumb because the page ' +
      'is at or just below the root — results in nothing being ' +
      'rendered, rather than a thrown error or a placeholder message in production markup; and ' +
      '(6) the title of each linked ancestor is read from a Route API call (RouteClient.get) ' +
      'made with that ancestor\'s expanded, concrete path and a `select` projection limited to ' +
      'the title parameter, with the project map node name used only as a fallback — not from ' +
      'project map compositionData, not from getCompositionById, and not fetched at all for the ' +
      'current page, whose title is already being rendered.'
  );
});
