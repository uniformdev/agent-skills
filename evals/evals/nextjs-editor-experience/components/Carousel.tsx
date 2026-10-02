import {
  ComponentParameter,
  ComponentProps,
  UniformSlot,
} from "@uniformdev/next-app-router/component";
import { CarouselClient } from "./CarouselClient";

export type CarouselProps = {
  autoplay?: ComponentParameter<boolean>;
};
export type CarouselSlots = "slides";

export const CarouselComponent = ({
  parameters: { autoplay },
  slots,
}: ComponentProps<CarouselProps, CarouselSlots>) => {
  return (
    <CarouselClient autoplay={Boolean(autoplay?.value)} slideCount={slots.slides?.items.length ?? 0}>
      <UniformSlot slot={slots.slides} />
    </CarouselClient>
  );
};
