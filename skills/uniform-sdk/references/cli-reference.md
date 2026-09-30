# CLI reference

> **Official docs:** [Installation & setup](https://docs.uniform.app/docs/guides/cli/installation-and-setup) · [Common tasks](https://docs.uniform.app/docs/guides/cli/common-tasks) · [Troubleshooting](https://docs.uniform.app/docs/guides/cli/troubleshooting) · [Commands reference](https://docs.uniform.app/docs/guides/cli/commands)

## Required package

The Uniform CLI is contained in the `@uniformdev/cli` npm package. IMPORTANT: this package must be installed as a devDependency.

```bash
npm i -D @uniformdev/cli@latest
```

To invoke the CLI globally (e.g. before a project exists):

```bash
npm i @uniformdev/cli@latest -g
```

Verify installation:

```bash
npx uniform --version
```

## Authentication

The CLI requires an API key and project ID for every command. See [authentication.md](./authentication.md) for full details on API key types, permissions, environment variables, and CLI switches.

## Configuring the Uniform CLI

Uniform CLI is configured using the `uniform.config.{ts,js}` file in the root of a project. The config file is auto-located via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig#usage-for-end-users), or can be specified explicitly with `--config ./path/to/config.ts`.

The configuration controls four things:
- **Entities config** — which entity types to serialize and per-type overrides
- **Directory / file** — where to store serialized data (default `./uniform-data`)
- **Mode** — `mirror` (default), `createOrUpdate`, or `create`
- **Format** — `yaml` (default) or `json`

Configuration can be set at three levels of granularity: global, per entity type, and per `pull`/`push` command.

### Sync everything (initial setup)

```ts
import { uniformConfig } from "@uniformdev/cli/config";

export default uniformConfig({ preset: "all" });
```

A good default config for a typical project keeps the sync-everything preset but makes two idiomatic adjustments:

```ts
import { uniformConfig } from "@uniformdev/cli/config";

export default uniformConfig({
  preset: "all",
  overrides: {
    serializationConfig: {
      mode: "createOrUpdate",
      format: 'json'
    },
  },
  disableEntities: ["policyDocument", "webhook", "workflows"], // team-admin scoped; add others your key can't read
});
```

> **`disableEntities` (not `preset: "none"`):** `preset: "all"` syncs every entity type and will include new entities if they are added. It includes team-scoped ones. A standard developer API key often lacks access to those, and the sync **aborts** partway with `403 Access denied`. Switch off just the inaccessible ones with `disableEntities`. Use `preset: "none"` when you want complete control.

> **`mode: "createOrUpdate"`:** the default `mirror` mode makes the target an exact mirror of the source, which means a `push` **deletes** any entity that isn't present on disk. `createOrUpdate` only creates and updates, never deletes, which is the safe default. Ask the user if they want the `mirror` mode, this stops unused content and definitions from being left and can be useful in development.

> **`format: 'json'`:** the default yaml format can be hard to work with in node without depending on external packages. JSON on the other hand can easily be read and manipulated.

### Sync explicit types with customization

```ts
import { uniformConfig } from "@uniformdev/cli/config";

export default uniformConfig({
  preset: "none",
  config: {
    serialization: {
      // optionally override the default `./uniform-data` storage path
      directory: "./custom-path-to-serialized-files",
      // optionally change the default yaml format to json
      format: "json",
      entitiesConfig: {
        component: {},
        componentPattern: { publish: true },
      },
    },
  },
});
```

### Full entities config example

```ts
import type { CLIConfiguration } from "@uniformdev/cli";

const config: CLIConfiguration = {
  serialization: {
    format: "yaml",
    mode: "mirror",
    directory: "./uniform-data",
    entitiesConfig: {
      asset: {},
      composition: {
        push: { mode: "create" },
      },
      category: {},
      component: {},
      componentPattern: {},
      contentType: {},
      entry: {},
      entryPattern: {},
      dataType: {},
      signal: {},
      test: {},
      aggregate: {},
      enrichment: {},
      locale: {},
      quirk: {},
      projectMapDefinition: {},
      projectMapNode: {},
      redirect: {},
      workflow: {},
    },
  },
};

module.exports = config;
```

> Data sources cannot be synced because they generally contain secrets. They can be created directly via the CLI for scaffolding purposes.

## Primary commands

| Command | Description |
|---------|-------------|
| `uniform sync pull` | Pull online project state into serialized files |
| `uniform sync push` | Push serialized state (files on disk) into a Uniform project |

### Conventional package scripts

```json
{
  "scripts": {
    "uniform:pull": "uniform sync pull",
    "uniform:push": "uniform sync push"
  }
}
```

### Backup to a single file

Specify a filename (with `.yaml` or `.json` extension) instead of a directory to produce a single artifact:

```ts
const config: CLIConfiguration = {
  serialization: {
    directory: "./uniform-data.json",
    entitiesConfig: {
      composition: {},
      component: {},
    },
  },
};
```

## Command categories

Full command reference: [Commands docs](https://docs.uniform.app/docs/guides/cli/commands)

| Category | Command prefix | Entity types |
|---|---|---|
| [Sync](https://docs.uniform.app/docs/guides/cli/commands/sync) | `uniform sync` | All configured entities (pull / push) |
| [Canvas](https://docs.uniform.app/docs/guides/cli/commands/canvas) | `uniform canvas` | asset, component, composition, component-pattern, composition-pattern, category, contenttype, entry, entry-pattern, datasource, datatype, locale, preview-url, preview-viewport, workflow |
| [Context](https://docs.uniform.app/docs/guides/cli/commands/context) | `uniform context` | signal, enrichment, aggregate, quirk, test, manifest |
| [Project map](https://docs.uniform.app/docs/guides/cli/commands/project-map) | `uniform project-map` | definition, node |
| [Integration](https://docs.uniform.app/docs/guides/cli/commands/integration) | `uniform integration` | definition (register/remove), install/uninstall, edgehancer deploy/remove |
| [Redirect](https://docs.uniform.app/docs/guides/cli/commands/redirect) | `uniform redirect` | redirect definitions |
| [Webhook](https://docs.uniform.app/docs/guides/cli/commands/webhook) | `uniform webhook` | webhook definitions |
| [Policy docs](https://docs.uniform.app/docs/guides/cli/commands/policy-documents) | `uniform policy-document` | policy document definitions |

Most entity commands support the verbs: `get <id>`, `list`, `pull <path>`, `push <path>`, `update <file>`, `remove <id>`.

### Common flags

| Flag | Description |
|---|---|
| `-f, --format` | Output format: `yaml` (default) or `json` |
| `-o, --filename` | Write output to file instead of stdout |
| `-m, --mode` | `mirror` (default), `createOrUpdate`, or `create` — per-entity commands only (`uniform canvas component push` etc.). **`uniform sync push` has no `--mode` flag**; for sync the mode lives in `serialization.mode` (or a per-entity `push.mode`) in the config file. Verified against CLI 20.73 |
| `-w, --what-if` | Dry run — report changes without applying them |
| `-d, --diff` | Show changes: `off` (default), `update`, or `on` |
| `--apiHost` | Override Uniform host (default `https://uniform.app`) |
| `--proxy` | Proxy server (falls back to `HTTPS_PROXY` env var) |

### Context manifest download

```bash
uniform context manifest download --output ./path/to/contextManifest.json
```

### Integration commands

Integration commands require a team admin API key and `UNIFORM_TEAM_ID`:

```bash
uniform integration definition register ./mesh-manifest.json
uniform integration install <integration-type-id>
uniform integration uninstall <integration-type-id>
uniform integration definition edgehancer deploy --connectorType <type> --archetype <arch> --hook preRequest ./preRequest.mjs
```

## Critical rules

CRITICAL, NEVER IGNORE THIS RULE: Never use or manipulate in any way (create, read, update, or delete) YAML or JSON files that represent Uniform data (placed typically in the `uniform-data` folder) when trying to create, modify, or delete components, content types, or any other Uniform entity. Instead, always use the Uniform MCP tool. If you cannot resolve a Uniform MCP Server or any MCP action, return a graceful message to the user and abort.

IMPORTANT: Execute `npm run uniform:pull` after making any changes to Uniform data via MCP Server. This ensures you have the latest representation on disk.

### Worked example: creating content via MCP

A reliable end-to-end order for scaffolding components and a page via the Uniform MCP, then getting it onto disk and rendering. Two non-obvious facts drive the ordering:

1. Create the composition using the Uniform MCP (you may need `createUuid` to generate UUIDs)
2. Read the newly created composition via the Uniform MCP before performing edits
3. The Uniform MCP can not publish for security reasons. Publishing can be done with the CLI but ALWAYS ask the user for confirmation first
4. Serialize the new composition to disk after making programmatic changes

## Troubleshooting

> Full troubleshooting guide: [Troubleshooting docs](https://docs.uniform.app/docs/guides/cli/troubleshooting)

- **"Unknown arguments" error** — A required package is missing. For example, `uniform canvas component pull` fails if `@uniformdev/canvas` is not installed. Install the missing dependency.
- **Show version:** `uniform --version`
- **Show available commands:** `uniform --help`

## Help system

The Uniform CLI has a built-in help system:

```bash
uniform <command> --help
# Example:
uniform sync pull --help
```
