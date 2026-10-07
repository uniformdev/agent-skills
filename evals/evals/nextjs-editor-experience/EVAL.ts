import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';

// Apply fixture for `uniform-editor-experience-review` (App Router). Every component is seeded with
// an editor-experience gap the skill names; the prompt describes only the symptoms and says to apply
// everything recommended (the skill's own skip-the-question rule — the harness is headless).
//
//   Button, Image   return null when empty — also in the editor
//   RichText        relies on UniformRichText's placeholder, which the App Router never shows
//   Section         hand-rolled placeholder-id test; aside hidden while empty; `> * + *` spacing
//   Carousel        ungated autoplay; only the active slide mounted; no way to follow selection
//   AccordionItem   closed panel unmounted
//   Tabs            hand-built `_contextualEditing` (contentEditable on the live site); one panel mounted
//   pages           no resolveEmptyPlaceholder
//   playground      patterns shown bare

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

// Gate helpers the agent defines (`isEditTab`, …): top-level declarations whose body reads the
// signal. A component calling one is gated even though the signal lives in another file.
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

// JSX elements matched whole (props span lines), from the tag to its self-closing end.
const elements = (text: string, tag: string) => text.match(new RegExp(`<${tag}\\b[\\s\\S]*?\\/>`, 'g')) ?? [];

// Placeholders and hints change the look, so they belong to the Edit tab: isContextualEditing is true
// in the Preview tab too, where authors check the page as visitors see it. One test for every component
// that gains an editor-only state, so this one gap fails once.
test('editor-only states are gated on the Edit tab', () => {
  const gated: [RegExp, string][] = [
    [/^Button/, 'the empty button'],
    [/^Image/, 'the image placeholder'],
    [/^RichText/, 'the empty rich-text hint'],
    [/^Section/, 'the empty aside'],
    [/carousel/i, 'stopped autoplay'],
  ];
  for (const [name, what] of gated) {
    expect(
      componentCode(name),
      `${what} shows only in the Edit tab — isContextualEditing alone is also true in the Preview tab; ` +
        'gate on pageState.previewMode === "editor"'
    ).toSatisfy(usesEditTab);
  }
});

test('empty rich text renders its own hint', () => {
  // What is left once UniformRichText is removed must still say something: a text child, an expression
  // child, or a string prop such as `label="…"`.
  const outside = componentCode(/^RichText/).replace(/<UniformRichText\b[\s\S]*?\/>/g, '');
  expect(
    outside,
    'the App Router UniformRichText never renders its placeholder, so an empty field shows nothing in ' +
      'Canvas unless the component renders its own hint'
  ).toMatch(/>[^<>{}]*[A-Za-z][^<>{}]*<\/|>\s*\{[^{}]+\}\s*<\/|\b(?!className\b|as\b|key\b)[a-z]\w*=["'`][^"'`]*[A-Za-z]/);
});

test('empty slots get placeholders through resolveEmptyPlaceholder', () => {
  const src = code();
  const roots = [...elements(src, 'UniformComposition'), ...elements(src, 'UniformPlayground')];
  expect(roots.length, 'the composition and playground routes must still render').toBeGreaterThanOrEqual(2);
  for (const el of roots) {
    expect(
      el,
      'the App Router resolves empty-slot placeholders centrally; patterns are edited in the ' +
        'playground, so it needs the resolver too'
    ).toContain('resolveEmptyPlaceholder');
  }
  expect(src, 'emptyPlaceholder is the Page Router UniformSlot API').not.toMatch(/emptyPlaceholder\s*=/);
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

test('the carousel follows the Canvas selection', () => {
  const src = code();
  expect(src, 'selecting a slide in the component tree should bring it into view').toContain(
    'selectedComponentReference'
  );
  expect(src, 'the App Router has no selection hook; it arrives over the Canvas channel').toMatch(
    /createCanvasChannel|__UNIFORM_CONTEXTUAL_EDITING__/
  );
  expect(
    src,
    'the canvas-react hook reads a context the App Router never provides — silently inert'
  ).not.toMatch(/useUniformContextualEditingState|from\s+['"]@uniformdev\/canvas-react['"]/);
});

test('slides, tab panels and accordion panels stay mounted and reachable', () => {
  const src = code();
  const unmounted = 'rendering only the active item drops the others — and their editor markers — from the DOM';
  expect(src, unmounted).not.toMatch(/\{\s*(slides|panels|items)\s*\[\s*\w+\s*\]\s*\}/);

  const accordion = componentCode(/accordion/i);
  expect(accordion, unmounted).not.toMatch(/\b(isOpen|open|expanded)\s*&&\s*\(?\s*</);
  expect(accordion, 'closed panels need a way in: forced open in the Edit tab, or opened when selected').toSatisfy(
    usesEditorSignal
  );
});

test('tab labels are not made editable with a hand-built _contextualEditing', () => {
  expect(
    code(),
    'the SDK attaches _contextualEditing only in editor state; a hand-built one makes the label ' +
      'contentEditable for every visitor'
  ).not.toMatch(/_contextualEditing\s*:\s*\{/);
});

test('patterns get a playground-only frame with clickable controls', () => {
  const page = sourceFiles().find(({ content }) => /<UniformPlayground\b/.test(content));
  const before = page ? page.content.slice(0, page.content.search(/<UniformPlayground\b/)) : '';
  const wrappers = [
    ...new Set(
      [...before.matchAll(/<([A-Z][A-Za-z0-9_.]*)\b[^>]*?(?<!\/)>/g)]
        .map((m) => m[1])
        .filter((n) => !/^(Suspense|Fragment|React\.Fragment)$/.test(n))
    ),
  ];
  expect(
    wrappers.length,
    'the App Router UniformPlayground has no decorators; a frame must wrap it in the playground page'
  ).toBeGreaterThan(0);

  const definitionOf = (name: string) =>
    sourceFiles().find(({ content }) => new RegExp(`(?:function|const|class)\\s+${name}\\b`).test(content))
      ?.content ?? '';
  expect(
    [page?.content ?? '', ...wrappers.map(definitionOf)].join('\n'),
    'Canvas turns Edit-tab clicks into selections unless the target sits inside ' +
      'IS_RENDERED_BY_UNIFORM_ATTRIBUTE — without it the width buttons never fire'
  ).toMatch(/IS_RENDERED_BY_UNIFORM_ATTRIBUTE|data-is-rendered-by-uniform/);

  const compositionRoute = stripComments(read('app/uniform/[code]/page.tsx'));
  for (const name of wrappers) {
    expect(compositionRoute, `${name} is authoring UI for patterns only`).not.toMatch(new RegExp(`<${name}\\b`));
  }
});
