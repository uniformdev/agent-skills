# Editor state API

> ⚠️ Requires `@uniformdev/mesh-sdk` **≥ 20.78.0**.

`editorState` is an imperative handle on the composition or entry the author is editing. Its
main use is the one thing a location otherwise can't do: **mutate the surrounding content in
response to configuration the author performs inside your integration** — pick a product in
your UI and write its title, price, and image into sibling parameters; choose a template and
insert the components it implies.

## Where you get it

From `useMeshLocation()`, alongside `value` / `setValue` / `metadata`:

| Location | `editorState` |
|---|---|
| `canvasEditorTools` | always present |
| `paramType` | always present |
| `dataResource` | **may be `undefined`** |
| `dataResourceSelector` | **may be `undefined`** |

`undefined` means the location is rendered outside Canvas editor context — data type testing in
the integration settings, for example. In those two locations always guard:

```tsx
const { editorState } = useMeshLocation<'dataResourceSelector'>();
if (!editorState) return <Callout type="info">Open this from a composition to edit content.</Callout>;
```

## Mental model

- **Every method is async** — `await` all of them.
- **Non-reactive.** Nothing re-renders when the tree changes; read again after you write.
- **Changes are not saved.** They apply to editor state immediately and behave exactly like
  manual author edits — the author still has to save or publish. Never treat this as an API
  write, and never assume your mutation persisted.

## The common job: write parameters from your UI

Read-modify-write, because `updateNodeProperty` replaces the value rather than merging:

```tsx
const { editorState } = useMeshLocation<'paramType'>();

async function applyProduct(nodeId: string, product: { title: string; price: number }) {
  const current = await editorState.getNodeProperty<string>({ nodeId, property: 'heading' });

  await editorState.updateNodeProperty({
    nodeId,
    property: 'heading',
    value: product.title,
    type: 'text',        // required when the parameter does not exist yet
    locale: undefined,   // undefined = the invariant (non-localized) value
    conditionIndex: -1,  // -1 = the base value, not a conditional one
  });
}
```


**Compositions and entries differ at the root**: `exportTree()` returns `parameters` for a
composition and `fields` for an entry. Branch on that rather than assuming.

## The rest of the surface

Read it from the interface — it is one block with JSDoc on the subtle parts, and it changes,
so a list copied into this file would only go stale:

```bash
# range match, not `grep -A N` — the interface is ~104 lines and a fixed -A silently
# truncates the tail (the locale methods are last)
awk '/^interface EditorStateApi/,/^}$/' node_modules/@uniformdev/mesh-sdk/dist/index.d.ts
```

## Reference

- Docs: https://docs.uniform.app/docs/integrations/mesh-integrations/editor-state-api — useful
  for prose, but the types win where they disagree, as above.
