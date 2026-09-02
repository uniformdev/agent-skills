# Use case recipes

Pick the location(s) and components for a given use case, then follow the build workflow.
For the exact manifest keys and fields of any location, read the schema (see `manifest.md`).

## Custom data connector

Connect an external system so authors browse and select records from it.

- **Location**: a data connector — a data source editor plus archetypes, each with a data
  type editor and a data resource (picker) editor. Optionally a **data resource selector**
  (`dataResourceSelectorUrl`) when authors need domain-specific UI for choosing a value
  *inside* the fetched JSON instead of the default tree viewer.
- **SDK**: `useMeshLocation<'dataSource' | 'dataType' | 'dataResource'>()` — plus
  `'dataResourceSelector'` for the selector — `getDataResource`,
  `DataResourceDynamicInputProvider`, `ObjectSearchProvider` / `ObjectSearchContainer` /
  `ObjectSearchResultList`, `InputVariables`.
- **Components**: `Input`/`InputSelect` (connection + type config), `ScrollableList` or the
  `ObjectSearch*` result list (picker), `LoadingOverlay`, `Callout`.
- **Secrets**: in the data source value only (`custom` + header/parameter values are
  encrypted).
- **Deep dive**: `data-connector.md`.

## Custom Canvas parameter editor

A custom editor for a component parameter in the Canvas visual editor.

- **Location**: a parameter type editor, with an optional separate config editor for the
  author-defined settings.
- **SDK**: `useMeshLocation<'paramType', TValue>('paramType')` for the editor;
  `useMeshLocation<'paramTypeConfig'>()` for the config editor.
- **Components**: whatever fits the value — `SegmentedControl`, `InputSelect`,
  `KeyValueInput`, `Input`, `InputToggle`. Return validity via `ValidationResult`.
- **Note**: `paramType` is the one location whose hook takes a string argument.

## Editor tool

A tool/panel launched from inside the Canvas editor, optionally scoped to certain editor
types (composition, component pattern, entry, …).

- **Location**: an editor tool.
- **SDK**: `useMeshLocation<'editorTools'>()` for the current editor context.

## Asset library provider

Bring external assets (DAM) into the Uniform Asset Library and asset parameters.

- **Location**: an asset library provider and/or an asset parameter type.
- **SDK**: asset value/metadata types (`DamItem`, `AssetParamValueItem`) via
  `useMeshLocation`.
- **Components**: `ObjectGridContainer` / grid + `Pagination`, `Skeleton` for loading
  tiles, `DebouncedInputKeywordSearch`.

## Dashboard tool / project tool

Add a custom page to the dashboard nav (dashboard-wide) or the project nav (per project).

- **Location**: a dashboard tool or a project tool.
- **SDK**: `useMeshLocation<'dashboardTool' | 'projectTool'>()`; navigate with
  `router.navigatePlatform(...)`.
- **Components**: `Container`, `Heading`, `Table`, `Button` — a normal page built from
  design-system primitives.

## Integration-wide settings

- **Location**: settings. Read/write via `useMeshLocation<'settings'>()`. Non-secret
  configuration only — secrets belong in a data source.

## Examples and reference

- Mesh integration starter kit and example integrations:
  https://github.com/uniformdev/examples/tree/main/mesh
- Reference manifest (every location, annotated):
  https://github.com/uniformdev/examples/blob/main/mesh/mesh-integration/mesh-manifest.reference.json
- Dozens of production connectors (Contentful, Algolia, commercetools, Contentstack, …)
  are a strong by-example source for real data source / data type / data resource editors.
