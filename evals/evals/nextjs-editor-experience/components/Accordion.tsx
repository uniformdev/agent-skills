import { ComponentProps, UniformSlot } from "@uniformdev/next-app-router/component";

export type AccordionSlots = "items";

export const AccordionComponent = ({ slots }: ComponentProps<unknown, AccordionSlots>) => {
  return (
    <div className="accordion">
      <UniformSlot slot={slots.items} />
    </div>
  );
};
