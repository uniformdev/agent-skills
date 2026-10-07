import { ComponentParameter, ComponentProps, UniformSlot } from "@uniformdev/next-app-router/component";

export type TabProps = {
  label?: ComponentParameter<string>;
};
export type TabSlots = "content";

export const TabComponent = ({ slots }: ComponentProps<TabProps, TabSlots>) => {
  return (
    <div className="tab">
      <UniformSlot slot={slots.content} />
    </div>
  );
};
