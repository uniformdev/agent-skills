import type { AssetParamValue } from "@uniformdev/assets";
import { ComponentParameter, ComponentProps } from "@uniformdev/next-app-router/component";

export type ImageProps = {
  image?: ComponentParameter<AssetParamValue>;
  width?: ComponentParameter<number>;
  height?: ComponentParameter<number>;
};

export const ImageComponent = ({ parameters: { image, width, height } }: ComponentProps<ImageProps>) => {
  const item = image?.value?.[0];
  const url = item?.fields.url.value;
  if (!url) return null;

  return (
    <img
      src={url}
      alt={item?.fields.title?.value ?? ""}
      width={width?.value}
      height={height?.value}
    />
  );
};
