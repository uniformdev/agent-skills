import { useState } from "react";
import { registerUniformComponent, UniformSlot, UniformText } from "@uniformdev/canvas-react";

export function AccordionItemComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="accordion-item">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        <UniformText parameterId="title" placeholder="Question" />
      </button>
      {isOpen && (
        <div className="accordion-panel">
          <UniformSlot name="content" />
        </div>
      )}
    </div>
  );
}

registerUniformComponent({
  type: "accordionItem",
  component: AccordionItemComponent,
});
