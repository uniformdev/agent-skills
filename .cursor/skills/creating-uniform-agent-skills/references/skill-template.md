# Skill template and checklist

## Contents

- [SKILL.md template](#skillmd-template)
- [Frontmatter fields](#frontmatter-fields)
- [Description writing guide](#description-writing-guide)
- [Directory structure conventions](#directory-structure-conventions)
- [Writing style](#writing-style)
- [SKILL.md sections (in order)](#skillmd-sections-in-order)
- [Checklist](#checklist)

## SKILL.md template

Use this as a starting point. Replace all `<placeholders>`.

```markdown
---
name: uniform-<topic>
description: <What the skill does and when to use it. Write in third person. Include specific trigger terms. Max 1024 chars.>
license: MIT
metadata:
  author: uniformdev
  version: "1.0.0"
---

# <Skill title in sentence case>

<1–2 sentence overview of what this skill covers and why it exists.>

## <Key concept or section>

<Concise overview. Detailed content belongs in references/.>

## Resources

See `references/` for detailed guidance:
- [<Topic>](references/<file>.md) — <One-line description>
- [<Topic>](references/<file>.md) — <One-line description>
```

## Frontmatter fields

| Field | Required | Convention |
|-------|----------|------------|
| `name` | Yes | `uniform-<topic>`, kebab-case, max 64 chars. Must match directory name |
| `description` | Yes | Third person. Include both WHAT it does and WHEN to use it. Include trigger keywords. Max 1024 chars |
| `license` | Yes | Always `MIT` |
| `metadata.author` | Yes | Always `uniformdev` for official skills |
| `metadata.version` | Yes | Start at `"1.0.0"`. Quoted string to avoid YAML parsing as number |

## Description writing guide

The description drives skill discovery. The agent reads all descriptions at startup and decides which skills to activate.

**Pattern:** `<Verb phrase describing capabilities>. Use when <trigger scenarios>.`

**Examples from this repo:**

| Skill | Description |
|-------|-------------|
| uniform-best-practices | Core Uniform CMS concepts, conventions, naming standards, and MCP tool usage. Use when working with Uniform compositions, components, entries, patterns, content types, assets, or localization. |
| uniform-sdk | Uniform SDK developer reference covering authentication, CLI configuration, routing, and data syncing. Use when setting up Uniform in a frontend project, configuring the CLI, or working with the Route API. |
| uniform-mesh | Uniform Mesh integration development covering custom data connectors, parameter editors, asset library extensions, and dashboard tools. Use when building a custom Mesh integration that extends the Uniform UI. |

## Directory structure conventions

```text
skills/uniform-<topic>/
├── SKILL.md                    # Required, under 500 lines
└── references/                 # One focused topic per file
    ├── setup.md                # Installation and configuration
    ├── components.md           # Component mapping and rendering
    ├── preview.md              # Visual editing and preview mode
    └── <additional-topic>.md   # As needed
```

### Reference file conventions

- No frontmatter needed
- Start with an H1 heading matching the topic
- Use tables for structured data (parameter types, configuration options)
- Include code examples with language tags
- Keep each file focused on one topic
- No hard line limit, but prefer concise over exhaustive

### Common reference file topics (framework skills)

| File | Content |
|------|---------|
| `setup.md` | Package installation, configuration files, environment variables |
| `components.md` | Component mapping, `UniformSlot`, `UniformText`, parameter handling |
| `preview.md` | Live preview setup, playground configuration, contextual editing |
| `personalization.md` | Context setup, manifest download, edge personalization |

## Writing style

- **Sentence case** for all headings ("Repo mechanics" not "Repo Mechanics")
- **Third person** in the description field
- **Imperative mood** in instructions ("Create the file" not "You should create the file")
- **Concise by default** — the agent already knows general programming concepts
- Only explain what's specific to Uniform or this repository's conventions
- Use tables for structured comparisons
- Use code blocks with language tags for all code examples

## SKILL.md sections (in order)

1. **Title** (H1) — skill name in sentence case
2. **Overview** — 1–2 sentences, what and why
3. **Key concepts / sections** — concise overview of the domain
4. **Resources** — links to each reference file with one-line descriptions

**No "When to apply" section.** The `description` frontmatter is what decides whether the skill
loads; by the time the body is in context the question is already answered, so a trigger list in
the body only spends tokens. Put the trigger scenarios in the description instead.

## Checklist

Before submitting a new skill, verify:

- [ ] `name` matches directory name (`uniform-<topic>`)
- [ ] `description` includes WHAT and WHEN in third person
- [ ] `license` and `metadata` fields present
- [ ] Description names 3+ concrete trigger scenarios — and the body has no "When to apply"
      section restating them
- [ ] SKILL.md is under 500 lines
- [ ] Reference files each cover one focused topic
- [ ] Headings use sentence case
- [ ] Code examples have language tags
- [ ] `npm run validate` passes — it globs `skills/`, so **no per-skill npm script is needed**
      (the old `validate:<topic>` convention was removed when the validator started globbing)
- [ ] `npm run build:plugins` run if a description changed (it regenerates the README inventory),
      and `npm run validate:plugins` clean
- [ ] Every factual claim checked against the shipped package or an example, not memory
- [ ] Any command the skill tells the agent to run has been executed and its output matches
