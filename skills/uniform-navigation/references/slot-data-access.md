# Slot data access — how a menu shell reads its own children

This is the mechanism the rest of the navigation build sits on. Get it wrong and the menu
renders empty with no error.

## The problem, precisely

A Uniform slot gives a parent **already-rendered children**. The parent gets an opaque node
plus an id — not the child's parameters.

That is fine for a container. It is not fine for a mega menu, because a category rail is a
list of the *labels* of the children in the panel slot. The shell has to know something
about children it is only allowed to render.

Two things the shell needs, from two different places:

| Need | Source |
|---|---|
| Rail labels (text, id, icon) | Raw child component instances, read server-side |
| Panel content | The slot itself, rendered and filtered by id |

**Never rebuild children from raw data.** Reconstructing a child from its parameters throws
away personalization, A/B tests, pattern links, and the editor's click targets. Read
metadata from raw data; render children through the slot.

The techniques below are the navigation-specific *shape*. The code is written against the
Next.js App Router because it needs a concrete SDK; the "which technique your framework
supports" table at the end says what changes elsewhere, and the primitives themselves are
documented in the framework skills, not here.

## Technique 1 — read raw child instances

Uniform's server-side composition cache holds the full component instance tree. Given a
child's id and the composition id, it returns that child's real data.

**Creating the cache and wiring it to the composition root is framework setup, not
navigation** — the composition-cache section of
[uniform-nextjs-app-router/references/advanced.md](../../uniform-nextjs-app-router/references/advanced.md)
has the App Router version, including the silent failure when the cache is not passed
through. Do that first; find the composition root during [discovery](discovery.md).

What is navigation-specific is what you do with the instances once you have them: map the
slot's items to their instances and pull out the few values the rail draws. Keep the item's
`_id` — it is the join key technique 2 filters on, so it has to survive this step:

```ts
// CATEGORY_TYPE is your category component's public id.
const categories = slot.items
  .map((item) => {
    if (!item) return null;
    const instance = cache.getUniformComponent({
      componentId: item._id,
      compositionId: context._id,
    });
    if (instance?.type !== CATEGORY_TYPE) return null;
    return { id: item._id, text: instance.parameters?.text?.value as string };
  })
  .filter(Boolean);
```

Two things that are easy to drop. Slot items are nullable, so guard before reading `_id`.
And filtering by `type` matters: the panel slot usually allows plain links alongside
categories, and only the categories belong in the rail.

### Keep the reads on the server

The cache is server-only. An interactive menu is a client component, so the read has to
happen above the client boundary and be passed down as a prop. The clean way is a small
server wrapper applied **at the dynamic-import boundary**, so it runs before the client
module loads:

```tsx
// index.tsx — server
const MenuClient = dynamic(() =>
  import("./menu-client").then((mod) => withSlotData(mod.default, ["panelSlot"]))
);
```

`withSlotData` reads the named slots via the cache and injects them as a `slotData` prop.
The ordering is the part that breaks: the wrapper has to be applied **inside** the dynamic
import, to the module's default export, so the read happens while the code is still on the
server. Wrapping the already-imported client component instead runs the cache read in the
client bundle, where the cache does not exist and every lookup is `undefined`.

## Technique 2 — render the slot, filter to the active child

*App Router. The Page Router has no slot render prop — see the table below.*

Render the panel slot normally and emit only the active child. The children stay real
Uniform children; you are choosing which to show.

```tsx
<UniformSlot slot={slots.panelSlot}>
  {({ child, _id, key }) =>
    _id === activeCategoryId ? <Fragment key={key}>{child}</Fragment> : <Fragment key={key} />
  }
</UniformSlot>
```

Keep the `key` on whatever you return for a non-match, including an empty fragment.

The same slot can be rendered more than once. Mobile typically drops the rail and renders one
section per category, reusing the slot with a different filter each time.

## Technique 3 — role-switch a child with context

A category component behaves differently depending on where it sits: inside a categorized
mega menu it is a panel whose label is drawn by the parent's rail; standalone it is an
ordinary link. Do not model that with a parameter the editor has to set correctly.

Provide context from the shell, consume it in the child:

```tsx
// shell
<MegaMenuContext.Provider value={{ isInsideCategorizedMegaMenu: true }}>
  {/* filtered slot */}
</MegaMenuContext.Provider>

// child
const { isInsideCategorizedMegaMenu } = useContext(MegaMenuContext);
if (isInsideCategorizedMegaMenu) return <UniformSlot slot={slots.categoryPanel} />;
// …otherwise render as a link
```

One definition, two behaviours, nothing for the editor to get wrong.

## Technique 4 — detect emptiness without counting

In the visual editor, empty slots contain **placeholder items**. They are real entries, so
`items.length` is truthy even when an author has added nothing, and a layout that branches on
"does the aside have content?" will always take the has-content branch while editing.

Use the SDK's own predicate — `isComponentPlaceholderId` from `@uniformdev/canvas`:

```ts
import { isComponentPlaceholderId } from "@uniformdev/canvas";

const hasContent = Boolean(
  slot?.items?.filter((item) => item && !isComponentPlaceholderId(item._id)).length
);
```

Do not hand-roll the prefix test. A placeholder id is either the bare string `"placeholder"`
(SDK v1) or `placeholder_<random>` (v2), so `startsWith("placeholder_")` misses the v1 form
and counts it as content; the helper checks both. It also takes `string | undefined`, where a
raw `item._id.startsWith(...)` throws on an item whose `_id` is absent. Guard `item` itself
too — a null entry survives an `item?._id` chain as `undefined`, and `!undefined` is `true`.

## Which technique your framework supports

The two Next.js routers solve this in **opposite directions**, which inverts the obvious
expectation — so check before assuming technique 2 is available:

| | App Router | Page Router |
|---|---|---|
| Slot render prop | Yes, but it yields only `_id` and an opaque child | **None at all** |
| Raw child data | Needs the composition cache | Available directly from the current component |
| So technique 2 (filter by `_id`) | Works | Does not port — filter the raw data instead |

The per-router mechanics and their traps live in the framework skills — the composition cache
in [uniform-nextjs-app-router/references/advanced.md](../../uniform-nextjs-app-router/references/advanced.md),
and reading slot child data in
[uniform-nextjs-page-router/references/components.md](../../uniform-nextjs-page-router/references/components.md).
Read the one that matches the project rather than guessing from this table.

## Order of work

Prove the data path before any layout:

1. Wire up raw child-data access for your framework (App Router: the cache at the
   composition root).
2. Read one child's label and render it as plain text.
3. Confirm it appears in a real render, not just in types.
4. Only then build the rail, the panel, and the styling.

Skipping to step 4 produces a correct-looking component that renders nothing, and the cause
is three files away from the symptom.
