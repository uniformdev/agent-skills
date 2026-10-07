import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, normalize } from 'path';
import { test, expect } from 'vitest';

// Brownfield fixture for `uniform-cdp-personalization` on the App Router. The project renders
// Uniform compositions and has no CDP code. The prompt asks for Segment-driven personalization on
// three targets (a boolean audience, a numeric computed trait, an enum computed trait), demo
// profiles without credentials, and no push. It names no Uniform API and says not to stop and
// ask, so the skill's defaults apply.
//
// One documented failure mode per test. Only the browser handover returns early (n/a), when the
// lookup is not in middleware; the first test fails in that case. uniform-data/quirk/visitorType.yaml
// is a negative control that the staged definitions must leave alone. The skill's rule that a quirk
// push uses a non-mirror mode is not asserted: the prompt asks the agent to say what to run, so the
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
// String contents are blanked, keeping offsets, where a log message must not read as code.
const blankStrings = (s: string) =>
  s.replace(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g, (_, q: string, body: string) => q + ' '.repeat(body.length) + q);

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

const IMPORT = /(?:import|export)\s([^'"]*?)from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function closure(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!isCode(f)) continue;
    for (const m of read(f).matchAll(IMPORT)) {
      const resolved = resolveImport(f, m[2] ?? m[3]);
      if (resolved) stack.push(resolved);
    }
  }
  return [...seen];
}

const codeOf = (files: string[]) => files.filter(isCode).map((f) => stripComments(read(f))).join('\n');
const middlewareCode = () => (MIDDLEWARE ? codeOf(closure(MIDDLEWARE)) : '');

// Identifiers mapped to what they were assigned, so a value or option held in a constant is read
// through it.
const assignments = (code: string) =>
  new Map([...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*([^;]{0,400})/g)].map((m) => [m[1], m[2]]));

// The argument list of every call the pattern opens, up to its balanced closing parenthesis, so
// nested calls in the options (`maxAge: Math.max(0, Math.floor((exp - Date.now()) / 1000))`) do
// not hide the call.
function callArgs(code: string, opener: RegExp) {
  return [...code.matchAll(opener)].map((m) => {
    const start = m.index! + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < code.length && depth; i++) depth += code[i] === '(' ? 1 : code[i] === ')' ? -1 : 0;
    return code.slice(start, i - 1);
  });
}

// Function declarations mapped to their bodies, so a value serialized inside a helper
// (`cookies.set(NAME, encodeEntry(entry), …)`) is read through it.
function functionBodies(code: string) {
  const out = new Map<string, string>();
  for (const m of code.matchAll(/function\s+(\w+)\s*\([^)]*\)[^{]*\{/g)) {
    const start = m.index! + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < code.length && depth; i++) depth += code[i] === '{' ? 1 : code[i] === '}' ? -1 : 0;
    out.set(m[1], code.slice(start, i - 1));
  }
  return out;
}

