"use client";

import { Children, useState, type ReactNode } from "react";
import { ComponentParameter, UniformText } from "@uniformdev/next-app-router/component";

type TabsClientProps = {
  tabs: { id: string; label: string }[];
  children: ReactNode;
};

export function TabsClient({ tabs, children }: TabsClientProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const panels = Children.toArray(children);

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
            {/* Make each child's label editable from the tab bar. */}
            <UniformText
              component={{ _id: tab.id }}
              parameter={
                {
                  parameterId: "label",
                  type: "text",
                  value: tab.label,
                  _contextualEditing: { isEditable: true },
                } as ComponentParameter<string>
              }
              placeholder="Tab label"
            />
          </button>
        ))}
      </div>
      <div role="tabpanel">{panels[activeIndex]}</div>
    </div>
  );
}
