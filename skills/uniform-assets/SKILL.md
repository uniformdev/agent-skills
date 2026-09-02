---
name: uniform-assets
description: >-
  Working with Uniform image/media assets end to end — defining an `asset`
  parameter, rendering an image `src` with `imageFrom` (the graceful,
  future-proof default), reading other fields off the raw asset item, the stored
  asset-value shape, DAM library assets vs external `custom-url` assets,
  seeding/migrating asset values in compositions, and the traps around parameter
  type transitions. Use when a component needs an image/photo/video from Uniform,
  when converting a `text` URL field to an `asset` field, when you want
  responsive/transformed images with focal points.
metadata:
  author: uniformdev
  version: "1.1.0"
---

# Uniform assets

How to model, render, and author image/media assets in this Uniform.

## 1. Choose the parameter type deliberately

| Use | When |
|-----|------|
| `asset` parameter | Real content authors will pick/manage the image; you want the Canvas asset picker, DAM library, and image CDN/transforms. **Default for authored imagery.** |
| `text` parameter (URL) | Quick/pragmatic cases, throwaway/demo data, or an image URL that's genuinely just a string the author pastes. Simpler, but no picker, no metadata, no CDN transforms. |

Don't reach for `text` just to avoid the asset plumbing — the plumbing is small
(below). Reach for `text` only when a bare URL really is the right model and a text input is the right editor experience.

## 2. Define an asset parameter

In the component definition. Via MCP `mutateComponent` or `uniform-data/component/<type>.json`:

```json
{
  "id": "photo",
  "name": "Photo",
  "type": "asset",
  "typeConfig": { "allowedTypes": ["image"] },
  "guidance": "A square headshot image. If empty the card shows initials."
}
```

- `typeConfig.allowedTypes` ∈ `["image", "video", "audio", "other"]` (one or more).
- The parameter `id` must match the key you destructure in the `.tsx`.

## 3. Render an image `src` — `imageFrom` (the default)

**Default to `imageFrom` for turning an asset parameter into an img `src`.**
It is the most future-proof choice:

- Accepts a **raw asset item OR a bare URL string**, so it keeps working if the
  parameter's source ever changes (DAM ⇄ `custom-url` ⇄ external).
- **No-ops transforms** for non-image assets and anything outside the Uniform
  Asset Library — external / other-DAM URLs pass through unchanged, so one code
  path is correct for every source.
- **Auto-applies the asset's focal point** plus your resize/fit *when the image is
  a Uniform DAM asset*. Those features "just start working" after a move to the
  DAM, with **no code change**.

Use the `imageFrom` and `AssetParamValue` from `@uniformdev/assets`

```ts
import { imageFrom, type AssetParamValue } from "@uniformdev/assets";
```

### For use with a `ComponentParameter<AssetParamValue>`

When the parameter type you are working with is `ComponentParameter<AssetParamValue>`, first access the `.value`. It is an `AssetParamValue`, which is an array of `AssetParamValueItem`.

```tsx
// photo?: ComponentParameter<AssetParamValue>
const item = photo?.value?.[0];
```

### Build an img from a single `AssetParamValueItem`

Once you have a single item, build an img src and attributes from the `AssetParamValueItem` that `imageFrom` needs.

```tsx
const src = item
  ? imageFrom(item)
      .transform({ width: 192, height: 192, fit: "cover" })
      .url()
  : undefined;

if (!src) return null;
return <img src={src} alt={item?.fields.title?.value ?? ""} width={192} height={192} />;
```

Safety rules:

- **Give `imageFrom` a single item or a string — never the array.**
  `imageFrom([item])` returns `""` (empty), not the URL. Use `value[0]`.
- **Guard `undefined`/`null`.** `imageFrom(undefined)` / `imageFrom(null)`
  **throw** (`Cannot read properties … (reading 'fields')`). The `photo?.value?.[0]
  ? … : undefined` shape guards this; `imageFrom({}).url()` returns `""`.

`transform` options (`ImageFromTransformProps`): `width?`, `height?`,
`fit?: 'scale-down' | 'contain' | 'cover'`; and for `fit: 'cover'` also
`focal: 'auto' | 'center' | { x, y }` (numbers 0–1). The asset's own focal point
is respected automatically. Bare `imageFrom(asset).url()` extracts the URL with no
transform.

### With `next/image`

Enable the Uniform image host, then feed `imageFrom(...).url()` as `src`:

```ts
// next.config.ts
images: { remotePatterns: [{ protocol: "https", hostname: "img.uniform.global" }] }
```

Read intrinsic dimensions from the raw item (`item.fields.width?.value`) for DAM
assets; fall back to sensible defaults for external images.

## 4. Read other fields — off the raw item

`imageFrom` gives you the `src`. You already hold the **raw asset item** you passed
to it (`photo?.value?.[0]`), so **read the other fields straight off that item** —
each is a `{ type, value }` pair under `.fields`:

```tsx
const item = photo?.value?.[0];
const alt = item?.fields.title?.value ?? item?.fields.description?.value ?? "";
const width = item?.fields.width?.value;
const height = item?.fields.height?.value;
```

An item carries under `.fields` (whatever the asset has): `url`, `title`,
`description`, `mediaType`, `width`, `height`, `size`, `focalPoint`.

## 5. The stored asset-value shape

What lives in the composition JSON (and what Canvas edits) is an **array of
asset items** (`AssetParamValueItem[]`), even for a single image:

```json
"photo": {
  "type": "asset",
  "value": [
    {
      "type": "image",
      "_id": "<uuid>",
      "_source": "custom-url",
      "fields": {
        "url":       { "type": "text",   "value": "https://…/photo.jpg" },
        "title":     { "type": "text",   "value": "Jane Doe" },
        "mediaType": { "type": "text",   "value": "image/jpeg" },
        "width":     { "type": "number", "value": 300 },
        "height":    { "type": "number", "value": 300 }
      }
    }
  ]
}
```

`_id` is a unique ID that can be passed to a key attribute in certain frontend frameworks like React.

`_source` identifies where the asset came from (constants from `@uniformdev/canvas`):

- `ASSETS_SOURCE_UNIFORM` = `"uniform-assets"` — a managed **DAM library** asset.
- `ASSETS_SOURCE_CUSTOM_URL` = `"custom-url"` — an **external URL** with
  manually-set fields (no upload).

At render time `photo.value` arrives as this same `AssetParamValueItem[]` (each
element has `.fields`) — which is exactly what `imageFrom(value[0])` wants.

## Reference

- Rendering, `ComponentProps`, slots: `uniform-nextjs-app-router` skill,
  `references/components.md` (§ "Asset parameters").
- Uniform docs: "Rendering assets" — https://docs.uniform.app/docs/guides/composition/manage-assets/rendering-assets
- Modeling parameters/slots well: `uniform-experience-modeling` skill.
