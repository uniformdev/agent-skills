# Design system

All Mesh location UI must be built from `@uniformdev/design-system` so it matches the
Uniform dashboard. Do not hand-roll raw `<input>`/`<select>`/`<button>`, do not add another
UI kit, and do not rebuild spinners, lists, or placeholder markup by hand.

The package is the reference. It ships one fully-typed barrel with JSDoc on every prop, so
**look it up in the installed package** rather than guessing or trusting a list — the types
always match the version the project actually has.

## Discover what exists

```bash
# every component (≈200 in design-system 20.74.x). Match both declaration forms —
# `declare const` and `declare function` — or you silently miss whole components.
grep -oE "^declare (const|function) [A-Z][A-Za-z0-9]*" \
  node_modules/@uniformdev/design-system/dist/index.d.ts | awk '{print $3}' | sort -u

# one component's full prop contract, with defaults documented
grep -A 20 "^interface CalloutProps" node_modules/@uniformdev/design-system/dist/index.d.ts
```

Props are named `<Component>Props` (sometimes `interface`, sometimes `type` — grep for the
name, not the keyword). For the complete public surface including types and hooks, read the
`export { … }` barrel at the end of the file.

If a component is missing from the design system, check `@uniformdev/mesh-sdk-react` — it
declares ~93 mesh-specific components of its own and re-exports part of the design system.
Same recipe, same file layout:

```bash
grep -oE "^declare (const|function) [A-Z][A-Za-z0-9]*" \
  node_modules/@uniformdev/mesh-sdk-react/dist/index.d.ts | awk '{print $3}' | sort -u
```

Prefer an existing component over a new one. Search before you build.

## Which component for which job

Names only — get the current props from the package. This is a starting point for the
search above, not an inventory.

| Job | Start with |
|---|---|
| Text / password field | `Input` (spreads react-hook-form `register()`), `Textarea` |
| Dropdown, searchable select | `InputSelect`, `InputComboBox` |
| Checkbox / switch, button group | `InputToggle`, `SegmentedControl` |
| Editable key/value list | `KeyValueInput` |
| Spacing and grouping | `VerticalRhythm`, `HorizontalRhythm`, `Container`, `Fieldset` |
| Banner, inline error | `Callout`, `ErrorMessage` |
| Loading state | `LoadingOverlay` (region), `LoadingIndicator` (inline), `Skeleton` |
| Selectable list, table, pager | `ScrollableList`, `Table`, `Pagination` |
| Search-and-pick a record | `ObjectSearchContainer`, `ObjectSearchResultList`, `DebouncedInputKeywordSearch` — **from `@uniformdev/mesh-sdk-react`**, not the design system |
| Actions and text | `Button`, `Heading`, `Paragraph`, `Label`, `Icon` / `IconsProvider` |

## What the types will not tell you

These are the traps — no amount of reading the package surfaces them.

- **There is no `ErrorBoundary`.** Wrap async work in `try/catch`; render field errors with
  `ErrorMessage` and page-level status with `<Callout type="danger">`.
- **There is no `useOpenDialog` hook.** Open a secondary panel through the SDK instead:

  ```tsx
  import { useUniformMeshSdk } from '@uniformdev/mesh-sdk-react';

  const result = await useUniformMeshSdk().openLocationDialog<ReturnType, DialogParams>({
    locationKey: 'my-dialog',   // a location declared in the manifest
    options: { width: 'medium', params: { /* passed to the dialog page */ } },
  });
  ```

  The dialog page reads its input from `useMeshLocation()` `dialogContext` and returns a
  value when it closes.
- **Validation rides on `setValue`,** not on the component. Return a `ValidationResult`
  (`{ isValid, validationMessage? }`, re-exported by `@uniformdev/mesh-sdk-react`):

  ```tsx
  setValue((prev) => ({
    newValue: prev,
    options: value ? { isValid: true } : { isValid: false, validationMessage: 'Required' },
  }));
  ```
- **`CalloutType` is a string union** — pass the literal (`type="danger"`), not an enum.
- **Emotion is the styling layer.** Add `@emotion/react` if you write `css={...}` props.
- **Mesh locations are whole surfaces** — pickers, slide-ins, full pages — not just form
  fields. Compose them from the same components; see `data-connector.md` for the picker.

## Browsable reference

For humans, or when you have web access and want to see a component rendered:

- Platform design system storybook — https://design.uniform.app/
- Mesh SDK React storybook — https://storybook.mesh.uniform.app/
- Design system component reference — https://sdk.uniform.app/design-system
