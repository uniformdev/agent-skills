# Discovering the navigation surface

Run this before modeling or writing a component. Every later decision depends on what is
already there, and navigation is rarely greenfield — most projects have *some* header.

## 1. What navigation already exists in this project?

Search the code for a rendered header, and the local content mirror for authored instances.
These answer different questions and can disagree:

```bash
# Rendered nav in code
grep -rniE '\b(nav|navbar|header|menu|flyout|megamenu)\b' --include='*.tsx' --include='*.vue' --include='*.svelte' src app components 2>/dev/null | head -30

# Component definitions in a local content mirror (path varies: content/, uniform-data/, .uniform/)
grep -rl 'navigation\|header\|menu' --include='*.yaml' --include='*.json' content uniform-data .uniform 2>/dev/null | head -20
```

A definition can exist with **no content instance using it**. Treat a definition with no
instances as unproven: it compiles, but nothing has exercised it. Check before assuming a
component works as documented — substitute the public id you found above:

```bash
# A definition that appears only in its own file has never been authored against
grep -rl '<theTypeYouFound>' content/ | head
```

Whatever you find, keep the existing public ids. Renaming a component or slot breaks every
composition already authored against it.

## 2. Which design system and styling layer does the project use?

Navigation is the most visible surface on the site, so it has to be built from whatever the
project already builds everything else from. Find the button, link, and container primitives
before writing markup, and reuse them rather than introducing a parallel set.

## 3. Is the Design Extensions integration installed?

This decides your parameter types, and getting it wrong fails silently — `dex-*` values are
token keys that resolve to classes which simply do not exist without the integration.

```bash
# The dependency
node -p "require('./package.json').dependencies['@uniformdev/design-extensions-tools']"

# The token definitions
ls dex.config.json 2>/dev/null && head -40 dex.config.json

# Existing definitions already using dex types
grep -rho 'dex-[a-z-]*' content/ 2>/dev/null | sort -u
```

| Result | Parameter types to use |
|---|---|
| Package + `dex.config.json` present | `dex-color-palette-parameter`, `dex-space-control-parameter`, `dex-token-selector-parameter`, `dex-segmented-control-parameter` — and match the token keys in `dex.config.json` |
| Neither present | Plain `select`, `text`, `asset`, `link`, `checkbox`, `number` |

If the integration is present, also find the resolvers before writing style code — they
translate a token value into a class or an inline style, and hand-rolling a second
translation is how a nav ends up styled differently from the rest of the site:

```bash
grep -rn 'resolveColor\|resolveViewPort\|resolveToken\|dex-' src app components 2>/dev/null | head
```

If the project has no resolver of its own, you are writing the two that a token layer needs:
one that maps a token value to a class name, and one that expands a per-viewport value into
breakpoint-prefixed classes.

## 4. How does the app wire compositions?

Find the file that renders the composition root. The parent-reads-children mechanism has to
be wired there, and it is the single most common silent failure
([slot-data-access.md](slot-data-access.md)).

```bash
grep -rn 'UniformComposition' --include='*.tsx' --include='*.ts' src app pages 2>/dev/null
```

## What to conclude

| Finding | Consequence |
|---|---|
| Nav components exist | Extend; keep their public IDs — renaming breaks authored content |
| Definitions exist, no instances | Unproven. Verify behaviour before relying on it |
| No Design Extensions | Plain parameter types; write your own style resolution |
| Design Extensions present | `dex-*` types, and reuse the project's existing resolvers |
| Composition root found | That is where the composition cache gets wired |

## Further reading

Uniform's Component Starter Kit is open source and contains a navigation set built along the
chain in [modeling.md](modeling.md) — useful as a worked example of the variant branching and
the desktop/mobile split, not as a dependency and not as a set of names to copy:
<https://github.com/uniformdev/csk-packages/tree/main/packages/csk-components>
