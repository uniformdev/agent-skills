import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// The Page Router twin of `nextjs-breadcrumbs`. Same PROMPT.md, byte for byte — the prompt
// names no API, package or routing concept, so it ports without a word changing. What differs
// is the fixture (canvas-next + canvas-react, getServerSideProps, registerUniformComponent)
// and the handful of assertions below that are SDK-specific.
//
// That pairing is the point: `uniform-breadcrumbs` claims to be framework-neutral and makes
// concrete Page Router claims (matchedRoute and dynamicInputs arrive as page props from the
// route handler). This fixture is what tests the claim instead of trusting it.
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

// Files the agent created or edited, from the harness's transcript summary. Two of the
// assertions below would otherwise be free points: this fixture's own starter route already
// contains `matchedRoute` and `getServerSideProps`, so a project-wide grep for either passes
// before the agent has written a line. Scoping to touched files is what makes them measure
// anything. Falls back to the whole project when the transcript is unavailable (offline
// validation), where the same assertions are weaker but never wrongly failing.
const touchedSourceFiles = (): { f: string; content: string }[] => {
  try {
    const { o11y } = JSON.parse(read('__agent_eval__/results.json'));
    const touched = new Set(
      (o11y.filesModified ?? []).map((p: string) => p.replace(/^.*\/workspace\//, ''))
    );
    const scoped = sourceFiles().filter(({ f }) => touched.has(f));
    if (scoped.length) return scoped;
  } catch {
    /* no transcript — fall through */
  }
  return sourceFiles();
};

const touchedCode = () =>
  touchedSourceFiles().map(({ content }) => stripComments(content)).join('\n');

// Comments are stripped before every pattern match: an agent that quotes the requirement in a
// comment must not pass on the strength of the comment, nor fail for agreeing with us.
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

// Files that register a component. Registration only happens as a side effect of the module
// being imported, so a module nothing imports is dead code that renders as "not implemented".
const registrationFiles = (): string[] =>
  sourceFiles()
    .filter(({ content }) => /registerUniformComponent/.test(stripComments(content)))
    .map(({ f }) => f);

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

test('every registered component module is actually imported', () => {
  const others = sourceFiles();
  for (const file of registrationFiles()) {
    const base = file.split('/').pop()!.replace(/\.(ts|tsx|js|jsx)$/, '');
    // Name-independent and deliberately lenient: any other module referencing this one counts.
    // A false pass beats failing an agent that chose its own barrel layout.
    const imported = others.some(
      ({ f, content }) => f !== file && new RegExp(`['"\`][^'"\`]*${base}['"\`]`).test(content)
    );
    expect(
      imported,
      `${file} calls registerUniformComponent but nothing imports it — registration is a module ` +
        `side effect, so an unimported component is never registered and renders as not implemented. ` +
        `Add it to the barrel file (components/uniformComponents.ts) that pages/_app.tsx imports`
    ).toBe(true);
  }
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
    touchedCode(),
    'the unresolved node path comes from the matched route — on the Page Router the route ' +
      'handler returns it as the `matchedRoute` page prop — or failing that from ' +
      'composition.projectMapNodes. The resolved request path cannot be looked up against a ' +
      'dynamic node such as /products/:category'
  ).toMatch(/matchedRoute|projectMapNodes/);

  // The failure mode this fixture exists to catch: the request URL, split into segments.
  // `asPath` and `resolvedUrl` are the two Page Router sources of it.
  const trailModules = touchedSourceFiles()
    .map(({ f, content }) => ({ f, src: stripComments(content) }))
    .filter(({ src }) => /getNodes|Breadcrumb|breadcrumb/.test(src));
  for (const { f, src } of trailModules) {
    expect(
      /\basPath\b|\bresolvedUrl\b/.test(src),
      `${f} derives from the request URL (asPath / resolvedUrl). The trail must be keyed on ` +
        `the matched route: a resolved URL cannot be looked up against a dynamic node, and its ` +
        `segments are not node names`
    ).toBe(false);
  }
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

test('the trail is built on the server, not in the browser', () => {
  expect(
    touchedCode(),
    'the Page Router has no server components: anything reading the project map must run in ' +
      'getServerSideProps (or getStaticProps), because ProjectMapClient carries UNIFORM_API_KEY ' +
      'and shipping that to the browser leaks it'
  ).toMatch(/getServerSideProps|getStaticProps/);

  // A registered component cannot receive page props, so the crumbs have to reach it some
  // other way — but never by fetching them in the browser.
  const clientFetch = touchedSourceFiles()
    .map(({ f, content }) => ({ f, src: stripComments(content) }))
    .filter(({ src }) => /useEffect[\s\S]{0,400}(getNodes|fetch\()/.test(src));
  expect(
    clientFetch.map(({ f }) => f),
    'the project map must not be read from an effect in the browser'
  ).toEqual([]);
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
  expect(src, 'the page the visitor is on must be marked with aria-current="page"').toMatch(
    /aria-current/
  );
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
  for (const pkg of ['@uniformdev/canvas-next', '@uniformdev/canvas-react']) {
    expect(installed[pkg], `the project already depends on ${pkg}`).toBeDefined();
  }
  expect(
    installed['@uniformdev/next-app-router'],
    'this is a Page Router project — the App Router SDK must not be added to it'
  ).toBeUndefined();

  const route = 'pages/[[...path]].tsx';
  expect(existsSync(route), `${route} is the composition route and must survive`).toBe(true);
  expect(
    read(route),
    'the catch-all route must keep fetching the composition server-side with ' +
      'withUniformGetServerSideProps — do not replace SSR with a client-side fetch'
  ).toContain('withUniformGetServerSideProps');
});

test('the trail is correct, safe, and built on the server', async () => {
  await expect(environment).toSatisfyCriterion(
    'This is a breadcrumbs component for a Uniform CMS site in a Next.js **Page Router** ' +
      'project (@uniformdev/canvas-next + @uniformdev/canvas-react, components registered with ' +
      'registerUniformComponent), built from the project map node hierarchy. Verify that: ' +
      "(1) the crumbs are the current page's ancestors in node order from the root down, " +
      'filtered to that ancestor chain — not siblings, not descendants, and not derived from ' +
      'segments of the request URL; ' +
      '(2) an ancestor whose path template still contains an unresolved ":token" after ' +
      'expansion is rendered as text rather than as a link, so no href like ' +
      '"/products/:category" can ever reach the page; ' +
      '(3) the last crumb represents the current page and is not a link; ' +
      '(4) the project map is only ever read on the server — the trail is built in ' +
      'getServerSideProps (or getStaticProps) and passed down as props, and no module that ' +
      'runs in the browser constructs a Uniform client or reads UNIFORM_API_KEY; ' +
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
