/**
 * Structural checks on the committed Cursor plugin output. build-plugins --check proves the
 * files match the generator; these prove the generator produces something Cursor accepts,
 * against the schema in https://cursor.com/docs/reference/plugins.
 *
 * Run: npm run validate:plugins
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), 'utf8'));

const plugin = readJson('.cursor-plugin/plugin.json');
const marketplace = readJson('.cursor-plugin/marketplace.json');

/** The MCP config paths `mcpServers` names, relative to the plugin root (the repo root). */
function mcpConfigPaths() {
  const value = plugin.mcpServers;
  const entries = Array.isArray(value) ? value : [value];
  return entries.filter((entry) => typeof entry === 'string');
}

const PLUGIN_FIELDS = new Set([
  'name', 'description', 'version', 'author', 'homepage', 'repository', 'license', 'keywords',
  'logo', 'rules', 'agents', 'skills', 'commands', 'hooks', 'mcpServers', 'variables',
]);
const VARIABLE_KEYWORDS = new Set([
  'type', 'title', 'description', 'default', 'enum', 'const', 'properties', 'required', 'items',
  'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'pattern',
]);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test('plugin.json uses only documented Cursor fields', () => {
  for (const key of Object.keys(plugin)) {
    assert.ok(PLUGIN_FIELDS.has(key), `unsupported field "${key}"`);
  }
  assert.match(plugin.name, KEBAB);
  assert.deepEqual(Object.keys(plugin.author).filter((k) => !['name', 'email'].includes(k)), []);
  assert.equal(typeof plugin.author.name, 'string');
});

test('mcpServers points to an existing file', () => {
  assert.ok(plugin.mcpServers, 'plugin.json declares no mcpServers');
  assert.equal(plugin.mcp, undefined, 'legacy "mcp" key must not be emitted');
  const paths = mcpConfigPaths();
  assert.ok(paths.length > 0, 'mcpServers names no config file');
  for (const path of paths) {
    assert.ok(existsSync(join(repoRoot, path)), `${path} does not exist`);
  }
});

test('variables is an object schema using only supported keywords', () => {
  const { variables } = plugin;
  assert.equal(variables.type, 'object');
  assert.equal(typeof variables.properties, 'object');
  for (const [name, schema] of Object.entries(variables.properties)) {
    for (const key of Object.keys(schema)) {
      assert.ok(VARIABLE_KEYWORDS.has(key), `variable ${name} uses unsupported "${key}"`);
    }
  }
  for (const name of variables.required ?? []) {
    assert.ok(name in variables.properties, `required variable ${name} is not declared`);
  }
});

test('every Cursor MCP placeholder has a declared variable', () => {
  const declared = new Set(Object.keys(plugin.variables.properties));
  for (const path of mcpConfigPaths()) {
    const raw = readFileSync(join(repoRoot, path), 'utf8');
    const placeholders = [...raw.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]);
    assert.ok(placeholders.length > 0, `${path} has no placeholders — is the binding gone?`);
    for (const name of placeholders) {
      assert.ok(declared.has(name), `${path} uses \${${name}} but variables does not declare it`);
    }
  }
});

test('Cursor output contains no Claude ${user_config.*} placeholders', () => {
  const files = ['.cursor-plugin/plugin.json', '.cursor-plugin/marketplace.json', ...mcpConfigPaths()];
  for (const path of files) {
    assert.doesNotMatch(readFileSync(join(repoRoot, path), 'utf8'), /\$\{user_config\./, path);
  }
});

test('marketplace.json follows the Cursor marketplace schema', () => {
  const allowed = new Set(['name', 'owner', 'metadata', 'plugins']);
  for (const key of Object.keys(marketplace)) {
    assert.ok(allowed.has(key), `unsupported top-level field "${key}"`);
  }
  assert.match(marketplace.name, KEBAB);

  assert.equal(typeof marketplace.owner?.name, 'string');
  for (const key of Object.keys(marketplace.owner)) {
    assert.ok(['name', 'email'].includes(key), `unsupported owner field "${key}"`);
  }

  if (marketplace.metadata) {
    for (const key of Object.keys(marketplace.metadata)) {
      assert.ok(['description', 'version', 'pluginRoot'].includes(key), `unsupported metadata "${key}"`);
    }
  }
  assert.equal(typeof marketplace.metadata?.description, 'string');

  assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0);
  for (const entry of marketplace.plugins) {
    assert.match(entry.name, KEBAB);
    assert.equal(typeof entry.source, 'string');
  }
});
