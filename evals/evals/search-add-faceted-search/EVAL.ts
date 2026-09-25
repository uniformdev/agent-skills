import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { test, expect } from 'vitest';

// Brownfield eval: a correct Uniform App Router project (page + hero, plain resolveComponent,
// Tailwind v4, default locale en-US) gets Uniform Search added. Every assertion encodes a
// failure mode the uniform-search skill exists to prevent; each message says why the
// expectation exists so a failing run reads as a skill-gap report. Deterministic only — the
// whole task is verifiable from project state plus the transcript.

const read = (p: string) => readFileSync(p, 'utf-8');

const SKIP = new Set(['node_modules', '.next', '.git', '.claude', '.agents', '.cursor', '__agent_eval__']);
function walk(dir = '.', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = dir === '.' ? entry : `${dir}/${entry}`;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const sourceFiles = () => walk().filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'EVAL.ts');
const files = () => sourceFiles().map((f) => ({ f, content: read(f) }));

const CORE_TYPES = [
  'searchEngine',
  'searchBox',
  'searchList',
  'facetContainer',
  'searchFacet',
  'searchPagination',
  'searchSorting',
];

// The project's default locale, read the way the skill tells the agent to read it.
function defaultLocale(): string {
  const dir = 'uniform-data/locale';
  const yaml = readdirSync(dir).map((f) => read(`${dir}/${f}`));
  const def = yaml.find((y) => /isDefault:\s*true/.test(y)) ?? yaml[0];
  return def.match(/^locale:\s*(\S+)/m)![1];
}

const RESOLVER = ['components/resolveComponent.ts', 'components/resolveComponent.tsx'].find(existsSync)!;
const resolver = () => read(RESOLVER);

// The harness writes the parsed transcript to __agent_eval__/results.json before these tests
// run, but only when it captured one — under some sandbox/agent combinations `o11y` is null.
// Treat that as "unasserted" rather than a failure: a process assertion that throws on
// missing infra reads as a skill defect while measuring nothing (same stance as the
// automations fixtures).
function shellCommands(): string[] | null {
  if (!existsSync('__agent_eval__/results.json')) return null;
  const { o11y } = JSON.parse(read('__agent_eval__/results.json'));
  if (!o11y) return null;
  return (o11y.shellCommands ?? []).map((c: { command: string }) => c.command);
}
function toolCallNames(): string[] {
  if (!existsSync('__agent_eval__/results.json')) return [];
  const { o11y } = JSON.parse(read('__agent_eval__/results.json'));
  return (o11y?.toolCalls ?? []).map((t: { name?: string }) => t.name ?? '');
}
const findPackageFile = () =>
  walk().find((f) => /(^|\/)search-components\.json$/.test(f) && !f.startsWith('uniform-data/'));
const findConfig = () => walk().find((f) => /(^|\/)uniformsearch\.config\.(js|cjs|mjs|ts)$/.test(f));

test('@uniformdev/search is a dependency', () => {
  const pkg = JSON.parse(read('package.json'));
  expect(
    pkg.dependencies?.['@uniformdev/search'],
    'the search client and React bindings come from @uniformdev/search — a search UI built on a hand-rolled fetch has no facets, URL state or click tracking'
  ).toBeDefined();
});

