import type { RichTextParamValue } from "@uniformdev/canvas";
import {
  ComponentParameter,
  ComponentProps,
  UniformRichText,
} from "@uniformdev/next-app-router/component";

export type RichTextProps = {
  body?: ComponentParameter<RichTextParamValue>;
};

export const RichTextComponent = ({ parameters: { body }, component }: ComponentProps<RichTextProps>) => {
  return (
    <div className="prose">
      <UniformRichText component={component} parameter={body!} placeholder="Add body text" />
    </div>
  );
};
