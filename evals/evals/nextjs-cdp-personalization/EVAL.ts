import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, normalize } from 'path';
import { test, expect } from 'vitest';

// Brownfield fixture for `uniform-cdp-personalization` on the App Router. The project renders
// Uniform compositions and has no CDP code. The prompt asks for Segment-driven personalization on
// three targets (a boolean audience, a numeric computed trait, an enum computed trait), demo
// profiles without credentials, and no push. It names no Uniform API and says not to stop and
// ask, so the skill's defaults apply.
//
// One documented failure mode per test. A test that returns early is unasserted (n/a): it needs a
// code path the agent may legitimately not have written. uniform-data/quirk/visitorType.yaml is a
// negative control that the staged definitions must leave alone. The skill's rule that a quirk push
// uses a non-mirror mode is not asserted: the prompt asks the agent to say what to run, so the
// command usually lands in chat, which the sandbox does not capture.

const read = (p: string) => readFileSync(p, 'utf-8');

const SKIP = new Set([
  'node_modules', '.next', '.git', '.claude', '.agents', '.cursor', '.copilot-plugin',
  '.skills-src', '__agent_eval__',
]);

function collect(dir = '.'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = dir === '.' ? entry : `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (full !== 'EVAL.ts') out.push(full);
  }
  return out;
}

// Comments are stripped before matching: quoting a rule back in a comment neither passes nor fails.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const isCode = (f: string) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f);
const codeFiles = () => collect().filter(isCode).map((f) => ({ f, content: stripComments(read(f)) }));

// The middleware and every local module it imports, relative or through the `@/` alias.
const MIDDLEWARE = ['middleware.ts', 'middleware.js', 'src/middleware.ts', 'proxy.ts', 'src/proxy.ts'].find(existsSync);

function resolveImport(from: string, spec: string): string | undefined {
  let base: string;
  if (spec.startsWith('.')) base = normalize(join(dirname(from), spec));
  else if (spec.startsWith('@/')) base = spec.slice(2);
  else return undefined;
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.mjs'].map((e) => base + e),
    ...['index.ts', 'index.tsx', 'index.js'].map((i) => join(base, i)),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

function closure(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of read(f).matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const resolved = resolveImport(f, m[1] ?? m[2]);
      if (resolved) stack.push(resolved);
    }
  }
  return [...seen];
}

const codeOf = (files: string[]) => files.map((f) => stripComments(read(f))).join('\n');
const middlewareCode = () => (MIDDLEWARE ? codeOf(closure(MIDDLEWARE)) : '');

const quirksInMiddleware = () => {
  const code = middlewareCode();
  return (
    /handleUniformRoute\s*\(\s*\{[\s\S]{0,400}?\bquirks\b/.test(code) ||
    /uniformMiddleware\s*\(\s*\{[\s\S]{0,400}?\bquirks\b[\s\S]{0,400}?\}\s*\)\s*\(\s*\w+/.test(code)
  );
};

test('CDP quirks are passed to the middleware on every request', () => {
  expect(
    quirksInMiddleware(),
    'the App Router picks the first-render variant in middleware: pass the CDP quirks per request with handleUniformRoute({ request, quirks }). Quirks written only in the browser change the page after it loads, and uniformMiddleware(options) is built once per module'
  ).toBe(true);
});

test('the profile lookup is cached per visitor', () => {
  if (!quirksInMiddleware()) return; // measured only when the lookup runs in middleware
  const code = middlewareCode();
  // A cookie written with an expiry whose value is the serialized quirks, not a plain ID such as
  // the demo profile override. The value and the options are often variables
  // (`cookies.set({ name, value: payload, maxAge })`), so identifiers in the call are expanded to
  // what they were assigned.
  const assigned = new Map(
    [...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*([^;]{0,400})/g)].map((m) => [m[1], m[2]])
  );
  const expand = (s: string) => s + [...s.matchAll(/\b\w+\b/g)].map((m) => assigned.get(m[0]) ?? '').join('\n');
  const writes = [
    ...[...code.matchAll(/cookies\.set\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => expand(m[1])),
    ...[...code.matchAll(/Set-Cookie[^\n]{0,300}/gi)].map((m) => expand(m[0])),
  ];
  const cached = writes.some(
    (w) => /\b(maxAge|expires|Max-Age|Expires)\b/i.test(w) && /JSON\.stringify|quirk|serialize|encode/i.test(w)
  );
  expect(
    cached,
    'middleware runs on every request: keep the mapped quirks per visitor (a cookie with an expiry) instead of calling the Profile API on every page view'
  ).toBe(true);
});

test('the Profile API request names the traits the mapping reads', () => {
  const lookups = codeFiles().filter(({ content }) => /collections\/users\/profiles/.test(content));
  expect(lookups.length, 'no Segment Profile API lookup found (…/collections/users/profiles/…/traits)').toBeGreaterThan(0);
  const code = codeOf([...new Set(lookups.flatMap(({ f }) => closure(f)))]);
  expect(
    /[?&](include|limit)=|searchParams\.(set|append)\(\s*['"](include|limit)['"]|\b(include|limit)\s*:/.test(code),
    'Segment /traits returns 10 traits by default: pass include=<the keys the mapping reads> (or limit), or a mapped trait can be silently missing'
  ).toBe(true);
});

test('the numeric trait is bucketed into quirk values', () => {
  // Fixture literals (`lifetime_value: 2500`) are blanked so they never count as thresholds.
  const mapping = codeFiles()
    .filter(({ content }) => /lifetime_value/.test(content))
    .map(({ f, content }) => ({ f, content: content.replace(/(["']?lifetime_value["']?\s*:\s*)-?[\d_.]+/g, '$1VALUE') }));
  // A read of the value: `traits.lifetime_value` or `traits["lifetime_value"]`, or a variable
  // assigned from one. Log lines are dropped so a logged value is not read as the quirk.
  const ACCESS = String.raw`[\w.?]*(?:\.lifetime_value|\[\s*['"]lifetime_value['"]\s*\])`;
  const raw = mapping.filter(({ content }) => {
    const code = content.replace(/^.*\bconsole\.\w+\(.*$/gm, '');
    const aliases = [...code.matchAll(new RegExp(String.raw`(?:const|let|var)\s+(\w+)\s*=\s*${ACCESS}`, 'g'))].map((m) => m[1]);
    const reads = [ACCESS, ...aliases.map((a) => String.raw`\b${a}\b`)].join('|');
    return new RegExp(String.raw`String\(\s*(?:${reads})\s*\)|\$\{\s*(?:${reads})\s*\}|(?:${reads})\??\.toString\(`).test(code);
  });
  expect(raw.map(({ f }) => f), 'lifetime_value is written as a raw number; quirk criteria compare exact strings and cannot test ranges').toEqual([]);
  // A threshold near the trait: a comparison with a number, a list of numbers, or a named bound.
  // Arrows (`=> 0`), status and length checks, and cookie lifetimes are not thresholds.
  const THRESHOLD = String.raw`(?<!=)(?<!\b(?:status|length|size)\s*)[<>]=?\s*(?:-?\d|[A-Z][A-Z0-9_]{2,}\b)|\[\s*\d+\s*,\s*\d+|\b(?!maxAge\b)\w*(?:min|max|threshold|above|below|gte|lte|tier|bucket)\w*\s*:\s*\d`;
  const near = new RegExp(String.raw`lifetime_value[\s\S]{0,600}?(?:${THRESHOLD})|(?:${THRESHOLD})[\s\S]{0,600}?lifetime_value`);
  const bucketed = mapping.some(({ content }) => near.test(content));
  expect(bucketed, 'map lifetime_value onto a small set of bucket values (thresholds in code) that a quirk definition lists as options').toBe(true);
});

const ORIGINAL_UNIFORM_DATA = [
  'uniform-data/component/hero.yaml',
  'uniform-data/component/page.yaml',
  'uniform-data/quirk/visitorType.yaml',
];
const VISITOR_TYPE = `id: visitorType
name: Visitor type
description: Set by the newsletter form after a successful sign-up.
options:
  - name: Subscriber
    value: subscriber
`;

const isQuirkDefinition = (c: string) =>
  (/^id:\s*\S+/m.test(c) && /^name:/m.test(c) && !/^(parameters|slots|type|crit|str|dur):/m.test(c)) ||
  (/"id"\s*:\s*"[^"]+"/.test(c) && /"name"\s*:/.test(c) && !/"(parameters|slots|crit|traits)"\s*:/.test(c));

const stagedDefinitions = () =>
  collect()
    .filter((f) => /\.(ya?ml|json)$/.test(f) && !f.startsWith('uniform-data/'))
    .filter((f) => !/(^|\/)(package(-lock)?|tsconfig)\.json$/.test(f))
    .map((f) => ({ f, c: read(f) }))
    .filter(({ c }) => isQuirkDefinition(c));

test('quirk definitions are staged in their own directory, not in uniform-data/', () => {
  expect(
    collect('uniform-data').sort(),
    'uniform-data/ mirrors the live project: a mirror pull deletes a hand-written definition before it is pushed. Stage new quirks in their own directory'
  ).toEqual(ORIGINAL_UNIFORM_DATA);
  expect(read('uniform-data/quirk/visitorType.yaml'), 'the existing quirk must be left as it is').toBe(VISITOR_TYPE);
  expect(stagedDefinitions().length, 'no quirk definition (id, name, options) staged outside uniform-data/').toBeGreaterThan(0);
});

test('each staged quirk definition lists the values the mapping writes', () => {
  const defs = stagedDefinitions();
  if (!defs.length) return; // nothing staged: the previous test fails
  expect(
    defs.filter(({ c }) => !/\boptions\b/.test(c)).map(({ f }) => f),
    'every quirk definition lists the values the mapping writes as its options; a value an author targets that is never written matches nobody'
  ).toEqual([]);
  expect(
    defs.some(({ c }) => ['golf', 'tennis', 'running'].every((v) => new RegExp(`value["']?\\s*:\\s*["']?${v}\\b`).test(c))),
    'the favorite_category quirk lists golf, tennis and running as option values'
  ).toBe(true);
});

// Credentials are env vars named like secrets or space IDs; anything else read from process.env is
// a candidate flag. String literals are blanked so a log message that mentions the mock is not
// read as code.
const CREDENTIAL = /TOKEN|KEY|SECRET|SPACE|PASSWORD/;
const MOCK_REF = /(?<!!\s*)\b\w*(?:mock|fake|fixture|simulat)\w*/i;
const blankStrings = (s: string) => s.replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');

test('the mock profile API is switched on by its own flag, never by missing credentials', () => {
  const code = codeFiles().map(({ content }) => content).join('\n');
  const statements = blankStrings(code).split(/;|\n\s*\n/);
  const envReads = (s: string) => [...s.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const aliases = (isCredential: boolean) =>
    [...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=[^;\n]*?process\.env\.([A-Z0-9_]+)/g)]
      .filter((m) => CREDENTIAL.test(m[2]) === isCredential)
      .map((m) => m[1]);
  const credentialAliases = aliases(true);
  const flagAliases = aliases(false).filter((a) => !credentialAliases.includes(a));
  const negatedCredential = new RegExp(
    String.raw`!\s*\(?\s*(?:process\.env\.[A-Z0-9_]*(?:${CREDENTIAL.source})[A-Z0-9_]*` +
      (credentialAliases.length ? `|\\b(?:${credentialAliases.join('|')})\\b` : '') +
      ')'
  );

  const fallback = statements.filter((s) => negatedCredential.test(s) && MOCK_REF.test(s));
  expect(
    fallback.map((s) => s.trim().slice(0, 120)),
    'the mock must not switch on because credentials are missing: a deploy that loses its token would show demo profiles to real visitors'
  ).toEqual([]);

  const gated = statements.some(
    (s) =>
      MOCK_REF.test(s) &&
      (envReads(s).some((n) => !CREDENTIAL.test(n) && !/^(NODE_ENV|VERCEL_ENV)$/.test(n)) ||
        flagAliases.some((a) => new RegExp(`\\b${a}\\b`).test(s)))
  );
  expect(gated, 'switch the mock on with its own environment variable (for example CDP_MOCK=true), read in server code').toBe(true);
});

test('fixture profiles hold raw Segment traits, not quirk values', () => {
  const fixtures = collect()
    .filter((f) => /\.(json|ts|tsx|js|mjs)$/.test(f) && f !== 'package.json')
    .filter((f) => /mock|fixture|demo|persona|profile/i.test(f))
    .map((f) => stripComments(read(f)))
    .filter((c) => /favorite_category|favoriteCategory/.test(c) && /golf|tennis|running/.test(c));
  if (!fixtures.length) return; // no fixture profiles
  expect(
    fixtures.some(
      (c) => /["']?high_intent_golfers["']?\s*:\s*(true|false)\b/.test(c) && /["']?lifetime_value["']?\s*:\s*\d/.test(c)
    ),
    'fixtures hold what Segment returns (snake_case keys, real booleans and numbers) so the mock runs through the production mapping; fixtures of quirk values pass while the mapping is broken'
  ).toBe(true);
});

test('the browser context receives the quirks the middleware applied', () => {
  if (!quirksInMiddleware()) return; // measured only when the lookup runs in middleware
  const handedOver = codeFiles().some(
    ({ content }) =>
      (/^\s*['"]use client['"]/.test(content) && /\.update\(\s*\{[\s\S]{0,200}?\bquirks\b/.test(content)) ||
      /ContextUpdateTransfer[\s\S]{0,200}?\bquirks\b/.test(content)
  );
  expect(
    handedOver,
    'the browser re-evaluates personalization with its own quirks and receives middleware quirks only through a consent-gated cookie on the first load: write the same mapped quirks into the browser context'
  ).toBe(true);
});
