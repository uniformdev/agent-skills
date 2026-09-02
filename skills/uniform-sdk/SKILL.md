---
name: uniform-sdk
description: Uniform SDK developer reference covering authentication, CLI configuration, routing, and the content API clients that read and write compositions, entries, and content types. Use when setting up Uniform in a frontend project, configuring the CLI, working with the Route API, or reading or writing Uniform content in code with EntryManagementClient, EntryDeliveryClient, CompositionManagementClient, or the deprecated CanvasClient and ContentClient.
license: MIT
metadata:
  author: uniformdev
  version: "0.0.1"
---

# Uniform SDK

Framework-agnostic developer reference for integrating Uniform into applications. Covers authentication, the Uniform CLI, routing via Project Map, and the content API clients used to read and write Uniform content from code.


## Key principles

### Always use MCP tools for content operations

CRITICAL: Never manipulate YAML or JSON files in the `uniform-data` folder directly. Always use the Uniform MCP tool for creating, modifying, or deleting components, content types, or any other Uniform entity. After making changes via MCP, run `npm run uniform:pull` to sync the latest state to disk.

### Pin all Uniform packages to the same version

All `@uniformdev/*` npm packages in a project must use the same version. Mismatched versions cause hard-to-debug dependency conflicts and runtime errors. When installing or upgrading, ensure every Uniform package resolves to the identical version number.

### SDK setup checklist

When adding Uniform SDK to a project:
1. Install the appropriate framework-specific packages (all at the same version)
2. Create a component in code for every composition component found in the Uniform project
3. Add all slots from the component definition
4. This ensures preview works correctly

## Resources

See `references/` for detailed guidance:
- [Authentication](references/authentication.md) — API keys, `.env` setup, permissions
- [CLI reference](references/cli-reference.md) — Configuration, push/pull commands, help system
- [Routing](references/routing.md) — Project Map and dynamic route delegation
- [Content API clients](references/clients.md) — Delivery vs management, reading and writing entries, field shapes, deprecated predecessors
