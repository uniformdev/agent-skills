# Verifying against source

Every factual claim in a skill needs a source that is not your memory and not a docs page alone.
Uniform ships typed packages and runnable examples; both are authoritative in a way prose is not.

## Order of authority

1. **The shipped package types** — `dist/index.d.ts` and any subpath (`/server`). This is what
   the compiler enforces, so it is what the agent will hit.
2. **The official examples repo** — `uniformdev/examples`. Real, running code, including tests.
3. **The docs pages** — good for the *why* and for flows. Wrong often enough about signatures
   that you must not write a signature from them.

When 1 and 3 disagree, 1 wins and the disagreement is worth writing into the skill.

## Reading a package you do not have installed

```bash
# metadata first — does it even exist, and what does it export?
npm view @uniformdev/<pkg> version types

# pull and unpack into a scratch dir
npm pack @uniformdev/<pkg> --pack-destination /tmp/pkg && cd /tmp/pkg && tar -xzf *.tgz

# subpath exports are easy to miss and often hold the server half
node -e 'console.log(JSON.stringify(require("./package/package.json").exports, null, 1))'

# the public surface
grep "^export" package/dist/index.d.ts | tail -1

# one symbol, with its JSDoc
awk '/^interface <Name>/,/^}$/' package/dist/index.d.ts
```

Use a **range match** (`awk '/start/,/end/'`), not `grep -A N`. A fixed `-A` silently truncates
anything longer than you guessed — that mistake cut the tail off a 104-line interface here and
dropped exactly the methods the skill then told the agent to go read.

## Reading the examples repo

```bash
gh api repos/uniformdev/examples/contents/mesh --jq '.[] | "\(.type)  \(.name)"'
gh api repos/uniformdev/examples/contents/<path>/<file>.ts --jq '.content' | base64 -d
gh search code --repo uniformdev/examples "SomeSymbol" --json path --jq '.[].path'
```

Examples carry things types cannot: the intended wiring, the security commentary, and the test
helpers. Note whether a helper is exported by the SDK or defined locally in the example — writing
"import it from the SDK" when the example defines it itself sends the agent looking for a symbol
that isn't there.

## Drift this has actually caught

Kept as evidence that the step is not ceremony:

| Claim | Reality |
|---|---|
| `ObjectSearchContainer` is in `@uniformdev/design-system` | Ships in `@uniformdev/mesh-sdk-react`; the import would not resolve |
| `updateNodeProperty`'s `locale` / `conditionIndex` are optional (docs) | Required in the type. `locale: undefined`, `conditionIndex: -1` |
| Three locations expose `editorState` (docs) | Four; and two of them can hand you `undefined` |
| The old edgehancer testing example | Fabricated — wrong argument shape, wrong return shape |
| `@uniformdev/mesh-auth` is a package | 404 on npm. It is an example directory; the helpers ship as `@uniformdev/mesh-sdk/server` |
| A component enumeration via `declare const` | Misses every `declare function` component |

Three of those were errors in *this* repo's own skills, and two were mine while writing the fix.
Assume your first draft has one.

## Test the recipes you write

If the skill tells the agent to run a command, run it first and check the output is what the
prose claims. Two failures here came from untested recipes: a `grep -A 90` that truncated, and a
`<(input|select|button)[ >]` pattern that silently missed multi-line JSX because the tag name is
followed by a newline. Both looked right.

## Sanity-check against a captured eval run

`evals/results/<arm>/<timestamp>/<eval>/run-1/project/` holds what an agent actually produced.
It is free to inspect and it is the fastest way to see whether a claim in a skill matches what
agents do with it — including grepping those projects to test a proposed assertion offline
before spending a session on it.
