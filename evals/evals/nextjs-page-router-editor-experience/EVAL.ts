import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';

// Apply fixture for `uniform-editor-experience-review` on the Page Router: the twin of
// `nextjs-editor-experience`, built the way `nextjs-page-router-breadcrumbs` twins `nextjs-breadcrumbs`.
// Same PROMPT.md, byte for byte — it describes only symptoms, so it ports without a word changing. What
// differs is the fixture (canvas-next + canvas-react, getServerSideProps, registerUniformComponent) and the
// four checks only the Page Router has: per-slot `emptyPlaceholder`, the `global` selection hook, a
// module-scope `wrapperComponent`, and the experimental playground `decorators`.
//
//   Button, Image   return null when empty — also in the editor
//   Section         hand-rolled placeholder-id test; aside hidden while empty; `> * + *` spacing
//   Carousel        ungated autoplay; only the active slide mounted; no way to follow selection;
//                   wrapperComponent declared inside the render
//   AccordionItem   closed panel unmounted
//   Tabs            one panel mounted (through a wrapperComponent declared inside the render)
//   Page, Section   no emptyPlaceholder on the layout-critical slots
//   playground      patterns shown bare
//   Hero            negative control: UniformText with placeholders, nothing to fix
//
// The App Router seeds with no Page Router counterpart are left out: the Page Router UniformRichText shows
// its own placeholder, and Tabs reads its labels from slot data rather than a hand-built `_contextualEditing`.

const read = (p: string) => readFileSync(p, 'utf-8');

