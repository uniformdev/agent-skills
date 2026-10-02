import {
  ComponentParameter,
  ComponentProps,
  UniformSlot,
  UniformText,
} from "@uniformdev/next-app-router/component";
import { AccordionItemClient } from "./AccordionItemClient";

export type AccordionItemProps = {
  title?: ComponentParameter<string>;
};
export type AccordionItemSlots = "content";

export const AccordionItemComponent = ({
  parameters: { title },
  slots,
  component,
}: ComponentProps<AccordionItemProps, AccordionItemSlots>) => {
  return (
    <AccordionItemClient
      title={<UniformText component={component} parameter={title!} placeholder="Question" />}
    >
      <UniformSlot slot={slots.content} />
    </AccordionItemClient>
  );
};
