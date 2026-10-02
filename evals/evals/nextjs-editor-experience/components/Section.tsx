import {
  ComponentParameter,
  ComponentProps,
  UniformSlot,
  UniformText,
} from "@uniformdev/next-app-router/component";

export type SectionProps = {
  title?: ComponentParameter<string>;
};
export type SectionSlots = "content" | "aside";

export const SectionComponent = ({
  parameters: { title },
  slots,
  component,
}: ComponentProps<SectionProps, SectionSlots>) => {
  // The aside column only exists when an editor has put something in it.
  const asideItems = (slots.aside?.items ?? []).filter(
    (item) => item && !item._id.startsWith("placeholder_")
  );
  const hasAside = asideItems.length > 0;

  return (
    <section>
      <UniformText component={component} parameter={title!} as="h2" placeholder="Section title" />
      <div className="section-body">
        <div className="stack">
          <UniformSlot slot={slots.content} />
        </div>
        {hasAside && (
          <aside>
            <UniformSlot slot={slots.aside} />
          </aside>
        )}
      </div>
    </section>
  );
};
