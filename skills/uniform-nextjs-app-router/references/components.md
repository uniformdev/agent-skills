# Components

All Uniform components receive standardized props through `ComponentProps<TParameters, TSlotNames>`. Components are React Server Components by default — only add `"use client"` when you need browser APIs or interactivity.

## The resolveComponent function

`UniformComposition` uses a `resolveComponent` function to map each Uniform component's `type` to a React component. It receives the raw `ComponentInstance` and returns a `ResolveComponentResult`. Create it at `components/resolveComponent.ts`:

```ts
import {
  ResolveComponentFunction,
  type ResolveComponentResult,
} from "@uniformdev/next-app-router";

import { DefaultNotFoundComponent } from "./default";
import { HeroComponent } from "./hero";
import { PageComponent } from "./page";

export const resolveComponent: ResolveComponentFunction = ({ component }) => {
  let result: ResolveComponentResult | undefined;

  if (component.type === "page") {
    result = { component: PageComponent };
  } else if (component.type === "hero") {
    result = { component: HeroComponent };
  }

  return result || { component: DefaultNotFoundComponent };
};
```

Default fallback component:

```tsx
import { ComponentProps } from "@uniformdev/next-app-router/component";

export const DefaultNotFoundComponent = ({ type }: ComponentProps) => {
  return <div>Not Found: {type}</div>;
};
```

The resolve result also supports a `suspense` option for streaming slow components — see `references/advanced.md`.

## Component props

Every component receives these props:

| Prop | Type | Description |
|------|------|-------------|
| `type` | `string` | Component type identifier (e.g. `"hero"`) |
| `variant` | `string \| undefined` | Active variant ID when inside a personalization or test |
| `parameters` | `TParameters` | Parameter values, each wrapped in `ComponentParameter<T>` |
| `slots` | `Record<TSlotNames, SlotDefinition>` | Child component slots |
| `component` | `ComponentContext` | Component metadata (`_id`, `_parentId`, `slotName`, `slotIndex`) |
| `context` | `CompositionContext` | Composition metadata (`_id`, `type`, `state`, `isContextualEditing`, `matchedRoute`, `dynamicInputs`, `pageState`) |

## Component props and parameters

CRITICAL rules:
1. Parameter types must be wrapped with `ComponentParameter<T>`.
2. Parameters are accessed via the `parameters` object — not destructured directly from props.
3. All parameters MUST be optional (`?`) — they can be undefined at runtime even if marked required in the definition (e.g. a newly added component not yet filled in).

> **TypeScript:** rule #3 makes your parameter props optional, but `UniformText`/`UniformRichText` type their `parameter` prop as required.Ppass a non-null assertion instead — `parameter={title!}`. This is safe at runtime: these components render the `placeholder` when the value is empty or the parameter is undefined. 

```tsx
import {
  ComponentParameter,
  ComponentProps,
  UniformText,
  UniformRichText,
} from "@uniformdev/next-app-router/component";

export type HeroProps = {
  title?: ComponentParameter<string>;
  description?: ComponentParameter<string>;
};

export const HeroComponent = ({
  parameters: { title, description },
  component,
}: ComponentProps<HeroProps>) => {
  return (
    <section>
      <UniformText
        component={component}
        parameter={title}
        as="h1"
        className="title"
        placeholder="Enter title here"
      />
      <UniformRichText
        component={component}
        parameter={description}
        placeholder="Enter description here"
      />
    </section>
  );
};
```

### Accessing raw parameter values

When you need a value directly (non-visible values like alt text, URLs, or conditional logic), read `.value`:

```tsx
import { ComponentParameter, ComponentProps } from "@uniformdev/next-app-router/component";

type BannerProps = {
  title?: ComponentParameter<string>;
  linkUrl?: ComponentParameter<string>;
  isVisible?: ComponentParameter<boolean>;
};

export const BannerComponent = ({
  parameters: { title, linkUrl, isVisible },
}: ComponentProps<BannerProps>) => {
  if (isVisible?.value === false) return null;
  return (
    <a href={linkUrl?.value ?? "#"}>
      <h2>{title?.value ?? "Default title"}</h2>
    </a>
  );
};
```

## UniformText

Renders a text parameter with built-in inline editing in the Uniform visual editor. Pass `component` and the `parameter` object (not a `parameterId`):

```tsx
<UniformText
  component={component}      // Required: ComponentContext from props
  parameter={title}          // Required: the ComponentParameter<string>
  as="h1"                   // Optional: HTML element (default: "span")
  className="text-xl"        // Optional: CSS class
  placeholder="Enter title"  // Optional: placeholder shown in editor when empty
  isMultiline={false}        // Optional: enables multi-line editing (default: false)
  render={(value) => value?.toUpperCase()} // Optional: transform the value
/>
```

> **`UniformText`/`UniformRichText` are Client Components — never pass them a function from a Server Component.** Props that take a function (`render` here, and `resolveRichTextRenderer` on `UniformRichText` below) throw `Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"` at render — a hard 500 — because your component is a Server Component by default. Either mark the wrapping component `"use client"`, or do the transform in markup/CSS instead (e.g. render decorative quote marks with a sibling element rather than passing a `render` function). This is easy to miss: the page renders fine until the parameter actually reaches the function prop.

`UniformText` also supports conditional parameter values driven by quirks — it automatically evaluates quirk-based conditions and renders the matching value.

## UniformRichText

Renders rich text (stored as Lexical JSON) to HTML with full formatting support:

