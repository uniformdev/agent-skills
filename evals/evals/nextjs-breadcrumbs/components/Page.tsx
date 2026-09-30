import { ComponentProps, UniformSlot } from "@uniformdev/next-app-router/component";

export type PageProps = unknown;
export type PageSlots = "content";

export const PageComponent = ({ slots }: ComponentProps<PageProps, PageSlots>) => {
  return (
    <main>
      <UniformSlot slot={slots.content} />
    </main>
  );
};
