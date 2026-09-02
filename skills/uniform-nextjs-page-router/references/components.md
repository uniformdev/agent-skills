# Components

## Typing component props

Use `ComponentProps<T>` to type parameters. All parameter props must be optional because values can be undefined even when marked required on the definition:

```tsx
import { LinkParamValue, RichTextParamValue } from "@uniformdev/canvas";
import { AssetParamValue } from "@uniformdev/assets";

type HeroProps = ComponentProps<{
  textParameter?: string;
  richTextParameter?: RichTextParamValue;
  linkParameter?: LinkParamValue;
  assetParameter?: AssetParamValue;
}>;

function Hero(props: HeroProps) {
  return <div>{props.textParameter}</div>;
}
```

## Rendering slots

Use `UniformSlot` to render child components placed in a slot. Pass the slot name directly:

```tsx
import { UniformSlot } from "@uniformdev/canvas-react";

function Hero() {
  return (
    <div>
      <div>
        <UniformSlot name="start" />
      </div>
      <div>
        <UniformSlot name="end" />
      </div>
    </div>
  );
}
```

### Reading a slot's child data

`UniformSlot` renders children; it does not hand them to you. There is **no `children` render
prop** — the props are `name`, `resolveRenderer`, `wrapperComponent` and `emptyPlaceholder`,
and `wrapperComponent` receives already-rendered `items: ReactNode[]`, not component data.

When a parent needs its children's *data* — to build a tab rail, a summary, or a table of
contents from what authors placed in a slot — read it from the current component instead:

```tsx
import { useUniformCurrentComponent } from "@uniformdev/canvas-react";

const { data } = useUniformCurrentComponent();
const children = data?.slots?.["links"] ?? []; // ComponentInstance[], parameters included
```

Use that for metadata only. Keep rendering the children through `UniformSlot` — rebuilding
them from their parameters discards personalization, A/B tests, pattern links and the
editor's click targets.

> **`CustomSlotChildRenderFunc` is a dead export.** `@uniformdev/canvas-react` exports this
> type, and its options include the full `ComponentInstance` — so it looks purpose-built for
> the job above. No prop type in the package references it. Passing such a function compiles
> and is ignored at runtime.

## Rendering text parameters

Always use `UniformText` for text parameters to enable inline editing in Canvas preview. Specify a `placeholder` so authors see guidance when the value is empty:

```tsx
import { UniformText } from "@uniformdev/canvas-react";

function Hero() {
  return (
    <div>
      <UniformText parameterId="textParameter" placeholder="Enter text" />
      <UniformText
        parameterId="textParameter"
        as="h1"
        className="excellent"
        placeholder="Enter text"
      />
    </div>
  );
}
```

Text parameters without a visible element (e.g. alt text) can use the raw value directly from props.

## Rendering rich text parameters

Always use `UniformRichText` to render rich text (stored as Lexical JSON) to HTML:

```tsx
import { UniformRichText } from "@uniformdev/canvas-react";

function Hero() {
  return (
    <div>
      <UniformRichText
        parameterId="richTextParameter"
        placeholder="Prompt for author when value is empty"
      />
    </div>
  );
}
```

## Rendering asset parameters

Grab the **raw asset item** and hook everything off it. In Page Router the parameter **is** the asset-item array, so `singleImageAssetParam?.[0]` is a single item.

- **Image `src` → `imageFrom` from `@uniformdev/assets`** (the default). Accepts a raw asset item **or** a bare URL string, no-ops transforms for non-DAM sources, and auto-applies the DAM focal point + your resize/fit.
- **Other fields → read them straight off the raw item** — `item.fields.title?.value` (alt), `item.fields.width?.value`, `item.fields.height?.value`, etc.

```tsx
import { imageFrom, type AssetParamValue } from "@uniformdev/assets";

interface MyComponentProps {
  multipleImagesAssetParam: AssetParamValue;
  singleImageAssetParam: AssetParamValue;
}

function MyComponent({
  multipleImagesAssetParam,
  singleImageAssetParam,
}: MyComponentProps) {
  // Grab the raw item once — it drives both the src and the metadata.
  const single = singleImageAssetParam?.[0];
  const src = single
    ? imageFrom(single).transform({ width: 800, fit: "cover" }).url()
    : undefined;

  return (
    <>
      {src && (
        <img
          src={src}
          alt={single?.fields.title?.value ?? ""}
          width={single?.fields.width?.value}
          height={single?.fields.height?.value}
        />
      )}
      {/* Multiple assets: map the raw item array the same way. */}
      {multipleImagesAssetParam?.map((item, index) => (
        <img
          key={index}
          src={imageFrom(item).url()}
          alt={item.fields.title?.value ?? ""}
          width={item.fields.width?.value}
          height={item.fields.height?.value}
        />
      ))}
    </>
  );
}
```

`@uniformdev/assets` may be only a transitive dependency — add it explicitly (required under pnpm); `imageFrom` is **not** re-exported by `@uniformdev/canvas`.
