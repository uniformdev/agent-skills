import { readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';
import { environment } from '@vercel/agent-eval/eval';

// Brownfield eval: the fixture is a correct Uniform App Router project; the
// task adds a feature_list/feature component pair. Assertions check the
// component-mapping conventions from the skill's components.md and that the
// existing (correct) integration was not damaged along the way.

const read = (p: string) => readFileSync(p, 'utf-8');

function sourceFiles(dir = '.'): string[] {
  const skip = new Set(['node_modules', '.next', '.git', '.claude', '__agent_eval__']);
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = dir === '.' ? entry : `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && entry !== 'EVAL.ts') out.push(full);
  }
  return out;
}

const files = () => sourceFiles().map((f) => ({ f, content: read(f) }));

test('feature_list and feature are mapped in resolveComponent', () => {
  const resolver = read('components/resolveComponent.ts');
  expect(resolver, 'feature_list must be mapped').toMatch(/['"`]feature_list['"`]/);
  expect(resolver, 'feature must be mapped as its own component type').toMatch(/['"`]feature['"`]/);
});

test('features slot is rendered with UniformSlot', () => {
  const featureFiles = files().filter(({ content }) => /feature/i.test(content));
  expect(
    featureFiles.some(({ content }) => content.includes('UniformSlot')),
    'the features slot must render via UniformSlot (see components.md), not manual iteration'
  ).toBe(true);
});

test('text parameters use UniformText for inline editing', () => {
  const newComponents = files().filter(
    ({ f, content }) => /feature/i.test(content) && f.startsWith('components/')
  );
  expect(
    newComponents.some(({ content }) => content.includes('UniformText')),
    'inline-editable text must render via UniformText with component+parameter props'
  ).toBe(true);
  expect(
    newComponents.every(({ content }) => !content.includes('parameterId')),
    'parameterId is the Page Router API — the App Router SDK passes component + parameter'
  ).toBe(true);
});

test('existing integration is not damaged', () => {
  const resolver = read('components/resolveComponent.ts');
  expect(resolver).toMatch(/['"`]hero['"`]/);
  expect(resolver).toMatch(/['"`]page['"`]/);
  const middleware = read('middleware.ts');
  expect(middleware, 'middleware must keep the edge runtime').toContain('experimental-edge');
  expect(read('app/layout.tsx')).not.toContain('UniformContext');
});

test('new components follow server-component idioms', async () => {
  await expect(environment).toSatisfyCriterion(
    'The newly added feature_list/feature React components are server components consistent ' +
      'with the rest of the project: no "use client" directive, no client-side data fetching ' +
      '(useEffect/fetch-on-mount), and typed parameters wrapped in ComponentParameter<T>.'
  );
});
