import {
  ComponentProps,
  registerUniformComponent,
  UniformSlot,
  UniformText,
} from "@uniformdev/canvas-react";

export type SectionProps = ComponentProps<{
  title?: string;
}>;

export function SectionComponent({ component }: SectionProps) {
  // The aside column only exists when an editor has put something in it.
  const asideItems = (component.slots?.aside ?? []).filter(
    (item) => !item._id?.startsWith("placeholder_")
  );
  const hasAside = asideItems.length > 0;

  return (
    <section>
      <UniformText parameterId="title" as="h2" placeholder="Section title" />
      <div className="section-body">
        <div className="stack">
          <UniformSlot name="content" />
        </div>
        {hasAside && (
          <aside>
            <UniformSlot name="aside" />
          </aside>
        )}
      </div>
    </section>
  );
}

registerUniformComponent({
  type: "section",
  component: SectionComponent,
});
