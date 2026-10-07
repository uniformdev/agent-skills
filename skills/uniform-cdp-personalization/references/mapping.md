# Mapping CDP traits to quirks

## What quirk criteria compare

| Where the quirk is tested | Comparison |
|---|---|
| Personalization criterion | `=` or `!=`, exact and case-sensitive. A missing quirk compares as `""`, so `!=` also matches visitors with no CDP data |
| Signal criterion on a quirk | String match, case-insensitive unless set otherwise: exact, contains, regex, each negatable, plus exists / does not exist |

Quirk values are strings, and `update({ quirks })` stores what it is given without converting it.
Traits typed `any` still compile, and a stored `true` never equals the `"true"` a personalization
criterion compares against.

## Trait types

| CDP trait | Quirk value |
|---|---|
| Audience (boolean) | `"true"` when the trait is `true`, otherwise `"false"`. A visitor who never joined may have no trait at all ([Segment](segment.md#audiences-and-computed-traits)), and `= false` should still match them |
| Enum | The value normalised to the definition's options; anything else `""` |
| List | One boolean quirk per value marketing targets. To keep the list in one quirk instead, the user creates a signal with a contains criterion in Uniform |
| Object, identifier, personal data | Not mapped: quirks are kept in browser storage and cookies |

## One mapping function

Map every trait in one function; the mock reaches it through the production client
([mock-profile-api.md](mock-profile-api.md#contract-first)). The rules below are an example:
replace them with the rows of the confirmed [mapping plan](audit.md#the-report).

```ts
type Rule = { trait: string; quirk: string; value: (raw: unknown) => string };

const rules: Rule[] = [
  { trait: "frequent_buyers", quirk: "frequentBuyer",
    value: (v) => (v === true ? "true" : "false") },
  { trait: "preferred_brand", quirk: "preferredBrand",
    value: (v) => {
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      return ["acme", "globex"].includes(s) ? s : "";
    } },
  { trait: "orders_last_90_days", quirk: "orderFrequency",
    value: (v) => (typeof v !== "number" ? "" : v >= 5 ? "high" : v >= 1 ? "low" : "none") },
];

// No profile (null) still returns every quirk, so stale values are overwritten.
export function traitsToQuirks(traits: Record<string, unknown> | null): Record<string, string> {
  return Object.fromEntries(rules.map((r) => [r.quirk, r.value(traits?.[r.trait])]));
}
```

## Quirk IDs

Use letters and digits only, in camelCase, from the explicit map rather than derived from the CDP
key. The quirk cookie (`ufvdqk`) stores each pair as `key-value` and splits it at the first `-`:
a quirk `top-interest` set to `hiking` reads back as quirk `top` with value `interest-hiking`.

## Clearing stale values

`update({ quirks })` merges keys and never removes one. Write every quirk the mapping owns on every
lookup, and no other quirk, or a visitor who left an audience keeps matching it.

## Definitions

Write one definition per quirk, with `options` holding exactly the values the mapping writes; a
value an author targets that the mapping never writes matches nobody. Put the thresholds in the
description, as in this definition for the example `orderFrequency`:

```yaml
id: orderFrequency
name: Order frequency (CDP)
description: From the CDP trait orders_last_90_days. high = 5 or more, low = 1–4, none = 0.
options:
  - name: High
    value: high
  - name: Low
    value: low
  - name: None
    value: none
```

Stage the files in a directory of their own (for example `uniform-cdp/quirks/<id>.yaml`), not in
the [sync directory](audit.md#uniform-project): there a mirror pull deletes them before they are
pushed, and a sync push sends them along with everything else. The `uniform-sdk` skill's rule
against touching serialized Uniform data, if that skill is installed, is about the sync directory:
the audit only reads it, and the staged files are new and live outside it.

## Getting them into Uniform

Hand the user the commands unless they chose to create the definitions now
([audit.md](audit.md#questions)): creating them changes the live project before the user has
reviewed the names and options. Either way, push with `--mode createOrUpdate`: the directory holds
only the CDP quirks, and the default mirror mode would delete every other quirk the project
defines. Scripts make the hand-over repeatable:

```json
"uniform:cdp:whatif": "uniform context quirk push ./uniform-cdp/quirks --mode createOrUpdate --what-if",
"uniform:cdp:push": "uniform context quirk push ./uniform-cdp/quirks --mode createOrUpdate"
```

If the project syncs quirks, run `uniform sync pull` (or the project's pull script) after the
push, or the next mirror sync push deletes the new quirks. The Context manifest carries signals
but not quirk definitions, so quirks alone need no `uniform context manifest publish`.