const quirksInMiddleware = () => {
  const code = middlewareCode();
  return (
    /handleUniformRoute\s*\(\s*\{[\s\S]{0,400}?\bquirks\b/.test(code) ||
    /uniformMiddleware\s*\(\s*\{[\s\S]{0,400}?\bquirks\b[\s\S]{0,400}?\}\s*\)\s*\(\s*\w+/.test(code)
  );
};

// A cookie written with an expiry whose value is the serialized quirks, not a plain ID such as the
// demo profile override, and read back under the same name before the lookup. Variables in the call
// are expanded to what they were assigned, and the functions it calls to their bodies, for the
// serialization only, not for the word "quirk", which any identifier assigned from a getCdpQuirks()
// call would carry.
function cacheCookie(code: string) {
  const assigned = assignments(code);
  const bodies = functionBodies(code);
  const expand = (s: string) => s + [...s.matchAll(/\b\w+\b/g)].map((m) => assigned.get(m[0]) ?? '').join('\n');
  const called = (s: string) => [...s.matchAll(/\b(\w+)\s*\(/g)].map((m) => bodies.get(m[1]) ?? '').join('\n');
  const literal = (s?: string) => s?.match(/^\s*['"`]([\w.-]+)['"`]/)?.[1];
  const resolve = (s: string) => literal(s) ?? literal(assigned.get(s.trim()));
  const nameOf = (args: string) => {
    // A Set-Cookie string: `name=…` or `${NAME}=…`
    const header = args.match(/^\s*['"`]\s*([\w.-]+)=/)?.[1] ?? args.match(/\$\{\s*(\w+)\s*\}=/)?.[1];
    if (header) return resolve(header) ?? header;
    if (args.trim().startsWith('{')) return resolve(args.match(/\bname\s*:\s*([^,}]+)/)?.[1] ?? 'name');
    // nookies' setCookie(ctx, name, value, options) takes the request context first
    const [first, second = ''] = args.split(',');
    return resolve(first) ?? resolve(second);
  };
  const writes = [
    ...callArgs(code, /(?:cookies\.set|\bsetCookie|\bserialize)\(/g),
    ...[...code.matchAll(/Set-Cookie['"`]?\s*,\s*([\s\S]{0,400}?)\)\s*;/gi)].map((m) => m[1]),
  ].filter((w) => {
    const e = expand(w);
    return (
      /\b(maxAge|expires|Max-Age|Expires)\b/i.test(e) &&
      (/JSON\.stringify|\bserialize\w+\(/.test(e + called(w)) || /quirk/i.test(w))
    );
  });
  const names = writes.map(nameOf).filter((n): n is string => !!n);
  // Read: passed to any call that is not a write (`cookies.get(NAME)`, `readCookie(req, NAME)`),
  // indexed (`parse(header)[NAME]`) or accessed as a property.
  const isRead = (name: string) => {
    const refs = [`['"\`]${name}['"\`]`, ...[...assigned].filter(([, v]) => literal(v) === name).map(([k]) => `\\b${k}\\b`)];
    const ref = `(?:${refs.join('|')})`;
    return new RegExp(
      `\\b(?!(?:set|setHeader|setCookie|serialize|append)\\()\\w+\\([^)]*?${ref}|\\[\\s*${ref}|\\.${name}\\b`
    ).test(code);
  };
  return { written: writes.length > 0, read: names.some(isRead) };
}

// Passing the quirks in middleware is a precondition, not a test of its own: the baseline does it
// unaided.
test('the profile lookup runs in middleware and is cached per visitor', () => {
  expect(
    quirksInMiddleware(),
    'the App Router picks the first-render variant in middleware: pass the CDP quirks per request with handleUniformRoute({ request, quirks })'
  ).toBe(true);
  const cache = cacheCookie(middlewareCode());
  expect(
    cache.written,
    'middleware runs on every request: keep the mapped quirks per visitor (a cookie with an expiry) instead of calling the Profile API on every page view'
  ).toBe(true);
  expect(
    cache.read,
    'the cache cookie is written but never read: look the profile up only when the cached entry is missing, expired or for another identity'
  ).toBe(true);
});

test('the Profile API request names the traits the mapping reads', () => {
  const lookups = codeFiles().filter(({ content }) => /collections\/users\/profiles/.test(content));
  expect(lookups.length, 'no Segment Profile API lookup found (…/collections/users/profiles/…/traits)').toBeGreaterThan(0);
  const code = codeOf([...new Set(lookups.flatMap(({ f }) => closure(f)))]);
  const include = /[?&]include=|searchParams\.(set|append)\(\s*['"]include['"]|\binclude\s*:/.test(code);
  // `limit` lifts the default of 10 only when it is set above it.
  const limits = [
    ...code.matchAll(/[?&]limit=(\d+)|searchParams\.(?:set|append)\(\s*['"]limit['"]\s*,\s*['"]?(\d+)|\blimit\s*:\s*['"]?(\d+)/g),
  ].map((m) => Number(m[1] ?? m[2] ?? m[3]));
  expect(
    include || limits.some((n) => n > 10),
    'Segment /traits returns 10 traits by default: pass include=<the keys the mapping reads> (or a limit above 10), or a mapped trait can be silently missing'
  ).toBe(true);
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

// Files that hold demo profiles: records with favorite_category values under any key naming
// (fixtures of quirk values often use the agent's own quirk IDs), excluding option lists.
const profileFiles = () => {
  const staged = new Set(stagedDefinitions().map(({ f }) => f));
  return collect()
    .filter((f) => /\.(json|ts|tsx|js|mjs)$/.test(f) && !f.startsWith('uniform-data/') && !staged.has(f))
    .filter((f) => !/(^|\/)(package(-lock)?|tsconfig)\.json$/.test(f))
    .map((f) => ({ f, content: stripComments(read(f)) }))
    .filter(({ content }) => (content.match(/\b(?!value\b)\w+["']?\s*:\s*["'](golf|tennis|running)["']/g) ?? []).length >= 2);
};

// Credentials are env vars named like secrets or space IDs; anything else read from process.env is
// a candidate flag. Mock data is an identifier named like a mock, or a binding imported from a
// profile file.
const CREDENTIAL = /TOKEN|KEY|SECRET|SPACE|PASSWORD/;
const MOCK_NAME = /\w*(?:mock|fake|fixture|simulat)\w*/i;

// Each `if` condition with its body and else branch, and each ternary, with offsets shared by the
// raw and the blanked code.
function guards(blanked: string) {
  const block = (from: number) => {
    let j = from;
    while (/\s/.test(blanked[j] ?? '')) j++;
    if (blanked[j] !== '{') {
      const end = blanked.indexOf(';', j);
      return [j, end === -1 ? blanked.length : end] as const;
    }
    let depth = 1;
    let k = j + 1;
    for (; k < blanked.length && depth; k++) depth += blanked[k] === '{' ? 1 : blanked[k] === '}' ? -1 : 0;
    return [j, k] as const;
  };
  const out: { cond: [number, number]; body: [number, number]; orElse?: [number, number] }[] = [];
  for (const m of blanked.matchAll(/\bif\s*\(/g)) {
    const start = m.index! + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < blanked.length && depth; i++) depth += blanked[i] === '(' ? 1 : blanked[i] === ')' ? -1 : 0;
    const body = block(i);
    const rest = blanked.slice(body[1]).match(/^\s*}?\s*else\b(?!\s+if)/);
    out.push({ cond: [start, i - 1], body, orElse: rest ? block(body[1] + rest[0].length) : undefined });
  }
  // Ternaries, often split over lines: the statement up to `?` is the condition. `?.`, `??` and
  // optional parameters (`x?:`) are not ternaries.
  for (const m of blanked.matchAll(/[^;{}]+/g)) {
    const q = m[0].search(/(?<!\?)\?(?![.?:])/);
    if (q === -1) continue;
    const at = m.index! + q + 1;
    const colon = m[0].slice(q + 1).indexOf(':');
    out.push({
      cond: [m.index!, m.index! + q],
      body: [at, colon === -1 ? m.index! + m[0].length : at + colon],
      orElse: colon === -1 ? undefined : [at + colon + 1, m.index! + m[0].length],
    });
  }
  return out;
}

test('the mock profile API is switched on by its own flag, never by missing credentials', () => {
  const files = codeFiles();
  const all = files.map(({ content }) => content).join('\n');
  const envReads = (s: string) => [...s.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const negated = (p: string) => new RegExp(String.raw`(?<!!)!\s*\(?\s*${p}`);
  const CRED_ENV = `process\\.env\\.[A-Z0-9_]*(?:${CREDENTIAL.source})[A-Z0-9_]*`;
  // Constants and functions that read process.env, classified by every variable they read: an
  // alias such as `useMock = !process.env.TOKEN` means "credentials are missing".
  const assignments = [
    ...all.matchAll(/(?:const|let|var)\s+(\w+)\s*=([^;\n]*(?:\n\s*(?:\|\||&&|\?|:|\.)[^;\n]*)*)/g),
    ...all.matchAll(/function\s+(\w+)\s*\([^)]*\)[^{]*\{([^}]{0,200})/g),
  ];
  const ref = (envPattern: string, names: string[]) =>
    `(?:${envPattern}` + (names.length ? `|\\b(?:${names.join('|')})\\b` : '') + ')';
  const names = (pred: (expr: string) => boolean) => assignments.filter((m) => pred(m[2])).map((m) => m[1]);
  const credentialAliases = names((e) => envReads(e).some((n) => CREDENTIAL.test(n)));
  const missingAliases = names((e) => negated(ref(CRED_ENV, credentialAliases)).test(e));
  const envFlags = names((e) => envReads(e).some((n) => !CREDENTIAL.test(n) && !/^(NODE_ENV|VERCEL_ENV)$/.test(n)));
  const flagAliases = [...envFlags, ...names((e) => envFlags.some((a) => new RegExp(`\\b${a}\\b`).test(e)))];
  const CRED = ref(CRED_ENV, credentialAliases.filter((a) => !missingAliases.includes(a)));
  const FLAG = ref(`process\\.env\\.(?!NODE_ENV\\b|VERCEL_ENV\\b)(?![A-Z0-9_]*(?:${CREDENTIAL.source}))[A-Z0-9_]+`, flagAliases);
  const MISSING = missingAliases.length ? new RegExp(`(?<!!\\s*)\\b(?:${missingAliases.join('|')})\\b`) : /$^/;

  const profilePaths = new Set(profileFiles().map(({ f }) => f));
  const bindings = files.flatMap(({ f, content }) =>
    [...content.matchAll(IMPORT)]
      .filter((m) => m[1] && profilePaths.has(resolveImport(f, m[2]) ?? ''))
      .flatMap((m) => [...m[1].matchAll(/\b(?:\w+\s+as\s+)?(\w+)\b/g)].map((b) => b[1]))
      .filter((b) => !['import', 'export', 'type', 'as', 'from'].includes(b))
  );
  const mockData = (s: string) => MOCK_NAME.test(s) || bindings.some((b) => new RegExp(`\\b${b}\\b`).test(s));

  const fallback: string[] = [];
  for (const { content } of files) {
    const blanked = blankStrings(content);
    for (const g of guards(blanked)) {
      const cond = blanked.slice(...g.cond);
      const body = blanked.slice(...g.body);
      const orElse = g.orElse ? blanked.slice(...g.orElse) : '';
      const missing = negated(CRED).test(cond) || MISSING.test(cond);
      const present = !missing && new RegExp(CRED).test(cond);
      if ((missing && mockData(body)) || (present && mockData(orElse)))
        fallback.push(cond.trim().slice(0, 120));
    }
  }
  expect(
    fallback,
    'the mock must not switch on because credentials are missing: a deploy that loses its token would show demo profiles to real visitors'
  ).toEqual([]);

  // The flag must gate the data the lookup returns, not only the demo UI.
  const lookups = files.filter(({ content }) => /collections\/users\/profiles/.test(content)).map(({ f }) => f);
  const dataPath = [...new Set([...(MIDDLEWARE ? closure(MIDDLEWARE) : []), ...lookups.flatMap(closure)])].filter(isCode);
  const gated = dataPath.some((f) => {
    const raw = stripComments(read(f));
    const blanked = blankStrings(raw);
    return guards(blanked).some((g) => {
      const cond = blanked.slice(...g.cond);
      if (!new RegExp(FLAG).test(cond)) return false;
      return negated(FLAG).test(cond)
        ? !!g.orElse && mockData(raw.slice(...g.orElse))
        : mockData(raw.slice(...g.body));
    });
  });
  expect(
    gated,
    'switch the mock profile data on with its own environment variable (for example CDP_MOCK=true), read where the lookup chooses between the CDP and the fixtures'
  ).toBe(true);
});

test('fixture profiles hold raw Segment traits, not quirk values', () => {
  const fixtures = profileFiles();
  expect(fixtures.length, 'no demo profiles found: the prompt asks to switch between visitor profiles without credentials').toBeGreaterThan(0);
  expect(
    fixtures.some(
      ({ content }) =>
        /["']?high_intent_golfers["']?\s*:\s*(true|false)\b/.test(content) && /["']?lifetime_value["']?\s*:\s*\d/.test(content)
    ),
    'fixtures hold what Segment returns (snake_case keys, real booleans and numbers) so the mock runs through the production mapping; fixtures of quirk values pass while the mapping is broken'
  ).toBe(true);
});

test('the browser context receives the quirks the middleware applied', () => {
  if (!quirksInMiddleware()) return; // measured only when the lookup runs in middleware
  const COOKIE_READ = /document\.cookie|Cookies\.get\(|getCookie\(|cookies\.get\(/;
  const handedOver = codeFiles().some(
    ({ f, content }) =>
      (/^\s*['"]use client['"]/.test(content) &&
        /\.update\(\s*\{[\s\S]{0,200}?\bquirks\b/.test(content) &&
        COOKIE_READ.test(codeOf(closure(f)))) ||
      /ContextUpdateTransfer[\s\S]{0,200}?\bquirks\b/.test(content)
  );
  expect(
    handedOver,
    'the browser re-evaluates personalization with its own quirks and receives middleware quirks only through a consent-gated cookie on the first load: write the same mapped quirks into the browser context from a cookie the middleware sets'
  ).toBe(true);
});