function collect(dir = '.'): string[] {
  const skip = new Set([
    'node_modules', '.next', '.git', '.claude', '.agents', '.cursor', '.copilot-plugin',
    '.skills-src', '__agent_eval__',
  ]);
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = dir === '.' ? entry : `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.(ts|tsx|js|jsx|css)$/.test(entry) && entry !== 'EVAL.ts') out.push(full);
  }
  return out;
}

// Comments are stripped before matching: quoting a rule back in a comment neither passes nor fails.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sourceFiles = () =>
  collect()
    .filter((f) => !f.endsWith('.css'))
    .map((f) => ({ f, content: stripComments(read(f)) }));
const code = () => sourceFiles().map(({ content }) => content).join('\n');
const cssText = () =>
  collect()
    .filter((f) => f.endsWith('.css'))
    .map((f) => read(f).replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');

// A component's files: the seeded ones plus anything the agent split out under its name.
const componentCode = (name: RegExp) =>
  sourceFiles()
    .filter(({ f }) => name.test(f.split('/').pop() ?? ''))
    .map(({ content }) => content)
    .join('\n');

// Gate helpers the agent defines (`useEditorGates`, `isEditTab`, …): top-level declarations whose body
// reads the signal. A component calling one is gated even though the signal lives in another file.
function gateHelpers(signal: RegExp): string[] {
  const names = new Set<string>();
  for (const { content } of sourceFiles()) {
    for (const chunk of content.split(/\n(?=(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|function)\s)/)) {
      const m = chunk.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|function)\s+(\w+)/);
      if (m && signal.test(chunk)) names.add(m[1]);
    }
  }
  return [...names];
}

const EDIT_TAB = /previewMode/;
const ANY_EDITOR_SIGNAL = /previewMode|isContextualEditing/;
const references = (text: string, signal: RegExp) =>
  signal.test(text) || gateHelpers(signal).some((name) => new RegExp(`\\b${name}\\b`).test(text));
const usesEditTab = (text: string) => references(text, EDIT_TAB);
const usesEditorSignal = (text: string) => references(text, ANY_EDITOR_SIGNAL);

// A `{…}` attribute value with its braces balanced. Page Router props hold JSX of their own
// (`emptyPlaceholder={<div style={{ minHeight: 120 }} />}`), so a lazy match to the first `}` or `/>`
// would cut them short.
function braced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}
const attributeValues = (text: string, attr: string) =>
  [...text.matchAll(new RegExp(`\\b${attr}\\s*=\\s*\\{`, 'g'))].map((m) =>
    braced(text, m.index! + m[0].length - 1).trim()
  );

// Opening JSX tags matched whole: from `<Tag` to the first `>` outside a `{…}` prop value.
function openingTags(text: string, tag: string): { tag: string; text: string }[] {
  const out: { tag: string; text: string }[] = [];
  for (const m of text.matchAll(new RegExp(`<(${tag})\\b`, 'g'))) {
    let depth = 0;
    for (let i = m.index! + m[0].length; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      else if (text[i] === '>' && depth === 0) {
        out.push({ tag: m[1], text: text.slice(m.index!, i + 1) });
        break;
      }
    }
  }
  return out;
}

// Module scope, read from indentation the way the skill's own S7 check reads it: formatted code declares
// module-level bindings at column 0 and everything inside a function body indented. Imports are module
// scope by definition. A name declared again inside a body shadows the module-level one.
const escapeName = (name: string) => name.replace(/\$/g, '\\$');
const declares = (src: string, name: string) =>
  new RegExp(
    `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class)\\s+${escapeName(name)}\\b`,
    'm'
  ).test(src);
const imports = (src: string, name: string) =>
  new RegExp(
    `^import\\s+(?:type\\s+)?(?:[\\w$]+\\s*,\\s*)?(?:\\{[^}]*\\b${escapeName(name)}\\b[^}]*\\}|\\*\\s+as\\s+${escapeName(name)}\\b|${escapeName(name)}\\b)`,
    'm'
  ).test(src);
const declaresInsideABody = (src: string, name: string) =>
  new RegExp(`^[ \\t]+(?:const|let|var|function\\*?|class)\\s+${escapeName(name)}\\b`, 'm').test(src);

// Placeholders and hints change the look, so they belong to the Edit tab: isContextualEditing is true
// in the Preview tab too, where authors check the page as visitors see it. One test for every component
// that gains an editor-only state, so this one gap fails once.
test('editor-only states are gated on the Edit tab', () => {
  const gated: [RegExp, string][] = [
    [/^Button/, 'the empty button'],
    [/^Image/, 'the image placeholder'],
    [/^Section/, 'the empty aside'],
    [/carousel/i, 'stopped autoplay'],
  ];
  for (const [name, what] of gated) {
    expect(
      componentCode(name),
      `${what} shows only in the Edit tab — isContextualEditing alone is also true in the Preview tab; ` +
        'gate on useUniformContextualEditingState().previewMode === "editor"'
    ).toSatisfy(usesEditTab);
  }
});

// The slots the page is laid out in. Each is a vertical content area or its own column, so the skill's
// opt-out — `emptyPlaceholder={null}`, for an optional slot the layout has no room for — fits none of
// them. Other slots (slides, tabs, accordion items) are left to the agent.
const LAYOUT_CRITICAL: [RegExp, string, string][] = [
  [/^Page/, 'content', "Page's content slot (the page body)"],
  [/^Section/, 'content', "Section's content slot"],
  [/^Section/, 'aside', "Section's aside slot (a column of its own)"],
];

test('layout-critical slots get an emptyPlaceholder', () => {
  // A placeholder that is present and not switched off. Its size is not asserted: it may come from a
  // shared helper (`emptyPlaceholder={<SlotPlaceholder minHeight={120} />}`) or a class.
  const placeholderSet = (tag: string) =>
    attributeValues(tag, 'emptyPlaceholder').some((v) => !/^(null|undefined)$/.test(v));

  for (const [file, slot, what] of LAYOUT_CRITICAL) {
    const named = new RegExp(`\\bname\\s*=\\s*(?:"${slot}"|'${slot}'|\\{\\s*["'\`]${slot}["'\`]\\s*\\})`);
    // UniformSlot itself, or a project helper that renders one (`<SizedSlot name="content" />`).
    const slots = openingTags(componentCode(file), '[A-Z][\\w.]*Slot').filter(({ text }) => named.test(text));
    expect(slots.length, `${what} must still be rendered`).toBeGreaterThan(0);

    for (const { tag, text } of slots) {
      const where =
        tag === 'UniformSlot'
          ? [text]
          : sourceFiles()
              .filter(({ content }) => declares(content, tag))
              .flatMap(({ content }) => openingTags(content, 'UniformSlot').map((t) => t.text));
      expect(
        where,
        `${what} needs a sized emptyPlaceholder — on the Page Router each <UniformSlot> takes its own, ` +
          'e.g. emptyPlaceholder={<div style={{ minHeight: 120 }} />}; without one an empty slot has no ' +
          'drop target, and null switches it off'
      ).toSatisfy((tags: string[]) => tags.some(placeholderSet));
    }
  }

  expect(
    code(),
    'resolveEmptyPlaceholder is the App Router API; the Page Router UniformComposition ignores it'
  ).not.toMatch(/resolveEmptyPlaceholder/);
});

