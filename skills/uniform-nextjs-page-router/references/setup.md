# Setup

## Required packages

Install the following npm packages:

```
@uniformdev/canvas
@uniformdev/canvas-react
@uniformdev/canvas-next
@uniformdev/context-react
```

## Fetching and rendering the composition

Create a dynamic catch-all route at `pages/[[...path]].tsx` to fetch and render the Uniform composition for the current path using SSR:

```tsx
import type { UniformCompositionNextPage } from "@uniformdev/canvas-next";
import { withUniformGetServerSideProps } from "@uniformdev/canvas-next/route";
import { UniformComposition } from "@uniformdev/canvas-react";

export const getServerSideProps = withUniformGetServerSideProps();

const page: UniformCompositionNextPage = ({ data }) => {
  return <UniformComposition data={data} />;
};

export { page as default };
```

## Component registration pattern

IMPORTANT: Before generating Uniform component code, always fetch available component definitions from Uniform to be aware of the schema.

Components are registered using `registerUniformComponent` and conventionally organized with a barrel file:

`components/Hero.tsx`:

```tsx
import { registerUniformComponent } from "@uniformdev/canvas-react";

function Hero() {
  return <div>Hero Component Content</div>;
}

registerUniformComponent({
  type: "hero",
  component: Hero,
});
```

Create a barrel file at `components/uniformComponents.ts` that imports all registered components:

```tsx
import "./Hero";
import "./CallToAction";
```

Import the barrel file in `pages/_app.tsx` to ensure all registrations are processed:

```tsx
import "../components/uniformComponents";
```
