# Interaction and accessibility

The behaviour layer of a header menu. Most of this is not Uniform-specific — it is here
because navigation is where these mistakes cluster, and because a Uniform menu adds one
constraint the usual advice does not cover: **the visual editor renders your closed panels
too**.

## Hover intent

Raw `mouseenter` / `mouseleave` produce a menu that flickers when the pointer crosses a
trigger on its way somewhere else, and that closes while the user is diagonally travelling
toward the panel.

Use asymmetric delays — slow to open, slower to close:

| Timer | Value | Why |
|---|---|---|
| open | ~80ms | long enough to ignore a pass-through, short enough to feel instant |
| close | ~150ms | survives the diagonal trip from trigger to panel |

Rules that make it behave:

- Opening **cancels** a pending close, and closing **cancels** a pending open.
- Attach `mouseleave` to a wrapper enclosing both trigger and panel, so travelling between
  them is not a leave event.
- The panel's own `mouseenter` re-cancels the close.
- Clear both timers on unmount, or a timer fires against an unmounted component.
- Hover opens the menu; **click must not be the only way in** — see keyboard below.

## Closed panels must be inert

A panel hidden with only `opacity-0` / `pointer-events-none` is still in the tab order.
Keyboard users tab into an invisible menu and lose the focus ring entirely. This is the most
common accessibility defect in a hover menu.

Set `inert` on the panel while closed. It removes the subtree from the tab order and from the
accessibility tree in one attribute, and it composes with the opacity transition — keep the
visual states, add `inert` alongside them.

Do not use `display: none` if you are animating the panel; `inert` gives you the semantics
without killing the transition.

**Except while contextual editing.** `inert` also swallows pointer events, so an author
cannot click into a closed panel to select the components inside it — the panel becomes
unauthorable in exactly the state it is authored in. Gate the attribute on the composition
context's `isContextualEditing` flag: inert on the live site, never inert in the editor.

```tsx
<div inert={!isOpen && !context.isContextualEditing} />
```

## Keyboard

| Key | On | Behaviour |
|---|---|---|
| Enter / Space | trigger | toggle the panel |
| Escape | anywhere while open | close, return focus to the trigger |
| Tab | open panel | move through panel content; leaving the panel closes it |
| Arrow up/down | category rail | move between categories |

Escape must return focus to the trigger. Closing a menu and dropping focus to `<body>` sends
a keyboard user back to the top of the page.

## ARIA

On the trigger:

```html
<button aria-expanded="false" aria-haspopup="true" aria-controls="menu-panel-id">
```

Generate the id rather than hard-coding it — several triggers coexist in one header, and
duplicate ids break the association. Use your framework's id hook.

### The rail is a tablist, not navigation

A category rail **swaps a panel**; it does not navigate. That distinction picks the pattern:

| If the rail | Use |
|---|---|
| Swaps the visible panel (mega menu) | `role="tablist"` / `role="tab"` with `aria-selected`, `aria-controls`, and roving `tabindex` |
| Actually navigates to a page | `<nav>` + `<ul>` + links, with `aria-current="page"` on the active one |

`aria-current` on a `<button>` that changes a panel is a category error: it tells a screen
reader the user is *on* that page. Roving tabindex means exactly one rail item is tabbable
(`tabindex="0"`); arrow keys move both focus and selection.

If the rail is a tablist, the panel it controls needs `role="tabpanel"` and
`aria-labelledby` pointing at its tab.

### The scrim

A full-bleed mega menu usually dims the page behind it. That element is decorative: mark it
`aria-hidden` and make it click-to-close. It must never be focusable.

## Motion

Wrap panel transitions so they are skipped for users who ask for reduced motion — a
full-bleed panel sliding in is exactly the kind of motion that triggers vestibular symptoms.
Use the reduced-motion variant your CSS framework provides, or a `prefers-reduced-motion`
media query. Opacity-only fades are generally acceptable; transforms are not.

## Positioning a full-bleed panel

A full-bleed panel anchors to the bottom of the **header**, not the bottom of the trigger.
Measure it rather than hard-coding a height — the header's height changes with a sticky
variant, at different breakpoints, and whenever a logo asset changes:

- Read the header element's bounding rect and use its `bottom` as the panel's `top`.
- Recompute on `resize` and on `scroll` (passive listener).
- Measure in an effect, after layout — reading it during render gives you a stale or zero
  value on first paint.

## Mobile

Do not render the desktop rail on a phone. The usual shape:

- Rail + panel collapses to **one section per category**, each with its label as a heading.
- The panel is a full-height drawer positioned below the header, scrollable.
- A back or close control is required — hover intent does not exist on touch.
- The trigger's tap toggles; there is no hover state to rely on.

Rendering both trees and gating them with breakpoint classes is simpler than conditional
rendering and avoids a hydration mismatch, at the cost of duplicated markup in the DOM. If
you do that, make sure the hidden tree is not focusable.

## In the visual editor

- Panels are authored while **closed**. Verify a closed panel is still editable — an author
  cannot select what is not rendered, and cannot click into what is `inert`. Keep closed
  panels rendered, and drop `inert` while `isContextualEditing` is true; `display: none`
  breaks this outright.
- Placeholder items appear in empty slots, so "is this region empty?" checks must filter them
  out — see [slot-data-access.md](slot-data-access.md).
- Labels an author should be able to edit must render through `UniformText`. A rail label
  read from slot data and printed as a string is not editable — either render it through the
  slot as well, or state plainly that the rail is edited from the component tree.

## Checklist

- [ ] Open/close delays asymmetric; timers cancel each other and clear on unmount
- [ ] `mouseleave` on a wrapper covering trigger and panel
- [ ] Closed panels carry `inert` — except while `isContextualEditing`
- [ ] Escape closes and returns focus to the trigger
- [ ] `aria-expanded` / `aria-haspopup` / `aria-controls` with a generated id
- [ ] Rail uses tablist semantics with roving tabindex, not `aria-current`
- [ ] Scrim is `aria-hidden`, click-to-close, not focusable
- [ ] Transitions respect reduced-motion
- [ ] Full-bleed panel anchors to a measured header bottom
- [ ] Mobile has a real close affordance and no hover dependency
- [ ] Closed panels remain selectable in the editor
