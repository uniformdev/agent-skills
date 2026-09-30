import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// The Page Router twin of `nextjs-breadcrumbs`. Same PROMPT.md, byte for byte — the prompt
// names no API, package or routing concept, so it ports without a word changing. What differs
// is the fixture (canvas-next + canvas-react, getServerSideProps, registerUniformComponent)
// and the registration check below. There is no Suspense check: the Page Router has no
// boundary to stream behind.
//
// That pairing is the point: `uniform-breadcrumbs` claims to be framework-neutral, and this
// fixture tests the claim instead of trusting it. As in the App Router suite, only checks that
// fail without the skill are kept.
//
// Assertions stay NAME-INDEPENDENT — the prompt dictates no component type or file name.

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

// Comments are stripped before every pattern match: an agent that quotes the requirement in a
// comment must not pass on the strength of the comment, nor fail for agreeing with us.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = () => sourceFiles().map(({ content }) => stripComments(content)).join('\n');

// Page Router registers components into a store rather than mapping them in a resolver
// function, so the types are collected from the registerUniformComponent calls themselves.
const registeredTypes = (): string[] => {
  const found = new Set<string>();
  for (const { content } of sourceFiles()) {
    const src = stripComments(content);
    // registerUniformComponent({ type: "hero", component: Hero })  — property order varies,
    // and some projects register several components from one module.
    for (const m of src.matchAll(/registerUniformComponent\s*\(\s*\{[^}]*?type\s*:\s*['"]([^'"]+)['"]/gs)) {
      found.add(m[1]);
    }
  }
  return [...found];
};

test('a new component type is registered without disturbing the existing one', () => {
  const types = registeredTypes();
  expect(
    types,
    '"page" was already registered in components/Page.tsx — extend the registrations, do not replace them'
  ).toContain('page');
  expect(
    types.filter((t) => t !== 'page'),
    'the breadcrumbs component must be registered with registerUniformComponent so a composition can place it'
  ).not.toEqual([]);
});

test('dynamic ancestor paths are expanded with the SDK path-template engine', () => {
  const src = code();
  expect(
    src,
    "dynamic segments must be filled from the request's dynamic input values before an " +
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

test('the trail is correct, safe, and built on the server', async () => {
  await expect(environment).toSatisfyCriterion(
    'This is a breadcrumbs component for a Uniform CMS site in a Next.js **Page Router** ' +
      'project (@uniformdev/canvas-next + @uniformdev/canvas-react, components registered with ' +
      'registerUniformComponent), built from the project map node hierarchy. Verify that: ' +
      "(1) the crumbs are the current page's ancestors in node order from the root down — " +
      'not siblings, not descendants, and not derived from segments of the request URL; ' +
      "(2) every linked ancestor's href is its path template expanded with the current " +
      "request's dynamic input values, so no href like \"/products/:category\" can ever " +
      'reach the page; ' +
      '(3) the last crumb represents the current page and is not a link; ' +
      '(4) the project map is only ever read on the server — the trail is built in ' +
      'getServerSideProps (or getStaticProps) and passed down as props, and no module that ' +
      'runs in the browser constructs a Uniform client or reads UNIFORM_API_KEY; ' +
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
