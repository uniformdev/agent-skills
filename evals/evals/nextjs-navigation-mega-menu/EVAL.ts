import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// The agent builds navigation with a mega menu in a Next.js App Router project that ships
// only the `page` shell — no navigation of any kind. It must model the chain AND render it,
// so assertions here are deliberately NAME-INDEPENDENT: the prompt does not dictate component
// type names, and an agent that picks its own reasonable names must not be failed for it.
// What is asserted is the mechanism each claim in the uniform-navigation skill turns on:
//   - navigation is modeled as a chain of components, not one monolith
//   - the category rail reads child data via the composition cache …
//   - … and the cache is actually wired to UniformComposition (the silent-null trap:
//     `compositionCache` is an OPTIONAL prop, so forgetting it is not a type error and
//     every lookup returns null — the rail renders empty and looks like a content bug)
//   - panel content is rendered through UniformSlot filtered by _id, not rebuilt from raw
//     parameters (rebuilding forfeits personalization, patterns and editor click targets)
//   - labels the brief calls editable use UniformText
//   - the interactive shell is a client component
//   - keyboard/ARIA basics exist (aria-expanded + Escape)
//   - the existing project's `page` mapping, config and dependencies survive
// Naming, slot policy and layout quality are left to the judge.

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
const sourceText = () => sourceFiles().map(({ content }) => content).join('\n');

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

// Comments are stripped before pattern matching throughout: an agent that quotes the
// requirement ("read the label via the composition cache") in a comment must not pass a
// test on the strength of the comment, and must not fail one for agreeing with us.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = () => sourceFiles().map(({ content }) => stripComments(content)).join('\n');

