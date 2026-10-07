import { registerUniformComponent, UniformSlot } from "@uniformdev/canvas-react";

export function PageComponent() {
  return (
    <main>
      <UniformSlot name="content" />
    </main>
  );
}

registerUniformComponent({
  type: "page",
  component: PageComponent,
});
