import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { test, expect } from 'vitest';

// Assertions mirror the "Architecture essentials" section of the
// uniform-nextjs-app-router skill — each one is a documented failure mode
// of agents integrating Uniform without guidance.

const read = (p: string) => readFileSync(p, 'utf-8');
const firstExisting = (paths: string[]) => paths.find((p) => existsSync(p));

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

test('uses the App Router v2 SDK (@uniformdev/next-app-router)', () => {
  const pkg = JSON.parse(read('package.json'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  expect(
    deps['@uniformdev/next-app-router'],
    'expected @uniformdev/next-app-router as a dependency (the Page Router SDK does not support the App Router)'
  ).toBeDefined();
});

test('edge middleware resolves Uniform routes', () => {
  const mw = firstExisting(['middleware.ts', 'src/middleware.ts']);
  expect(mw, 'middleware.ts is required for Uniform routing').toBeDefined();
  const content = read(mw!);
  expect(content, 'Next.js 16 requires runtime: "experimental-edge"').toContain('experimental-edge');
  expect(content).toMatch(/uniformMiddleware|handleUniformRoute/);
});

test('composition route lives at app/uniform/[code], not a catch-all', () => {
  const page = firstExisting([
    'app/uniform/[code]/page.tsx',
    'src/app/uniform/[code]/page.tsx',
  ]);
  expect(page, 'expected app/uniform/[code]/page.tsx').toBeDefined();
  expect(read(page!)).toContain('UniformComposition');
});

test('UniformContext is not mounted in the root layout', () => {
  const layout = firstExisting(['app/layout.tsx', 'src/app/layout.tsx']);
  expect(layout).toBeDefined();
  expect(
    read(layout!),
    'UniformComposition handles context internally; mounting UniformContext in layout.tsx is wrong'
  ).not.toContain('UniformContext');
});

test('hero component is mapped via resolveComponent', () => {
  const contents = sourceFiles().map(read);
  expect(
    contents.some((c) => c.includes('resolveComponent') || c.includes('ResolveComponentFunction')),
    'expected a resolveComponent implementation (registerUniformComponent is the Page Router pattern)'
  ).toBe(true);
  expect(
    contents.some((c) => /['"`]hero['"`]/.test(c)),
    'expected the hero component type to be mapped'
  ).toBe(true);
});
