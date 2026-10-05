# Mapping CDP traits to quirks

## What quirk criteria compare

| Where the quirk is tested | Comparison |
|---|---|
| Personalization criterion | `=` or `!=`, exact and case-sensitive. A missing quirk compares as `""`, so `!=` also matches visitors with no CDP data |
| Signal criterion on a quirk | String match, case-insensitive unless set otherwise: exact, contains, regex, each negatable, plus exists / does not exist |

Quirk values are strings (`type Quirks = { [key: string]: string }`), and `update({ quirks })`
stores what it is given without converting it. A boolean `true` written as-is never equals the
`"true"` a criterion compares against.

## Trait types

| CDP trait | Quirk value |
|---|---|
| Audience (boolean) | `"true"` when the trait is `true`, otherwise `"false"`. A visitor who never joined may have no trait at all ([Segment](segment.md#audiences-and-computed-traits)), and `= false` should still match them |
| Enum | The value normalised to the definition's options; anything else `""` |
| Number | A bucket from a small option set, with thresholds the user confirms |
| List | One boolean quirk per value marketing targets. To keep the list in one quirk instead, the user creates a signal with a contains criterion in Uniform |
| Object, identifier, personal data | Not mapped: quirks are kept in browser storage and cookies |

## One mapping function

Call the same function from the production lookup and from the mock. If they map separately, the
demo shows values production never writes.

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

Nothing deletes a quirk: `update({ quirks })` merges keys. Write every quirk the mapping owns on
every lookup, and no other quirk, or a visitor who left an audience keeps matching it.

## Definitions

Write one definition per quirk, with `options` holding exactly the values the mapping writes; a
value an author targets that the mapping never writes matches nobody. Put the thresholds in the
description:

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

Stage the files in their own directory, `uniform-cdp/quirks/<id>.yaml`. In `uniform-data/`, a
mirror pull deletes them before they are pushed, and a sync push sends them along with everything
else.

## Getting them into Uniform

Ask whether to create the definitions now or hand the user the commands, and recommend handing
them over: creating them changes the live project before the user has reviewed the names and
options. Either way, push with `--mode createOrUpdate`, because `quirk push` defaults to mirror,
which deletes every quirk that is not in the directory. Scripts make the hand-over repeatable:

```json
"uniform:cdp:whatif": "uniform context quirk push ./uniform-cdp/quirks --mode createOrUpdate --what-if",
"uniform:cdp:push": "uniform context quirk push ./uniform-cdp/quirks --mode createOrUpdate"
```

If the project syncs quirks to `uniform-data/quirk/`, run `uniform:pull` after the push, or the
next mirror sync push deletes the new quirks. The Context manifest carries signals but not quirk
definitions, so quirks alone need no `uniform context manifest publish`.
