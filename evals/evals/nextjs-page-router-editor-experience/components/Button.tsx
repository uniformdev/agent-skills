import type { AssetParamValue } from "@uniformdev/assets";
import type { LinkParamValue } from "@uniformdev/canvas";
import { ComponentProps, registerUniformComponent, UniformText } from "@uniformdev/canvas-react";

export type ButtonProps = ComponentProps<{
  label?: string;
  link?: LinkParamValue;
  icon?: AssetParamValue;
}>;

export function ButtonComponent({ label, link, icon }: ButtonProps) {
  if (!label) return null;

  const href = link?.path ?? "#";
  const iconUrl = icon?.[0]?.fields.url.value;

  return (
    <a href={href} className="button">
      {iconUrl && <img src={iconUrl} alt="" width={16} height={16} />}
      <UniformText parameterId="label" placeholder="Button label" />
    </a>
  );
}

registerUniformComponent({
  type: "button",
  component: ButtonComponent,
});
