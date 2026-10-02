import { ComponentProps, UniformSlot } from "@uniformdev/next-app-router/component";
import { compositionCache } from "./compositionCache";
import { TabsClient } from "./TabsClient";

export type TabsSlots = "tabs";

export const TabsComponent = ({ slots, context }: ComponentProps<unknown, TabsSlots>) => {
  // Tab labels live on the child `tab` components; read them so the tab bar can show them.
  const tabs = (slots.tabs?.items ?? []).flatMap((item) => {
    if (!item) return [];
    const data = compositionCache.getUniformComponent({
      compositionId: context._id,
      componentId: item._id,
    });
    const label = data?.parameters?.label?.value;
    return [{ id: item._id, label: typeof label === "string" ? label : "" }];
  });

  return (
    <TabsClient tabs={tabs}>
      <UniformSlot slot={slots.tabs} />
    </TabsClient>
  );
};
