import { ComponentProps, registerUniformComponent, UniformSlot } from "@uniformdev/canvas-react";

// `label` is shown in the parent Tabs' tab bar.
export type TabProps = ComponentProps<{
  label?: string;
}>;

export function TabComponent() {
  return (
    <div className="tab">
      <UniformSlot name="content" />
    </div>
  );
}

registerUniformComponent({
  type: "tab",
  component: TabComponent,
});
