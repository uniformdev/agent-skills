import { useState } from "react";
import {
  registerUniformComponent,
  UniformSlot,
  useUniformCurrentComponent,
  type UniformSlotWrapperComponentProps,
} from "@uniformdev/canvas-react";

export function TabsComponent() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Tab labels live on the child `tab` components; read them so the tab bar can show them.
  const { data } = useUniformCurrentComponent();
  const tabs = (data?.slots?.tabs ?? []).map((tab, index) => {
    const label = tab.parameters?.label?.value;
    return { id: tab._id ?? String(index), label: typeof label === "string" ? label : "" };
  });

  const ActivePanel = ({ items: panels }: UniformSlotWrapperComponentProps) => (
    <div role="tabpanel">{panels[activeIndex]}</div>
  );

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <UniformSlot name="tabs" wrapperComponent={ActivePanel} />
    </div>
  );
}

registerUniformComponent({
  type: "tabs",
  component: TabsComponent,
});
