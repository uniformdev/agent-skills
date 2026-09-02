#!/usr/bin/env node
/**
 * validate-skills — run `skills-ref validate` over every skill in `skills/`.
 *
 * Globbing rather than enumerating means a new skill directory is covered the moment
 * it exists; there is no list to forget to update. `skills-ref validate` takes one
 * path per invocation, hence the loop.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(repoRoot, 'skills');

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, 'SKILL.md')))
  .map((entry) => entry.name)
  .sort();

if (skills.length === 0) {
  console.error(`No skills found in ${skillsDir}`);
  process.exit(1);
}

const failed = [];
for (const skill of skills) {
  const result = spawnSync('npx', ['skills-ref', 'validate', join('skills', skill)], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) failed.push(skill);
}

console.log(`\n${skills.length - failed.length}/${skills.length} skills valid`);
if (failed.length > 0) {
  console.error(`Failed: ${failed.join(', ')}`);
  process.exit(1);
}
