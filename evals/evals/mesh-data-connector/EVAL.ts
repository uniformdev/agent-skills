import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// The agent adds a Uniform Mesh data-connector integration to an existing minimal Next.js
// project (PROMPT.md says "in this project"), so it must extend what is there rather than
// scaffold over it. Each assertion encodes a claim from the mesh skill / rule:
//   - a data connector is declared in the manifest (dataConnectors + archetypes)
//   - the Mesh SDK (useMeshLocation) and the Uniform design system are used
//   - data source + data resource editors exist (connection + picker)
//   - App Router location components (if any) are client components ("use client")
//   - the existing project's own config and dependencies survive
//   - credentials live in the data source value, not hard-coded or in settings (judge)

const read = (p: string) => readFileSync(p, 'utf-8');

function collect(dir = '.', exts = /\.(ts|tsx|js|jsx|json)$/): string[] {
  // Every agent's skill-discovery root is skipped, so an arm is never graded against the
  // guidance it was given. The skill is markdown today so nothing under these would match the
  // extension filter anyway, but one .ts example added to a skill would otherwise be silently
  // collected and graded as project source.
  //
  // This list must gain an entry whenever an arm gains a discovery root — see DISCOVERY_ROOT
  // in experiments/lib/skill-install.ts, which is the list to keep it in step with. '.cursor'
  // was missed when the Cursor arms landed.
  const skip = new Set([
    'node_modules',
    '.next',
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

const files = () => collect().map((f) => ({ f, content: read(f) }));
const sourceText = () =>
  files()
    .filter(({ f }) => /\.(ts|tsx|js|jsx)$/.test(f))
    .map(({ content }) => content)
    .join('\n');
// Merge deps from every package.json (agents sometimes scaffold into a subdir), so a
// dependency declared anywhere in the project counts.
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

test('declares a data connector in a mesh manifest', () => {
  const manifests = files().filter(
    ({ f, content }) => f.endsWith('.json') && content.includes('dataConnectors')
  );
  expect(
    manifests.length,
    'expected a mesh-manifest JSON with a "dataConnectors" location (the data connector lives under locations.dataConnectors)'
  ).toBeGreaterThan(0);
  const manifest = manifests[0].content;
  expect(manifest, 'each connector needs a dataSourceEditorUrl').toContain('dataSourceEditorUrl');
  expect(
    manifest,
    'a connector exposes typed data via dataArchetypes (typeEditorUrl + dataEditorUrl)'
  ).toContain('dataArchetypes');
});

test('uses the Uniform Mesh SDK', () => {
  expect(
    deps()['@uniformdev/mesh-sdk-react'],
    'expected @uniformdev/mesh-sdk-react as a dependency — Mesh locations are built with it'
  ).toBeDefined();
  expect(
    sourceText(),
    'location components read/write value + metadata via the useMeshLocation hook'
  ).toContain('useMeshLocation');
});

test('builds UI from the Uniform design system, not hand-rolled controls', () => {
  expect(
    deps()['@uniformdev/design-system'],
    'expected @uniformdev/design-system as a dependency — location UI must use it'
  ).toBeDefined();
  expect(
    sourceText(),
    'location UI must import components from @uniformdev/design-system'
  ).toContain('@uniformdev/design-system');

  // The half this test was named for but never actually checked. The two assertions above
  // only prove the package is installed and imported *somewhere*, so a location that mixes
  // in a raw control still passed: a run shipped `<input type="checkbox">` inside a
  // design-system list item and only the LLM judge caught it, at judge cost and judge
  // variance. Deterministic here instead.
  //
  // Match on `\b`, not `[ >]`: formatted JSX puts the first prop on the next line, so
  // `<input\n  type=...` has a newline after the tag name and `<input[ >]` silently misses
  // it. Capitalised design-system components (`<Input`, `<InputSelect`) never match, since
  // the pattern is case-sensitive.
  const RAW_CONTROL = /<(input|select|button)\b/;
  // Drop block comments (including `{/* … */}`) and whole-line `//` comments first: the rule
  // itself is phrased "do not hand-roll raw <input>/<select>/<button>", so an agent that
  // quotes it in a comment must not be failed for agreeing with us.
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const offenders = files()
    .filter(({ f }) => /\.(tsx|jsx)$/.test(f))
    .flatMap(({ f, content }) =>
      stripComments(content)
        .split('\n')
        .map((text, i) => ({ where: `${f}:${i + 1}`, text: text.trim() }))
        .filter(({ text }) => RAW_CONTROL.test(text))
    )
    .map(({ where, text }) => `${where}  ${text}`);

  expect(
    offenders,
    'location UI must be composed from @uniformdev/design-system components — use InputToggle / InputSelect / Button rather than raw <input>/<select>/<button>. Discover the current component set from the installed package (see the skill\'s design-system reference)'
  ).toEqual([]);
});

test('implements a data source editor and a data resource picker', () => {
  const src = sourceText();
  expect(
    src,
    'a data source editor configures the connection (useMeshLocation with the dataSource location)'
  ).toMatch(/dataSource/);
  expect(
    src,
    'a data resource editor lets authors pick records (useMeshLocation with the dataResource location)'
  ).toMatch(/dataResource/);
});

test('the app is wrapped in the Mesh provider', () => {
  expect(
    sourceText(),
    'location pages must render inside MeshApp (the SDK/context provider)'
  ).toContain('MeshApp');
});

test('App Router location components are client components', () => {
  const appLocationFiles = files().filter(
    ({ f, content }) => /(^|\/)app\//.test(f) && content.includes('useMeshLocation')
  );
  // Page Router integrations have none of these, which is fine (canonical path).
  for (const { f, content } of appLocationFiles) {
    expect(
      content,
      `${f}: App Router Mesh location components must start with "use client" (they rely on hooks + iframe messaging and cannot be RSC)`
    ).toMatch(/^['"]use client['"]/m);
  }
});

// Mirrors the rule's "extend the project you are given". These packages were in the
// fixture's devDependencies before the task and nothing about building a Mesh integration
// requires removing them. This is also self-protection: an agent once rewrote package.json
// without vitest, its own `npm install` pruned it, and the harness could no longer run this
// file — reported as 0% while measuring nothing at all.
// Deliberately not asserted: `"type": "module"`. An agent may have a legitimate reason to
// change the project's module type, so pinning it could fail a correct run.
test('extends the existing project instead of replacing its config', () => {
  const installed = deps();
  for (const pkg of ['vitest', 'typescript', '@types/node', '@types/react', '@types/react-dom']) {
    expect(
      installed[pkg],
      `${pkg} was already in this project's devDependencies — add your dependencies to the existing package.json instead of overwriting it, and never drop entries you did not add`
    ).toBeDefined();
  }
});

test('credentials live in the data source, built with design-system UI', async () => {
  await expect(environment).toSatisfyCriterion(
    'This is a Uniform Mesh data-connector integration. Verify that: (1) API credentials ' +
      '(tokens/keys) are stored in the data source editor value (e.g. in the value custom ' +
      'object or header/parameter values) rather than hard-coded in source or placed in a ' +
      'settings location; and (2) the data source and product-picker UIs are composed from ' +
      '@uniformdev/design-system components rather than hand-rolled <input>/<select>/<button> ' +
      'HTML elements.'
  );
});
