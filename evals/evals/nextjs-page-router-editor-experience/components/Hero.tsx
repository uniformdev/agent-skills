import { registerUniformComponent, UniformText } from "@uniformdev/canvas-react";

export function HeroComponent() {
  return (
    <section>
      <UniformText parameterId="title" as="h1" placeholder="Enter title here" />
      <UniformText parameterId="description" as="p" placeholder="Enter description here" />
    </section>
  );
}

registerUniformComponent({
  type: "hero",
  component: HeroComponent,
});
