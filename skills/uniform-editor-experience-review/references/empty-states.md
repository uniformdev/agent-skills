# Empty states

What a component renders before an author fills it in. The gates used below (`isEditTab`,
`isInCanvas`) are defined in [detecting-the-editor.md](detecting-the-editor.md).

## Hide-when-empty guards

A component that renders nothing on the live site when it is empty must still render in the Edit
tab, or the author has nothing to select after dropping it in.

```tsx
// App Router
const hasLabel = Boolean(parameters.label?.value?.trim());
const hasIcon = Boolean(parameters.icon?.value?.length);
if (!hasLabel && !hasIcon && !isEditTab(context)) return null;
```

```tsx
// Page Router — parameter values arrive as props
function Button({ label, icon }: ButtonProps) {
  const { isEditTab } = useEditorGates();
  if (!label?.trim() && !icon?.length && !isEditTab) return null;
  // …
}
```

**What counts as content is what a visitor would see**, not configuration:

| Counts | Does not count |
|---|---|
| Label text, icon, image, video, child components in a slot | Link target, variant, colour, size, alignment |

- A button with an icon and no label is not empty.
- A button with a link and no label **is** empty: there is nothing to see or click. Guarding on
  "no label *and* no link" ships an empty `<a>` to production.
- A slot's items count only after filtering out editor placeholder items:
  [slot-placeholders.md](slot-placeholders.md#counting-and-branching-on-slot-contents).
- **An existing guard keeps its live-site condition.** Add the Edit-tab gate and change nothing
  else, so visitors get what they got before. If the condition also hides something a visitor
  would see, such as an icon-only button, report it under *Needs a manual check* instead of
  widening it.

**Optional text inside a component** needs the same treatment, one level down. `UniformText`
renders its tag even when the value is empty, so a `<p className="mt-4">` around an empty
subtitle leaves a gap in production. Gate the element on value *or* Edit tab — never on value
alone, which removes the edit target:

```tsx
{(subtitle?.value || isEditTab(context)) && (
  <UniformText component={component} parameter={subtitle!} as="p" className="mt-4" placeholder="Subtitle (optional)" />
)}
```

## Image and video placeholders

The SDKs ship no image or asset component, so the empty state goes into whatever renders the
project's media. When the asset parameter is empty:

- **Production:** render nothing. Never a broken `<img src="">`, never an empty sized box.
- **Edit tab:** render a placeholder that occupies the space the media will. Clicking it selects
  the component so the author can pick an asset in the parameter panel.

Size it from the same source the real media uses: the component's width/height parameters, or the
aspect ratio the layout gives the media slot.

```tsx
// App Router — raw asset item; the src/alt handling is in the App Router skill's components.md
const item = parameters.image?.value?.[0];
const url = item?.fields.url?.value;

if (!url) {
  if (!isEditTab(context)) return null;
  return <MediaPlaceholder label="Add an image" width={width} height={height} />;
}
```

```tsx
type MediaPlaceholderProps = { label: string; width?: number; height?: number; aspectRatio?: string };

// The size comes from the media's own dimensions; the look comes from the project's styles.
export const MediaPlaceholder = ({ label, width, height, aspectRatio = "16 / 9" }: MediaPlaceholderProps) => (
  <div className="media-placeholder" style={{ width: width ?? "100%", height, aspectRatio: height ? undefined : aspectRatio }}>
    {label}
  </div>
);
```

One shared placeholder component, used by image, video and any other media, keeps the editor
consistent.

- **Video** — the same rule, plus: no autoplay in the Edit tab
  ([interactive-components.md](interactive-components.md#stop-motion-in-the-edit-tab)).
- **A component that only makes sense with its media** (a full-bleed image banner) follows the
  hide-when-empty rule: nothing in production, placeholder in Edit.
- **A component that is still useful without it** (a card with no image) drops the media area in
  production and shows the placeholder in Edit.

## `UniformText` placeholders

- **Always pass `placeholder`.** Without it, an empty text field is an invisible zero-width
  element in the editor.
- **Write it as an instruction naming the field**, in the author's language: `"Card title"`,
  `"Button label"`, `"Short description (optional)"`. Not `"Text goes here"`, and not the
  parameter id.
- **Never gate `UniformText` on the value alone**; use the optional-text pattern above. It also
  renders nothing if the parameter object itself is missing from the component.
- **The placeholder is an attribute, not markup.** Canvas draws it from `data-uniform-placeholder`
  on an empty element, and your `render` function never sees it. While editing, the App Router
  never applies `render`; the Page Router skips it only while the field has focus, so a `render`
  that returns markup for an empty value hides the placeholder.
- **Function props.** `placeholder` also takes a function, `({ id }) => …`.
  - App Router: from a Server Component, pass strings. Function props, `placeholder` and
    `render` alike, cannot cross into the client text component; see the App Router skill's
    [components.md](../../uniform-nextjs-app-router/references/components.md).
  - Page Router: set a project-wide default once with `contextualEditingDefaultPlaceholder` on
    `<UniformComposition>` **and** on `<UniformPlayground>`, or patterns get none. It covers
    `UniformRichText` too, and a component's own `placeholder` overrides it.

## `UniformRichText` placeholders

The two SDKs differ here:

| | App Router | Page Router |
|---|---|---|
| Empty rich-text value in Canvas | Renders **nothing** — the placeholder never shows | Renders the placeholder in `<p><i>…</i></p>`, in both tabs |
| Parameter missing entirely | Renders nothing | Renders nothing |

In editor renders the App Router SDK marks only `text` parameters with `_contextualEditing`, and
its `UniformRichText` renders the placeholder and the empty-value output only for a marked
parameter. Render your own hint in the Edit tab:

```tsx
import { isRichTextValueConsideredEmpty } from "@uniformdev/richtext";

const value = parameters.body?.value;
const isEmpty = !value || isRichTextValueConsideredEmpty(value);

if (isEmpty) {
  return isEditTab(context) ? <p className="editor-hint">Add body text</p> : null;
}
return <UniformRichText component={component} parameter={parameters.body!} />;
```

The hint sits inside the component, so clicking it selects the component and the author edits
the rich text in the parameter panel.

## Values that are not visible

Some parameters never appear on the page: a video URL, an embed code, a markdown source, an
analytics id. Authors edit these in the parameter panel after selecting the component, which is
usually enough.

If they need to be editable in place, render a visible, labelled `UniformText` **in the Edit tab
only**. Do not ship a visually hidden (`sr-only`) `UniformText` to production to get the same
effect: screen readers read the raw value to visitors.

## Links

- **Clickable cards.** A card wrapped in one full-size link often sets `pointer-events: none` on
  its content so the whole card is the click target. In Canvas that makes every component inside
  the card unselectable. Drop it while in Canvas: `pointer-events: isInCanvas(context) ? undefined
  : "none"`.
- **Navigation.** In the Edit tab, Canvas stops link clicks before any handler runs, so an author
  selecting a link or typing into its label does not navigate away. No editor-specific link
  component or navigation gate is needed. The Preview tab navigates as the live site does.
- **Link targets** are edited in the parameter panel. A link with no target still needs its label
  visible in the Edit tab so there is something to select.

## "Component not found"

A resolver fallback that prints "not found" for unmapped types also shows on the live site. Report
it under *Needs a manual check* (E7) and leave the decision to the user; if they want it hidden
from visitors, render the message only when `isEditTab(context)`.
