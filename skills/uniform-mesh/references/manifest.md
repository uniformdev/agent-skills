# Manifest

A Mesh integration is described by a `mesh-manifest.json`: an integration `type`,
display metadata, a `baseLocationUrl`, and a `locations` object declaring which parts of
the Uniform UI the integration extends. Keep one manifest per environment
(`mesh-manifest.{local,canary,stable}.json`) pointing `baseLocationUrl` at that
environment's host.

## The schema is the source of truth

**Do not hardcode manifest field names or shapes from memory** — they change across SDK
versions. The authoritative structure is a JSON schema (draft-07); read field definitions from
it and validate every manifest against it.

**Manifest JSON schema:** https://uniform.app/schemas/json-schema/mesh-manifest/v1.json

Reference it from each manifest so an editor validates as you type, and check it in CI:

```json
{
  "$schema": "https://uniform.app/schemas/json-schema/mesh-manifest/v1.json",
  "type": "your-integration-type",
  "displayName": "Your integration"
}
```

Required at the top level: `type`, `displayName`, `locations`.


## Locations that exist

The `locations` object can declare these (see the schema for the exact key and fields of
each; see `use-case-recipes.md` for which to pick):

- **install** — the install-time description shown when adding the integration
- **settings** — integration-wide configuration (non-secret only)
- **data connector** — connect an external system: a data source editor plus typed data
  archetypes with their data type and data resource (picker) editors, and optionally a data
  resource **selector** replacing the default JSON tree viewer (`dataResourceSelectorUrl`)
- **parameter type editor** — a custom editor for a Canvas component parameter
- **editor tool** — a tool/panel launched from inside the Canvas editor
- **personalization algorithm** — custom personalization
- **asset library / asset parameter** — an external asset provider
- **project tool** — a page in the project navigation
- **dashboard tool** — a page in the dashboard navigation

Under `locations`, the Canvas-related ones (parameter types, editor tools, personalization) are
grouped under a `canvas` key rather than sitting at the top level — the schema shows the exact
nesting. The schema also declares `ai`, `aiAgents`, and `tools` groups that this skill does not
cover; read it before assuming the list above is exhaustive.

Any editor URL you omit falls back to Uniform's built-in HTTP editor. Store secrets only
in data source values (encrypted); never in `settings` or data type values.
