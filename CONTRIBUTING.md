# Contributing

Thanks for helping improve Uniform's agent skills. This guide covers what to change,
where, and what to run before opening a pull request.

## What a skill is

A skill is a set of instructions for doing a job — not a copy of the documentation. Each
lives in `skills/<name>/`:

```text
skills/uniform-<topic>/
  SKILL.md        # frontmatter (name, description) + the instructions
  references/     # deeper material, loaded on demand
```

Only the `name` and `description` are loaded into the agent's context at startup. The body
and anything under `references/` load when the agent decides the skill is relevant, so the
description is the entire activation lever — write it as the thing that has to match a
user's phrasing, not as a title.

Two guidelines that resolve most authoring questions:

- **Instructions over reference.** Write the sequence of moves for a task, the decisions
  inside it, and the traps. A skill that restates API surface goes stale faster than the
  documentation does and costs tokens every time it loads.
- **Defer when the answer is in the installed package; inline it when it is not.** If a
  fact lives in `node_modules` (types, JSDoc, exports), teach the agent to find it — give
  the grep, not the list. If it lives only in a hosted document, or nowhere, inline it.

`SKILL.md` should stay under 500 lines, per the Agent Skills specification. Reference
files have no hard limit; keep one topic per file.

If you use Claude Code or Cursor on this repository, a contributor skill
(`creating-uniform-agent-skills`) is checked in and will activate when you start authoring.

## Adding a skill

1. Create `skills/uniform-<topic>/SKILL.md`. The `name` in the frontmatter must match the
   directory name.
2. Add `references/` files for setup, examples, and deeper material.
3. Verify every claim against the shipped packages, not from memory. Where types and prose
   disagree, the types win.
4. Run `npm run validate` — it globs `skills/`, so a new directory is picked up with no
   other wiring.
5. Run `npm run build:plugins`. Skill descriptions feed the generated manifests and the
   README skill table, so a description change without a rebuild fails CI.
6. Add an eval if the skill makes claims worth defending — see [`evals/README.md`](evals/README.md).

## Changing an existing skill

Update the single authoritative file rather than adding a second explanation elsewhere;
two skills should not restate the same constraint. Grep before you add, and link instead
of duplicating. Then run `npm run validate` and `npm run build:plugins`, and check that the
skill's evals still pass if it has any.

## Generated plugin manifests

This repository *is* the plugin, and its root is the plugin root. Every client manifest is
generated from one source file — never hand-write them:

```text
plugin.source.json          ← the only file you edit
        │
        └── scripts/build-plugins.mjs
                │
                ├── .claude-plugin/{plugin,marketplace}.json
                ├── .cursor-plugin/{plugin,marketplace}.json
                ├── .codex-plugin/plugin.json
                ├── .agents/plugins/marketplace.json
                ├── plugin.json                          (portable Agent Plugins manifest)
                ├── .mcp.json                            (Claude — must be at plugin root)
                └── generated/
                    └── {cursor,codex}/mcp.json          (credential binding differs per agent)
```

They are generated rather than kept by hand because each agent binds MCP credentials
differently — Claude Code prompts for them through `userConfig`, Cursor declares them as
plugin `variables` that users set under Plugins → Configure, and Codex reads environment
variables. Hand-maintained copies of that drift silently.

```bash
npm run build:plugins     # regenerate after editing plugin.source.json
npm run validate:plugins  # what CI runs; fails if committed output is stale or orphaned
```

The generated output is committed so the repository is installable straight from a
checkout and diffs stay reviewable. `.gitattributes` marks it generated, so pull requests
collapse it — review `plugin.source.json` instead.

Three deliberate choices worth knowing before changing them:

- **`.mcp.json` sits at the repository root.** Claude Code only reads the MCP config from
  the plugin root; a path in the manifest and an inline object are both ignored. Because
  the plugin root is the repository root, that file doubles as this repository's own
  project-scope MCP config, and its `${user_config.*}` placeholders resolve only in plugin
  context. So when you open this repository in Claude Code you will be offered a `uniform`
  MCP server that cannot connect — decline it. Users of the plugin are unaffected.
- **The root `plugin.json` is skills-only, on purpose.** It is the portable
  [Agent Plugins](https://agent-plugins.org) v1 manifest and it is how GitHub Copilot gets
  the skills. There is deliberately no root `mcp.json`: the specification forbids both
  credential embedding and environment-variable expansion in header values, and the
  Uniform MCP server needs an `x-api-key` header, so a conformant file could not
  authenticate. The per-client manifests stay because the specification has only two
  component types and Claude Code is not a compatible client.
- **No `version` field.** Claude Code falls back to the git commit SHA when `version` is
  unset, so every merge to `main` reaches users as an update. Setting a version means
  users get nothing until someone bumps it. This is why CI runs `claude plugin validate`
  without `--strict` — the missing version is a warning that is accepted on purpose.

## Before you open a pull request

```bash
npm run validate          # every skill passes the Agent Skills spec
npm run validate:plugins  # generated manifests match plugin.source.json
```

Both run in CI on every pull request, along with `claude plugin validate`.

The eval suite is separate and manually dispatched, because each run spends real money on
agent sessions. If your change touches a skill that has evals, run the relevant arms
locally or ask a maintainer to dispatch the **Skill evals** workflow. See
[`evals/README.md`](evals/README.md).
