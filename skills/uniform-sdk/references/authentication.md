# Authentication

## API keys

Uniform uses API keys for both frontend apps and CLI access. Use **separate keys** for each concern:

- `UNIFORM_API_KEY` — read-only key used by your frontend application at runtime.
- `UNIFORM_CLI_API_KEY` — key used by the CLI, typically with write permissions.

### Permissions

- **Frontend apps**: The API key requires "Read Published Compositions" permission.
- **CLI usage**: The API key requires read and write permissions to any entity types that are to be synced. The default "Developer" role present is a shortcut to full permissions.

### Setting up

API keys are created in the Uniform dashboard by the user. If the required environment variables are missing, prompt the user to provide them rather than generating placeholder values.

## Environment variables

Typical `.env` configuration:

```bash
UNIFORM_API_KEY=uf......                     # read-only, used by the app
UNIFORM_CLI_API_KEY=uf......                 # read/write, used by the CLI
UNIFORM_PROJECT_ID=your-project-id
UNIFORM_PROJECT_MAP_ID=your-project-map-id   # optional
UNIFORM_PREVIEW_SECRET=hello-world           # arbitrary value for preview validation
```

## CLI command switches

As an alternative to environment variables, you can pass credentials directly:

| Value | Switch |
|---|---|
| API key | `--apiKey` |
| Project ID | `-p`, `--project` |

Example:

```bash
uniform canvas composition list --apiKey <key> --project <project-id>
```
