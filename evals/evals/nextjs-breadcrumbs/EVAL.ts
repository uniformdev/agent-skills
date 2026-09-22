import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// The agent adds breadcrumbs to a Next.js App Router project that has none. The prompt
// describes the *site* — pages organised by editors, levels that are not pages, URLs that
// vary — and names no API, package, component type or technique, because the cheapest thing
// a cold agent can do is split the request path, and that is precisely what the
// uniform-breadcrumbs skill exists to prevent.
//
// Assertions are deliberately NAME-INDEPENDENT: the prompt does not dictate a component type
// name or a file name, so an agent that picks its own reasonable names must not be failed for
// it. What is asserted is the mechanism behind each claim in the skill:
//   - the trail is read from the project map node tree (getNodes + includeAncestors) …
//   - … keyed on the matched route, not on the resolved URL
//   - dynamic ancestor paths go through the SDK's own template engine
//   - nodes with no page behind them are not turned into links
//   - landmark + ordered-list + aria-current semantics
//   - BreadcrumbList JSON-LD
//   - the existing project's mappings, config and dependencies survive
// Trail semantics that regex cannot see are left to the single judge criterion.

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

const deps = (): Record<string, string> => {
  const pkgs = files().filter(({ f }) => f === 'package.json' || f.endsWith('/package.json'));
  return pkgs.reduce<Record<string, string>>((acc, { content }) => {
    try {
      const p = JSON.parse(content);
      return { ...acc, ...p.dependencies, ...p.devDependencies };
    } catch {
      return acc;
    }
  }, {});
};

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

test('the trail is read from the project map, not invented from the URL', () => {
  const src = code();
  expect(
    src,
    'the ancestors must come from the project map node tree via ProjectMapClient.getNodes — a ' +
      'trail built by splitting the request path loses node names, dynamic segments, ' +
      'non-navigable levels and locale segments, and goes stale the moment an editor moves a page'
  ).toContain('getNodes');
  expect(
    src,
    'getNodes must be called with includeAncestors — fetching the current node alone yields no trail'
  ).toContain('includeAncestors');
});

