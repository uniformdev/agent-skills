import { registerUniformComponent, UniformText } from "@uniformdev/canvas-react";

export function HeroComponent() {
  return (
    <section>
      <UniformText parameterId="title" as="h1" placeholder="Hero title" />
      <UniformText parameterId="subtitle" as="p" placeholder="Hero subtitle" />
    </section>
  );
}

registerUniformComponent({
  type: "hero",
  component: HeroComponent,
});
