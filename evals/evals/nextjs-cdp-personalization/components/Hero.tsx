import {
  ComponentParameter,
  ComponentProps,
  UniformText,
} from "@uniformdev/next-app-router/component";

export type HeroProps = {
  title?: ComponentParameter<string>;
  subtitle?: ComponentParameter<string>;
};

export const HeroComponent = ({
  parameters: { title, subtitle },
  component,
}: ComponentProps<HeroProps>) => {
  return (
    <section>
      <UniformText component={component} parameter={title!} as="h1" placeholder="Hero title" />
      <UniformText component={component} parameter={subtitle!} as="p" placeholder="Hero subtitle" />
    </section>
  );
};
