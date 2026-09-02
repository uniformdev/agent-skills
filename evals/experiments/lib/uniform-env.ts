/**
 * Real Uniform test-project credentials, when configured (evals/.env locally,
 * repository secrets in CI). Returns a writeFiles map overwriting the
 * fixture's placeholder .env, or null when no credentials are configured —
 * fixtures that only assert on project state work fine with placeholders.
 */
export function uniformEnvFiles(): Record<string, string> | null {
  const { UNIFORM_API_KEY, UNIFORM_PROJECT_ID, UNIFORM_PREVIEW_SECRET } = process.env;
  if (!UNIFORM_API_KEY || !UNIFORM_PROJECT_ID) return null;
  const lines = [
    `UNIFORM_API_KEY=${UNIFORM_API_KEY}`,
    `UNIFORM_PROJECT_ID=${UNIFORM_PROJECT_ID}`,
    ...(UNIFORM_PREVIEW_SECRET ? [`UNIFORM_PREVIEW_SECRET=${UNIFORM_PREVIEW_SECRET}`] : []),
  ];
  return { '.env': lines.join('\n') + '\n' };
}
