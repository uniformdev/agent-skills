# Deciding what belongs in a skill

The hard question is never format, it is what to include. This is the test.

## The package test

> **Can the agent get this fact from the installed package, offline?**
> Yes → teach it how to look. No → write it down.

| Fact | Where it lives | Verdict |
|---|---|---|
| Which components a design system exports, and their props | `node_modules/**/dist/index.d.ts`, with JSDoc | Discovery |
| A method's signature and option fields | Same | Discovery |
| Manifest / config JSON keys |  https://uniform.app/schemas/json-schema/mesh-manifest/v1.json | Discovery |
| Required sequence across two processes (a handshake, a token exchange) | No single type describes it | **Inline** |
| That something does **not** exist | Nowhere, by definition | **Inline** |

## Discovery costs runtime, not zero

Be honest in review about the trade. Measured on the mesh eval: the discovery version ran
718–1266s with 68–108 tool calls, against 481s and 40 for the catalog. The agent spends that
grepping and typechecking. You buy correctness and freshness with wall clock, not for free.

Keep names as **search keys** even when you defer the detail. A short job → component-name map
costs a few lines and gives the agent something to grep for.

## Content types ranked by value

1. **Negative knowledge** — "there is no `ErrorBoundary`", "there is no `useOpenDialog` hook",
   "`teamAdminRequired` has no `false`". Prevents confident invention. 
2. **Decision rules** — which of two things to use and why. "`preRequest` always runs and can
   change the cache key; `request` runs only on a cache miss and cannot" beats two paragraphs
   describing each hook.
3. **Sequences that span processes** — a handshake, an exchange, a deploy. 
4. **Traps whose failure is silent** — a CSRF header that is a constant rather than a secret and
   only works because the routes are not CORS-open; a cookie that must be `Partitioned` because
   the app is a cross-site iframe. Loud failures teach themselves; silent ones need writing down.
5. **Discovery recipes** — how to enumerate the current surface.
6. **One worked example per job** — the shape of the call, with the arguments people get wrong.
7. …then, far below, exhaustive surface listings. Usually cut these.

## Every step names the failure it prevents

A pipeline step, a guard or a trap earns its place only by a concrete failure you have seen or
verified — not one that could happen in principle. Before writing one, check the API does not
already handle it: an endpoint that already sorts by path does not need a sort step. A
defensive step with no named failure is noise the agent will faithfully reproduce in every
project.

## Facts versus the user's choices

A skill states facts as rules. It does not turn a design or product choice into one.

| It is… | Example | The skill says |
|---|---|---|
| A fact | "`sync push` has no `--mode` flag" | The rule, flat |
| A choice with several valid answers | which parameter titles a crumb; where a client is constructed; one page type or several | **Ask the user during discovery**, with a recommended default and one line on the trade-off |

Start discovery by asking the user what they want built wherever the answer changes the code,
then read the codebase. A skill that guesses here fails silently on every project whose answer
differs.

## Not shipped means not documented

Material that exists upstream but not in the published package — a starter component the CLI
does not scaffold yet, an API on an unreleased branch — gets nothing. Describing it in detail invites the agent to hand-write it, and the
description contradicts the shipped behaviour the rest of the skill documents.

## What to cut

- Method lists with elided parameters (`await api.moveNode({ /* … */ })`). The name is in the
  types and the ellipsis carries nothing.
- Prose restating a JSDoc comment that the agent will read anyway.
- Anything already stated in another skill — link to it instead of restating it.
- Anything already stated **in this skill**. SKILL.md holds the rule and a link; the reference
  holds the explanation. The same trap in SKILL.md, a reference and a traps list is three
  places to update and, sooner or later, two answers.
- Version history. Write for the latest release; "0.0.6 only", "since 20.72.3" and "renamed in
  20.74.7" go in the pull request. The one exception: an API added in the current major version
  gets a single `requires <package> ≥ <version>` line.
- Version-pinned field tables for schemas that change across SDK releases. Point at the schema
  and say to validate against it — *if* the schema exists.
- Content the baseline already gets right. If the unaided agent passes an assertion, the skill
  text defending it is costing tokens for nothing — cut it or say why it stays.

## Two markers worth reusing

Both appear in `uniform-mesh` because they change what an implementer does:

- **Experimental** — when the SDK tags something `@deprecated` to mean "beta, may change", say
  so and say it does not mean removal, or the reader will see the strikethrough and avoid a
  supported API.
- **Types win over prose** — when a docs page and the shipped types disagree, state the
  discrepancy in the skill. The reader would otherwise follow the docs and get it wrong.
