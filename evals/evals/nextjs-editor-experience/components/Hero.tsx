import {
  ComponentParameter,
  ComponentProps,
  UniformText,
} from "@uniformdev/next-app-router/component";

export type HeroProps = {
  title?: ComponentParameter<string>;
  description?: ComponentParameter<string>;
};

export const HeroComponent = ({
  parameters: { title, description },
  component,
}: ComponentProps<HeroProps>) => {
  return (
    <section>
      <UniformText
        component={component}
        parameter={title!}
        as="h1"
        placeholder="Enter title here"
      />
      <UniformText
        component={component}
        parameter={description!}
        as="p"
        placeholder="Enter description here"
      />
    </section>
  );
};
