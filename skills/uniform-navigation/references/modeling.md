# Modeling navigation in Uniform

How to shape the component definitions. General slot, parameter, and naming rules live in
[uniform-experience-modeling](../../uniform-experience-modeling/SKILL.md) — this file covers
only what is specific to navigation.

## Why navigation is experience, not content

Navigation is a layout of an experience, so it belongs in components in a composition, not in
entries. Three consequences follow, and each is the reason for a rule below:

- Authors reorder items by dragging them in the visual editor — so **repetition is a slot**.
- Items can be personalized or A/B tested individually — so **items must be real components**,
  not values a parent rebuilds.
- One header serves every page — so the header is assembled once as a **pattern**.

Two alternatives, and when each is actually right:

| Alternative | Verdict |
|---|---|
| Nav items as content **entries** | Valid when the menu genuinely mirrors content already modeled as entries (a category tree). Wire it through a data resource. For hand-authored site nav it adds indirection and moves reordering out of the visual editor |
| Menu derived from the **project map** | Right for *derived* navigation — breadcrumbs, a sitemap, a section index — and the project map client resolves nodes by path for exactly that. Wrong for a *curated* menu, which needs grouping, ordering, and promo content the map cannot express. Either way, link nav items *to* project map nodes; that is what the link parameter's node type is for |

## The chain

Each component allows only the next level in its slot. Depth is a modeling decision expressed
in allow-lists — never a `depth` parameter, never numbered parameters.

| Component | Role | Slots | Allows |
|---|---|---|---|
| **Header** | shell | left, center, right | left: brand/logo · center: link, flyout · right: actions |
| **Link** | leaf | — | — |
| **Group** | labelled column | links | link |
| **Flyout** | trigger + panel | panel, aside | panel: link, group, category · aside: promo content |
| **Category** | rail entry owning a panel | panel | group, link, image, rich text, layout |

Reading the depth off that table: a **two-level** menu is header → flyout → group → link and
needs no category component. A **three-level** mega menu adds category between flyout and
group. Build the level the project asks for; adding a level later is additive.

The aside/promo slot is the one place a wide allow-list is defensible — it exists so
marketing can drop a card or image next to the links. Enumerate the components anyway;
do not reach for the allow-all toggle.

## Parameters

Give every nav component the same parameter shape. Authors then learn one control set, and a
label means the same thing at every level.

| Parameter | Type | On |
|---|---|---|
| `text` | text, localizable | every nav component — set it as the title parameter |
| `icon` | asset (max 1) | every nav component — set it as the thumbnail parameter |
| `link` | link | link, and category (as a standalone fallback) |
| presentation group | grouped, collapsed | every nav component |

Notes that matter in practice:

- **Set the title and thumbnail parameters.** Without them the canvas tree shows a list of
  identical component names and a mega menu becomes unauthorable.
- **Reuse one presentation group across the nav components.** Same id, same child parameter
  list — the settings panel is then identical at every level.
- **Collapse presentation settings.** Content first; styling behind a fold.
- **A parameter that disables a behaviour reads backwards.** If a checkbox is named for the
  behaviour it controls, authors will expect ticking it to *enable* that behaviour. Prefer
  deriving state where you can: active-link styling should come from comparing the link's
  destination to the current route, not from an authored flag.
- Use the style parameter types the project already has — see the Design Extensions check in
  [discovery.md](discovery.md).

## Variants for layout

Use a display **variant** for the layout switch, not a parameter:

| Component | Variant | Effect |
|---|---|---|
| Header | sticky | header stays pinned; panels must anchor to its measured bottom edge |
| Flyout | mega | panel goes full-bleed instead of anchoring to the trigger |

Let content pick the sub-shape rather than adding a second variant: a mega flyout **with**
category children renders rail + panel; **without** them it renders a single full-bleed
panel. One variant, two layouts, nothing extra for the author to choose.

## The pattern layer

A header is authored once and appears on every page:

1. Assemble the header — logo, nav items, actions — as a **component pattern**.
2. Place that pattern in the page composition's header slot inside a **composition pattern**.
3. Pages built from the composition pattern inherit the header.

Per-page variation comes from **instance overrides**, keyed by the child's id, which change
text or a link without breaking the pattern link.

**Locking is a decision, not a default.** Locking the header slot guarantees consistency and
removes per-page personalization from it; leaving it open allows both variation and drift.
Choose deliberately, and say which you chose:

| Choice | Buys | Costs |
|---|---|---|
| Lock the header slot | Every page identical; no accidental edits | Per-page variation only via parameter overrides; no personalization inside the header |
| Leave it open | Pages can vary and personalize the header | Drift across pages |

### The slot you place the header into is not one of yours

Step 2 above puts your pattern into a slot that already existed — `header` on the page
component. Whether it will accept the pattern is decided by that slot, and the editor
reports the failure as *"this component type is not allowed here… because of the Header slot
configuration"*, which sends you to the wrong field. Check both:

- `allowedComponents` contains the pattern's **underlying component type**.
- `patternsInAllowedComponents` is **off**. The name reads backwards. Absent or `false`
  means patterns of the allowed types are allowed — the setting you almost always want.
  `true` means patterns are *forbidden* unless the allow-list also names each one as
  `$p:<patternId>`, so a slot with `patternsInAllowedComponents: true` and no `$p:` entry
  allows no pattern at all. Do not set it to `true` reflexively on the slots you create
  either; reach for it only to lock a slot to a curated set. The general rule is in
  [uniform-experience-modeling](../../uniform-experience-modeling/references/slots.md).

## Review checklist

- [ ] Repetition is a slot; no `link1` / `linkText2` parameters anywhere
- [ ] Depth comes from allow-lists; no depth parameter
- [ ] No allow-all toggle on any nav slot
- [ ] Title and thumbnail parameters set on every nav component
- [ ] Presentation settings grouped and collapsed, consistently across levels
- [ ] Parameter types match the project's Design Extensions status
- [ ] Layout differences are variants, not parameters
- [ ] Header assembled as a component pattern, placed via a composition pattern
- [ ] Lock-vs-open decided deliberately and written down
- [ ] The slot holding the header pattern accepts it — component type listed, and
      `patternsInAllowedComponents` off (or the pattern named as `$p:<patternId>`)
- [ ] Editable labels render through `UniformText`, not as raw strings
