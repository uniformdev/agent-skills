import { ComponentProps, UniformSlot } from "@uniformdev/next-app-router/component";

export type PageProps = unknown;
export type PageSlots = "pageHeader" | "pageContent";

export const PageComponent = ({ slots }: ComponentProps<PageProps, PageSlots>) => {
  return (
    <>
      <UniformSlot slot={slots.pageHeader} />
      <main>
        <UniformSlot slot={slots.pageContent} />
      </main>
    </>
  );
};