test('Section slot logic survives the editor', () => {
  const src = code();
  expect(
    src,
    'use isComponentPlaceholderId, the SDK predicate; a hand-rolled test such as startsWith("placeholder_") misses the bare "placeholder" id'
  ).not.toMatch(/(startsWith|includes)\(\s*['"`]placeholder/);
  expect(src).toContain('isComponentPlaceholderId');
  expect(
    cssText(),
    'while editing, the SDK wraps slot children in <template> markers; `> * + *` counts them — use gap'
  ).not.toMatch(/>\s*\*\s*\+\s*\*/);
});

const GLOBAL_SELECTION = /useUniformContextualEditingState\s*\(\s*\{[^}]*\bglobal\s*:\s*true\b[^}]*\}\s*\)/;

test('the carousel follows the Canvas selection', () => {
  const carousel = componentCode(/carousel/i);
  expect(
    carousel,
    'selecting a slide in the component tree should bring it into view: read selectedComponentReference'
  ).toSatisfy((text: string) => references(text, /selectedComponentReference/));
  expect(
    carousel,
    'call useUniformContextualEditingState({ global: true }) — by default the hook reports only direct ' +
      'children of the calling component, so a heading selected inside a slide never moves the carousel'
  ).toSatisfy((text: string) => references(text, GLOBAL_SELECTION));
});

test('slides, tab panels and accordion panels stay mounted and reachable', () => {
  const src = code();
  const unmounted = 'rendering only the active item drops the others — and their editor markers — from the DOM';
  expect(src, unmounted).not.toMatch(/\{\s*(slides|panels)\s*\[\s*\w+\s*\]\s*\}/);

  const accordion = componentCode(/accordion/i);
  expect(accordion, unmounted).not.toMatch(/\b(isOpen|open|expanded)\s*&&\s*\(?\s*</);
  expect(accordion, 'closed panels need a way in: forced open in the Edit tab, or opened when selected').toSatisfy(
    usesEditorSignal
  );
});

// An inline or nested wrapper is a new component type on every render. Canvas pushes a new composition
// on every edit, so React unmounts and remounts the whole slot subtree each time — a carousel jumps back
// to slide 1, an open panel closes. Only a binding declared at module scope (or imported) keeps one type.
test('wrapperComponent is declared at module scope', () => {
  // The value must be a plain (or dotted) name, bound at module scope in the file that passes it and not
  // shadowed inside a body. An arrow, `useCallback(…)` or `memo(…)` written in the prop is not.
  const atModuleScope = (src: string) => (value: string) => {
    const root = value.replace(/\s+as\s+[\s\S]*$/, '').match(/^([A-Za-z_$][\w$]*)(?:\.[\w$]+)*$/)?.[1];
    return !!root && (declares(src, root) || imports(src, root)) && !declaresInsideABody(src, root);
  };
  for (const { f, content } of sourceFiles()) {
    for (const value of attributeValues(content, 'wrapperComponent')) {
      // A slot helper forwarding its own prop is checked where that prop is set.
      if (/^(?:[\w$]+\.)?wrapperComponent$/.test(value)) continue;
      expect(
        value,
        `${f}: declare the wrapperComponent at module scope, not inline or inside the parent component — ` +
          'it is remounted with everything in the slot on every editor update; pass state such as the ' +
          'active index through a React context the parent provides around the UniformSlot'
      ).toSatisfy(atModuleScope(content));
    }
  }
});

// The project's own module-level declarations reachable from `seed`, read as whole files: the decorator,
// the frame it renders, and the constants beside them (`const chrome = { [IS_RENDERED_BY_UNIFORM_ATTRIBUTE]: "" }`).
function reachable(seed: string, depth = 4) {
  const files = sourceFiles();
  const names = new Set<string>();
  const reached = new Map<string, string>();
  let frontier = seed;
  for (let i = 0; i < depth && frontier; i++) {
    let next = '';
    for (const name of new Set(frontier.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
      if (names.has(name)) continue;
      for (const { f, content } of files.filter(({ content }) => declares(content, name))) {
        names.add(name);
        if (!reached.has(f)) {
          reached.set(f, content);
          next += `\n${content}`;
        }
      }
    }
    frontier = next;
  }
  return { names, files: reached };
}

test('patterns get a playground-only frame with clickable controls', () => {
  const playground = sourceFiles().flatMap(({ content }) => openingTags(content, 'UniformPlayground'));
  expect(playground.length, 'the playground route must still render UniformPlayground').toBeGreaterThan(0);

  const decorators = playground.flatMap(({ text }) => attributeValues(text, 'decorators'));
  expect(
    decorators,
    'frame patterns with a decorator: the Page Router UniformPlayground takes decorators={[PatternFrame]}, ' +
      'which wraps the pattern and receives its root instance as data'
  ).not.toEqual([]);

  const seed = decorators.join('\n');
  const { names, files } = reachable(seed);
  const frame = [seed, ...files.values()].join('\n');
  expect(
    frame,
    'Canvas turns Edit-tab clicks into selections unless the target sits inside ' +
      'IS_RENDERED_BY_UNIFORM_ATTRIBUTE — put it on the frame chrome, or the width buttons never fire'
  ).toMatch(/IS_RENDERED_BY_UNIFORM_ATTRIBUTE|data-is-rendered-by-uniform/);
  expect(
    frame,
    'key the frame by the pattern type (key={componentType ?? "pending"}): the playground first renders ' +
      'a stand-in composition, and state initialised from its type never picks up the real one'
  ).toMatch(/\bkey\s*=\s*\{[^}]*(?:\btype\b|[a-z][\w$]*Type\b)/);

  // The decorators themselves, and every component declared beside the frame chrome.
  const chromeFiles = [...files.values()].filter((c) => /IS_RENDERED_BY_UNIFORM_ATTRIBUTE|data-is-rendered-by-uniform/.test(c));
  const frameComponents = [...names].filter(
    (n) => /^[A-Z]/.test(n) && (new RegExp(`\\b${escapeName(n)}\\b`).test(seed) || chromeFiles.some((c) => declares(c, n)))
  );
  for (const route of ['pages/[[...path]].tsx', 'pages/_app.tsx'].filter((p) => existsSync(p))) {
    const src = stripComments(read(route));
    for (const name of frameComponents) {
      expect(src, `${name} is authoring UI for patterns only — compositions must not render it`).not.toMatch(
        new RegExp(`<${escapeName(name)}\\b`)
      );
    }
  }
});
