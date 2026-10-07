import { registerUniformComponent, UniformSlot } from "@uniformdev/canvas-react";

export function AccordionComponent() {
  return (
    <div className="accordion">
      <UniformSlot name="items" />
    </div>
  );
}

registerUniformComponent({
  type: "accordion",
  component: AccordionComponent,
});
