"use client";

import { useState, type ReactNode } from "react";

type AccordionItemClientProps = {
  title: ReactNode;
  children: ReactNode;
};

export function AccordionItemClient({ title, children }: AccordionItemClientProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="accordion-item">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        {title}
      </button>
      {isOpen && <div className="accordion-panel">{children}</div>}
    </div>
  );
}