```tsx
<UniformRichText
  component={component}      // Required: ComponentContext from props
  parameter={description}    // Required: the ComponentParameter<RichTextParamValue>
  as="div"                  // Optional: wrapper element (default: "div"), null for no wrapper
  className="prose"          // Optional: CSS class
  placeholder="Enter text"   // Optional: placeholder shown in editor when empty
  resolveRichTextRenderer={customResolver} // Optional: custom node renderers (a function — see the Client Component note above)
/>
```

## Rendering slots

Define slot names as a union type in the second generic of `ComponentProps`, then render with `UniformSlot`:

```tsx
import { ComponentProps, UniformSlot } from "@uniformdev/next-app-router/component";

export type PageProps = unknown;
export type PageSlots = "content" | "header" | "footer";

export const PageComponent = ({ slots }: ComponentProps<PageProps, PageSlots>) => {
  return (
    <>
      <header><UniformSlot slot={slots.header} /></header>
      <main><UniformSlot slot={slots.content} /></main>
      <footer><UniformSlot slot={slots.footer} /></footer>
    </>
  );
};
```

### Custom slot rendering

`UniformSlot` accepts a `children` render function for wrapping individual slot items:

```tsx
<UniformSlot slot={slots.content}>
  {({ child, _id, key, slotName, slotIndex }) => (
    <div key={key} data-id={_id} className="slot-wrapper">
      {child}
    </div>
  )}
</UniformSlot>
```

### Rendering slot items directly

Iterate over slot items for full control:

```tsx
export const PageComponent = ({ slots }: ComponentProps<PageProps, PageSlots>) => {
  return (
    <ul>
      {slots.content.items.map((item) => (
        <li key={item?._id}>{item?.component}</li>
      ))}
    </ul>
  );
};
```

### getUniformSlot utility

Extract slot items as an array (`ReactNode[] | undefined`). Useful to count items, conditionally render, or apply array operations before rendering:

```tsx
import { getUniformSlot } from "@uniformdev/next-app-router/component";

const items = getUniformSlot({ slot: slots.content });
```

To access the full `ComponentInstance` data behind slot items (composition-level metadata, parameter values), use the composition cache — see `references/advanced.md`.

## Asset parameters

There is no `UniformAsset` component. Grab the **raw asset item** and hook everything off it:

- **Image `src` → `imageFrom` from `@uniformdev/assets`.** This is the default for turning an asset into an `<img>`/`next/image` `src`. It accepts a raw asset item **or** a bare URL string, no-ops transforms for non-DAM sources, and auto-applies the DAM focal point + your resize/fit — so one code path stays correct across `custom-url`, external, and DAM assets, and through parameter-type transitions where a transient bare-string value can appear.
- **Other fields → read them straight off the raw item you already hold** — `item.fields.title?.value` (alt), `item.fields.width?.value`, `item.fields.height?.value`, `mediaType`, etc.

> **Pass `.value[0]` (a single item) — not the parameter wrapper.** In the App Router, parameters arrive wrapped in `ComponentParameter<T>` (a `{ type, value }` object with no `fields`), and `.value` is the `AssetParamValueItem[]` array. `imageFrom` wants one item, so pass `singleImage?.value?.[0]`.

```tsx
import { imageFrom, type AssetParamValue } from "@uniformdev/assets";
import {
  ComponentParameter,
  ComponentProps,
} from "@uniformdev/next-app-router/component";

interface MyComponentProps {
  multipleImages?: ComponentParameter<AssetParamValue>;
  singleImage?: ComponentParameter<AssetParamValue>;
}

function MyComponent({
  parameters: { multipleImages, singleImage },
}: ComponentProps<MyComponentProps>) {
  // Grab the raw item once — it drives both the src and the metadata.
  const item = singleImage?.value?.[0];
  const src = item
    ? imageFrom(item).transform({ width: 800, fit: "cover" }).url()
    : undefined;

  return (
    <>
      {src && (
        <img
          src={src}
          alt={item?.fields.title?.value ?? ""}
          width={item?.fields.width?.value}
          height={item?.fields.height?.value}
        />
      )}
      {/* Multiple assets: map the raw item array the same way. */}
      {multipleImages?.value?.map((item, index) => (
        <img
          key={index}
          src={imageFrom(item).transform({ width: 400, fit: "cover" }).url()}
          alt={item.fields.title?.value ?? ""}
          width={item.fields.width?.value}
          height={item.fields.height?.value}
        />
      ))}
    </>
  );
}
```

## Type definitions

### ComponentProps

```tsx
type ComponentProps<
  TParameters extends Record<string, ComponentParameter> | unknown,
  TSlotNames extends string = string,
> = {
  type: string;                              // Component type
  variant: string | undefined;               // Active variant ID
  slots: Record<TSlotNames, SlotDefinition>; // Child slots
  parameters: TParameters;                   // Parameter values
  component: ComponentContext;               // Component metadata
  context: CompositionContext;               // Composition context
};
```

### ComponentContext

```tsx
type ComponentContext = {
  _id: string;
  _parentId: string | null;
  slotName: string | undefined;
  slotIndex: number | undefined;
};
```

### CompositionContext

```tsx
type CompositionContext = {
  _id: string;
  type: string;
  state: number;
  isContextualEditing: boolean;
  matchedRoute: string;
  dynamicInputs: Record<string, string>;
  pageState: PageState;
};
```

### SlotDefinition

```tsx
type SlotDefinition = {
  name: string;
  items: ({
    _id: string;
    $pzCrit: VariantMatchCriteria | undefined; // Personalization criteria
    variantId: string | undefined;             // For test/personalization variants
    component: ReactNode;
  } | null)[];
};
```

### ComponentParameter

```tsx
type ComponentParameter<TValue = unknown> = BaseComponentParameter<TValue> & {
  parameterId: string;
  _contextualEditing?: { isEditable: boolean };
};
```