test('the search component types are mapped in the resolver', () => {
  // The resolver itself, plus any module that holds adapted mappings it imports.
  const r = [resolver(), ...files().filter(({ content }) => /mode:\s*['"]adapted['"]/.test(content)).map(({ content }) => content)].join('\n');
  for (const type of CORE_TYPES) {
    expect(r, `resolveComponent (or the mappings module it imports) must map "${type}" — the type ids are fixed by the pushed definitions`).toMatch(
      new RegExp(`\\b${type}\\b`)
    );
  }
});

test('the components were scaffolded with create-uniform-search, not reinvented', () => {
  const commands = shellCommands();
  if (commands) {
    expect(
      commands.some((c) => /create-uniform-search/.test(c)),
      'the source of the components and their definitions is the create-uniform-search CLI; the transcript must show it being run'
    ).toBe(true);
  }
  const all = files();
  const engine = all.find(({ content }) => content.includes('SearchProvider') && content.includes('@uniformdev/search/react'));
  expect(
    engine,
    'a search engine component must wrap its slots in SearchProvider from @uniformdev/search/react (the bundled SearchEngine.tsx)'
  ).toBeDefined();
  const facet = all.find(({ content }) => content.includes('registerFilterOption'));
  expect(
    facet,
    'facets self-register with the provider (registerFilterOption) because an App Router parent cannot read child parameters — the bundled SearchFacet.tsx does this'
  ).toBeDefined();
  const client = all.find(({ content }) => content.includes('createSearchClient'));
  expect(client, 'the search client is created with createSearchClient from @uniformdev/search').toBeDefined();
  const apiRoute = walk().find((f) => /^app\/api\/.*search.*\/route\.tsx?$/i.test(f));
  expect(
    apiRoute,
    'search is a browser-side POST to the search service with a public key — no bespoke Next.js API route should proxy it'
  ).toBeUndefined();
});

test('the search components are registered through the compat adapter', () => {
  const r = resolver();
  expect(
    r,
    "the shipped components use the compat (flattened-props) shape, so they are mapped via createAdapterResolveComponentFunction with mode: 'adapted'"
  ).toContain('createAdapterResolveComponentFunction');
  expect(
    files().some(({ content }) => /mode:\s*['"]adapted['"]/.test(content)),
    "adapted mappings carry mode: 'adapted' (in the resolver or a mappings module it imports)"
  ).toBe(true);
});

test('the existing integration is not damaged', () => {
  const r = resolver();
  expect(r, 'page must still be mapped').toMatch(/['"`]page['"`]|\bpage\s*:/);
  expect(r, 'hero must still be mapped').toMatch(/['"`]hero['"`]|\bhero\s*:/);
  expect(
    read('components/Hero.tsx'),
    'existing server components must not be rewritten into compat mode to accommodate search'
  ).not.toContain('/compat');
  expect(read('middleware.ts'), 'middleware must keep the edge runtime').toContain('experimental-edge');
  expect(read('app/layout.tsx')).not.toContain('UniformContext');
  expect(
    read('app/layout.tsx'),
    'SearchEngine provides SearchProvider — nothing search-related belongs in the root layout'
  ).not.toContain('SearchProvider');
});

test('the public env vars the client reads are declared', () => {
  const env = ['.env', '.env.local', '.env.example'].filter(existsSync).map(read).join('\n');
  // Two variables, not three: since the search service mints project-scoped keys, the key
  // identifies the project and NEXT_PUBLIC_UNIFORM_PROJECT_ID is no longer part of the contract.
  for (const key of ['NEXT_PUBLIC_UNIFORM_SEARCH_API_URL', 'NEXT_PUBLIC_UNIFORM_SEARCH_API_KEY']) {
    expect(env, `${key} must be declared — the client reads it in the browser, and NEXT_PUBLIC_* values are inlined at build time`).toMatch(
      new RegExp(`^${key}=`, 'm')
    );
  }
  // The harness swaps the fixture placeholder for real credentials before the agent runs when
  // they are configured (experiments/lib/uniform-env.ts), so no literal value can be asserted.
  // The invariant is "unchanged since the setup commit": setup writes .env, then the git scrub
  // commits it as HEAD, so HEAD:.env is the exact pre-agent state.
  const apiKeyLine = (src: string) => src.match(/^UNIFORM_API_KEY=(.*)$/m)?.[1];
  const now = apiKeyLine(read('.env'));
  expect(now, '.env must keep a non-empty UNIFORM_API_KEY — the push the user runs later needs it').toBeTruthy();
  let before: string | undefined;
  try {
    before = apiKeyLine(execSync('git show HEAD:.env', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    // No usable git state (e.g. grading a captured project offline) — the non-empty check above
    // is the best available guard.
  }
  if (before) {
    expect(
      now,
      'existing credentials must not be overwritten with invented values — UNIFORM_API_KEY must be exactly what setup left in .env'
    ).toBe(before);
  }
});

test('the project-map client sends the search key', () => {
  const client = walk().find((f) => /(^|\/)lib\/search\/projectMapClient\.ts$/.test(f));
  expect(client, 'the scaffold ships lib/search/projectMapClient.ts (node-id → path map for composition hits)').toBeDefined();
  expect(
    read(client!),
    '/api/project-map fails closed without x-api-key; the create-uniform-search 0.0.6 scaffold calls it bare, so every composition hit silently loses its link until the header is added (install.md → Patch the project-map client)'
  ).toMatch(/x-api-key/);
});

test('the mono-* theme tokens are wired into the build, not just written to disk', () => {
  // search-theme.css is written by create-uniform-search either way, so its own content proves
  // nothing — the skill's step is importing it (or merging its tokens). Scan everything else.
  const styles = walk()
    .filter((f) => (/\.(css|scss)$/.test(f) && !f.endsWith('search-theme.css')) || /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(f))
    .map(read)
    .join('\n');
  expect(
    styles,
    'the components use mono-50…mono-900 utilities; the palette file the CLI writes must be @imported from the global stylesheet (or its @theme block merged, or theme.extend.colors.mono added for v3) — copied-but-unimported tokens leave the search UI unstyled'
  ).toMatch(/@import\s+[^;]*search-theme\.css|--color-mono-900|mono\s*:\s*\{/);
});

test('definitions are staged as the self-contained CLI package with a create-mode config', () => {
  const pkgFile = findPackageFile();
  expect(pkgFile, 'search-components.json must be copied into the repo (outside uniform-data/)').toBeDefined();
  const config = findConfig();
  expect(config, 'uniformsearch.config.js must be copied next to the package file').toBeDefined();
  const cfg = read(config!);
  expect(cfg, "the push must be additive: serialization.mode 'create' never updates or deletes existing entities").toMatch(
    /mode:\s*['"]create['"]/
  );
  expect(cfg, 'the config must point at the package file').toContain('search-components.json');
  expect(
    pkgFile!.split('/').slice(0, -1).join('/'),
    'the config resolves search-components.json relative to the cwd of the push, so both files live in the same directory'
  ).toBe(config!.split('/').slice(0, -1).join('/'));

  const json = JSON.parse(read(pkgFile!));
  const ids = (json.components ?? []).map((c: { id: string }) => c.id);
  for (const type of CORE_TYPES) {
    expect(ids, `the package must define "${type}" — the React mapping only works against the pushed definition`).toContain(type);
  }
  expect(
    ids.map((id: string) => `uniform-data/component/${id}.yaml`).some(existsSync),
    'search definitions must not be merged into the project\'s own uniform-data serialization (that directory has mirror/createOrUpdate semantics)'
  ).toBe(false);
});

test('the package is remapped to the project\'s default locale', () => {
  const locale = defaultLocale();
  const pkgFile = findPackageFile();
  expect(pkgFile, 'search-components.json must be present before its locale can be checked').toBeDefined();
  const raw = read(pkgFile!);
  const authored = new Set<string>();
  for (const m of raw.matchAll(/"_locales":\s*\[([^\]]*)\]/g)) {
    for (const code of m[1].matchAll(/"([^"]+)"/g)) authored.add(code[1]);
  }
  for (const m of raw.matchAll(/"locales":\s*\{\s*"([^"]+)"/g)) authored.add(m[1]);
  expect(authored.size, 'the package must still carry localized patterns').toBeGreaterThan(0);
  expect(
    [...authored],
    `the patterns are authored in one locale; unless every _locales entry and locales key is the project's default (${locale}), they push but are not usable`
  ).toEqual([locale]);
});

test('the push was handed to the user, not run', () => {
  const commands = shellCommands();
  if (!commands) return; // no transcript captured — unasserted, see shellCommands()
  expect(
    commands.filter((c) => /sync\s+push/.test(c) && !/--what-if|\s-w\b/.test(c)),
    'the skill hands the push command to the user; the agent must not push definitions itself'
  ).toEqual([]);
  const mcpMutations = toolCallNames().filter((n) =>
    /mutateComponent|mutateContentTypeOrBlock|mutatePattern|mutateAggregate/.test(n)
  );
  expect(
    mcpMutations,
    'the search definitions ship as a vendored package; they are not recreated through Uniform MCP mutations'
  ).toEqual([]);
});