// The resolver file is where component types are mapped to React components. Collect the
// string literals it compares against / keys off, rather than looking for specific names:
// the prompt never dictates the type names, so `navigationFlyout` vs `flyout` vs `megaMenu`
// are all legitimate. What matters is that navigation was decomposed at all.
const resolverTypes = (): string[] => {
  const resolver = sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .filter(({ content }) => /ResolveComponentFunction|resolveComponent/.test(content));
  const found = new Set<string>();
  for (const { content } of resolver) {
    for (const m of content.matchAll(/['"]([A-Za-z][A-Za-z0-9_]{2,40})['"]\s*(?::|\)|,|$)/gm)) {
      found.add(m[1]);
    }
    for (const m of content.matchAll(/type\s*===\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
  }
  return [...found];
};

test('models navigation as a chain of components, not one monolith', () => {
  const types = resolverTypes();

  // Regression guard: the page shell the fixture shipped must still be mapped.
  expect(
    types,
    '"page" was already mapped in components/resolveComponent.ts — extend the resolver, do not replace it'
  ).toContain('page');

  // A trigger, a category and a group/link are the minimum for the brief's mega menu.
  // Repetition and nesting in Uniform are expressed as separate components in slots, so a
  // single "megaMenu" component that renders everything itself cannot be authored or
  // reordered by editors.
  const added = types.filter((t) => t !== 'page');
  expect(
    added,
    'navigation must be modeled as a chain of components (a flyout/trigger, a category, a group and/or link) each registered in the resolver — not one component that renders the whole menu. Nested, repeatable menu items are slots holding real components, never numbered parameters'
  ).not.toEqual([]);
  expect(
    added.length,
    `expected at least 3 navigation component types registered, found ${added.length}: [${added.join(', ')}]`
  ).toBeGreaterThanOrEqual(3);
});

test('does not fake repetition with numbered parameters', () => {
  const offenders = sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .flatMap(({ f, content }) =>
      content
        .split('\n')
        .map((text, i) => ({ where: `${f}:${i + 1}`, text: text.trim() }))
        .filter(({ text }) => /\b(link|item|category|column|group)(Text|Title|Url|Href)?[1-9]\b/i.test(text))
    )
    .map(({ where, text }) => `${where}  ${text}`);

  expect(
    offenders,
    'repeated menu entries must be a slot holding components, not numbered parameters (link1, link2, categoryTitle3) — numbering caps the count, blocks reordering, and forfeits personalization on individual items'
  ).toEqual([]);
});

test('reads child component data through the composition cache', () => {
  const src = code();
  expect(
    src,
    'the category rail needs its children\'s labels, but a slot only yields opaque rendered children plus an _id — use createCompositionCache() to read the raw child instances'
  ).toContain('createCompositionCache');
  expect(
    src,
    'read each child instance with compositionCache.getUniformComponent({ componentId, compositionId })'
  ).toContain('getUniformComponent');
});

// The trap this whole eval exists for. `compositionCache` is optional on
// UniformCompositionProps, so an agent can create the cache, call getUniformComponent,
// typecheck clean — and get null from every lookup because the cache was never handed to
// the composition. The rail then renders empty and presents as a content problem.
test('wires the composition cache into UniformComposition', () => {
  const withComposition = sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .filter(({ content }) => content.includes('UniformComposition'));

  expect(
    withComposition.length,
    'expected the composition route (app/uniform/[code]/page.tsx) to still render UniformComposition'
  ).toBeGreaterThan(0);

  const wired = withComposition.filter(({ content }) => /compositionCache\s*=\s*\{/.test(content));
  expect(
    wired.map(({ f }) => f),
    'UniformComposition must receive the compositionCache prop — it is OPTIONAL, so omitting it is not a type error, but every getUniformComponent() lookup then returns null and the menu renders silently empty'
  ).not.toEqual([]);
});

// Both halves must hold *in the same file*: `UniformSlot` alone is trivially true (the
// starter already renders slots), and an `_id` comparison alone could live anywhere. What
// this eval is actually about is the render function that filters a rendered slot by id.
test('renders panel content through the slot, filtered by id', () => {
  const filtering = sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .filter(({ content }) => /UniformSlot/.test(content) && /_id\s*===|===\s*[^;]{0,40}_id/.test(content));

  expect(
    filtering.map(({ f }) => f),
    'the active category\'s content must come from rendering the panel slot and filtering to the matching child — a UniformSlot render function that compares the child _id against the active category. Rebuilding children from raw parameter values instead discards personalization, pattern links and the visual editor\'s click targets'
  ).not.toEqual([]);
});

// Nothing in the starter uses UniformText, so this assertion is doing real work: the brief
// requires the link and group text to be editable inline in Uniform's visual editor, and a
// raw {label} string renders something the editor cannot click.
test('keeps editable text inline-editable', () => {
  const withText = sourceFiles()
    .map(({ f, content }) => ({ f, content: stripComments(content) }))
    .filter(({ content }) => content.includes('UniformText'));

  expect(
    withText.map(({ f }) => f),
    'the brief requires link and group text to be editable inline in Uniform\'s visual editor: render those labels through UniformText rather than printing the raw parameter value, or the editor cannot click them'
  ).not.toEqual([]);
});

test('the interactive menu is a client component', () => {
  const interactive = sourceFiles().filter(({ content }) => {
    const c = stripComments(content);
    return /useState|useEffect|onMouseEnter|onMouseLeave/.test(c);
  });
  expect(
    interactive.length,
    'a hover-driven menu needs client-side state somewhere'
  ).toBeGreaterThan(0);
  for (const { f, content } of interactive) {
    expect(
      content,
      `${f}: components using hooks or mouse handlers must be client components — add the "use client" directive at the top of the file`
    ).toMatch(/^\s*['"]use client['"]/m);
  }
});

test('the menu is operable by keyboard', () => {
  const src = code();
  expect(
    src,
    'the flyout trigger must expose its state with aria-expanded'
  ).toContain('aria-expanded');
  expect(
    src,
    'Escape must close an open menu'
  ).toMatch(/['"]Escape['"]/);
});

// Mirrors "extend the project you are given". These packages were in the fixture's
// devDependencies before the task and nothing about building a mega menu requires
// removing them. Also self-protection: an agent that rewrites package.json without vitest
// breaks the harness, which then reports 0% while measuring nothing at all.
test('extends the existing project instead of replacing its config', () => {
  const installed = deps();
  for (const pkg of ['vitest', 'typescript', '@types/node', '@types/react', '@types/react-dom']) {
    expect(
      installed[pkg],
      `${pkg} was already in this project's devDependencies — add your dependencies to the existing package.json instead of overwriting it, and never drop entries you did not add`
    ).toBeDefined();
  }
  expect(
    installed['@uniformdev/next-app-router'],
    'the project already depends on @uniformdev/next-app-router'
  ).toBeDefined();
});

test('the mega menu is modeled and rendered the way the brief describes', async () => {
  await expect(environment).toSatisfyCriterion(
    'This is a Uniform CMS mega menu built in a Next.js App Router project, where the agent ' +
      'had to model the navigation components itself. Verify that: ' +
      '(1) navigation is decomposed into a chain of small components — a header/trigger, a ' +
      'category, a group of links, a link — where nesting and repetition are expressed as ' +
      'slots holding child components, rather than one component rendering the whole menu; ' +
      '(2) the category rail is built from data read out of the composition cache (raw child ' +
      'component instances), while the panel content for the active category is rendered by ' +
      'passing it through UniformSlot and filtering on the child _id — the panel content must ' +
      'NOT be reconstructed from raw parameter values, since that would discard ' +
      'personalization, pattern links and the visual editor\'s click targets; ' +
      '(3) the megaMenu layout branches on a display variant (not on an authored parameter), ' +
      'and falls back to a single panel when the flyout contains no categories; ' +
      '(4) a mobile layout renders each category as its own labelled section rather than ' +
      'relying on hover; and (5) a closed panel is not reachable by keyboard — for example ' +
      'it is marked inert, or is otherwise removed from the tab order while closed.'
  );
});