test('the current node is identified by the route that matched, not the resolved URL', () => {
  expect(
    code(),
    'the unresolved node path comes from the matched route (context.matchedRoute, or ' +
      'composition.projectMapNodes) — the resolved request path cannot be looked up against a ' +
      'dynamic node such as /products/:category'
  ).toMatch(/matchedRoute|projectMapNodes/);
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

test('nodes with no page behind them are not turned into links', () => {
  const src = code();
  const guards =
    /(===|!==)\s*['"]placeholder['"]/.test(src) ||
    /['"]placeholder['"]\s*(===|!==)/.test(src) ||
    /(===|!==)\s*['"]composition['"]/.test(src) ||
    /compositionId/.test(src);
  expect(
    guards,
    'a project map node can be a grouping level with no composition attached (type ' +
      '"placeholder"); linking one ships a 404 into the trail. Guard on the node type or on ' +
      'the presence of a composition id before emitting an href'
  ).toBe(true);
});

// Modules that build the trail — the ones that talk to the project map or are named for the
// job. Negative assertions are scoped to them so a stray word elsewhere cannot fail a run.
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

test('titles are not read from project map composition metadata', () => {
  for (const { f, content } of breadcrumbModules()) {
    expect(
      content,
      `${f}: withCompositionData returns identity and status metadata for the project map UI, ` +
        'never resolved content — no parameters, no dynamic input resolution, no data resources. ' +
        'A crumb titled from compositionData.name is the composition\'s authoring name, ' +
        'identical for every value of a dynamic segment'
    ).not.toMatch(/withCompositionData|compositionData/);
  }
});

test('ancestor compositions are not fetched whole', () => {
  for (const { f, content } of breadcrumbModules()) {
    expect(
      content,
      `${f}: getCompositionById takes no dynamic inputs and no release, so a title bound to a ` +
        'dynamic input comes back as its raw ${...} expression, and the payload is the whole ' +
        'tree. Use RouteClient.get on the expanded path with a projection instead'
    ).not.toMatch(/getCompositionById/);
  }
});

test('release context is forwarded to the title lookup', () => {
  expect(
    breadcrumbModules().map(({ content }) => content).join('\n'),
    'pass releaseId through to RouteClient.get — without it an editor previewing a release ' +
      'sees base titles in the trail while the page itself shows the release'
  ).toMatch(/releaseId/);
});

test('the deprecated route method is not used', () => {
  expect(
    code(),
    'RouteClient.getRoute is deprecated in favour of RouteClient.get — same signature and the ' +
      'same `select` projection, renamed in @uniformdev/canvas 20.74.7'
  ).not.toMatch(/\.getRoute\s*\(/);
});

test('markup uses breadcrumb landmark and ordered-list semantics', () => {
  const src = code();
  expect(src, 'the trail must be wrapped in <nav aria-label="..."> so the landmark is distinguishable').toMatch(
    /<nav[^>]*aria-label/s
  );
  expect(src, 'the trail must be an ordered list — the order is the meaning').toMatch(/<ol[\s>]/);
  expect(
    src,
    'the page the visitor is on must be marked with aria-current="page"'
  ).toMatch(/aria-current/);
});

test('BreadcrumbList structured data is emitted', () => {
  const src = code();
  expect(src, 'search engines read breadcrumbs from schema.org BreadcrumbList JSON-LD').toContain(
    'BreadcrumbList'
  );
  expect(src, 'each crumb needs a 1-based position inside an itemListElement array').toContain(
    'itemListElement'
  );
  expect(src, 'JSON-LD must be emitted in a script tag typed application/ld+json').toContain(
    'application/ld+json'
  );
});

// Mirrors "keep the existing components working". Also self-protection: an agent that
// rewrites package.json without vitest breaks the harness, which then reports 0% while
// measuring nothing at all.
test('extends the existing project instead of replacing its config', () => {
  const installed = deps();
  for (const pkg of ['vitest', 'typescript', '@types/node', '@types/react', '@types/react-dom']) {
    expect(
      installed[pkg],
      `${pkg} was already in this project's devDependencies — add to the existing package.json, never drop entries you did not add`
    ).toBeDefined();
  }
  expect(
    installed['@uniformdev/next-app-router'],
    'the project already depends on @uniformdev/next-app-router'
  ).toBeDefined();
  const middleware = read('middleware.ts');
  expect(middleware, 'middleware must keep the edge runtime').toContain('experimental-edge');
  expect(
    read('app/layout.tsx'),
    'UniformContext is set up by UniformComposition and must not be added to the layout'
  ).not.toContain('UniformContext');
});

test('the trail is correct, safe, and built on the server', async () => {
  await expect(environment).toSatisfyCriterion(
    'This is a breadcrumbs component for a Uniform CMS site in a Next.js App Router project, ' +
      'built from the project map node hierarchy. Verify that: ' +
      '(1) the crumbs are the current page\'s ancestors in node order from the root down, ' +
      'filtered to that ancestor chain — not siblings, not descendants, and not derived from ' +
      'segments of the request URL; ' +
      '(2) an ancestor whose path template still contains an unresolved ":token" after ' +
      'expansion is rendered as text rather than as a link, so no href like ' +
      '"/products/:category" can ever reach the page; ' +
      '(3) the last crumb represents the current page and is not a link; ' +
      '(4) the project map is only ever read on the server — no "use client" on any module ' +
      'that constructs a Uniform client or reads UNIFORM_API_KEY, and no client-side fetch of ' +
      'project map nodes; ' +
      '(5) a trail that cannot be built — no project map context, an API failure, or a single ' +
      'crumb because the page is at or just below the root — results in nothing being ' +
      'rendered, rather than a thrown error or a placeholder message in production markup; and ' +
      '(6) the title of each linked ancestor is read from a Route API call (RouteClient.get) ' +
      'made with that ancestor\'s expanded, concrete path and a `select` projection limited to ' +
      'the title parameter, with the project map node name used only as a fallback — not from ' +
      'project map compositionData, not from getCompositionById, and not fetched at all for the ' +
      'current page, whose title is already being rendered.'
  );
});
