# Preview

## Contextual editing and live preview

Uniform's contextual editing requires two pieces: a **preview handler** (API route) and a **playground page**. The preview handler maps a composition ID to the correct frontend route. The playground page previews Uniform Patterns (reusable content components).

## Preview handler

Create `pages/api/preview.ts` using `createPreviewHandler`:

```tsx
import { createPreviewHandler } from "@uniformdev/canvas-next";

const handler = createPreviewHandler({
  secret: () => process.env.UNIFORM_PREVIEW_SECRET,
  playgroundPath: "/playground",
});

export default handler;
```

Set `UNIFORM_PREVIEW_SECRET` in `.env` to an arbitrary value. This same value must be configured in the Uniform Canvas preview settings.

## Playground page

Create `pages/playground.tsx` to preview patterns. Wrap `UniformPlayground` in the application's page shell:

```tsx
import { UniformPlayground } from "@uniformdev/canvas-react";

export default function Playground() {
  return <UniformPlayground behaviorTracking="onLoad" />;
}
```
