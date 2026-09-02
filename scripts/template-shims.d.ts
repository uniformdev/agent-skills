// Ambient stubs so `npm run typecheck:templates` can check templates that import
// framework modules, without installing those frameworks just to run a typecheck.

declare module 'next/headers' {
  export function cookies(): Promise<{
    get(name: string): { name: string; value: string } | undefined;
  }>;
}
