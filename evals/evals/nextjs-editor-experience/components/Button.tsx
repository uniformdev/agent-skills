import type { AssetParamValue } from "@uniformdev/assets";
import type { LinkParamValue } from "@uniformdev/canvas";
import {
  ComponentParameter,
  ComponentProps,
  UniformText,
} from "@uniformdev/next-app-router/component";

export type ButtonProps = {
  label?: ComponentParameter<string>;
  link?: ComponentParameter<LinkParamValue>;
  icon?: ComponentParameter<AssetParamValue>;
};

export const ButtonComponent = ({
  parameters: { label, link, icon },
  component,
}: ComponentProps<ButtonProps>) => {
  if (!label?.value) return null;

  const href = link?.value?.path ?? "#";
  const iconUrl = icon?.value?.[0]?.fields.url.value;

  return (
    <a href={href} className="button">
      {iconUrl && <img src={iconUrl} alt="" width={16} height={16} />}
      <UniformText component={component} parameter={label} placeholder="Button label" />
    </a>
  );
};
