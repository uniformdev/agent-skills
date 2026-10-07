import type { AssetParamValue } from "@uniformdev/assets";
import { ComponentProps, registerUniformComponent } from "@uniformdev/canvas-react";

export type ImageProps = ComponentProps<{
  image?: AssetParamValue;
  width?: number;
  height?: number;
}>;

export function ImageComponent({ image, width, height }: ImageProps) {
  const item = image?.[0];
  const url = item?.fields.url.value;
  if (!url) return null;

  return <img src={url} alt={item?.fields.title?.value ?? ""} width={width} height={height} />;
}

registerUniformComponent({
  type: "image",
  component: ImageComponent,
});
