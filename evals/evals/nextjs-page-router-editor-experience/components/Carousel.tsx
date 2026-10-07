import { useEffect, useState } from "react";
import {
  ComponentProps,
  registerUniformComponent,
  UniformSlot,
  type UniformSlotWrapperComponentProps,
} from "@uniformdev/canvas-react";

export type CarouselProps = ComponentProps<{
  autoplay?: boolean;
}>;

export function CarouselComponent({ autoplay, component }: CarouselProps) {
  const [index, setIndex] = useState(0);
  const slideCount = component.slots?.slides?.length ?? 0;

  useEffect(() => {
    if (!autoplay || slideCount < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideCount), 4000);
    return () => clearInterval(timer);
  }, [autoplay, slideCount]);

  // The slot hands over its rendered slides; show the active one.
  const ActiveSlide = ({ items: slides }: UniformSlotWrapperComponentProps) => (
    <div className="carousel-slide">{slides[index]}</div>
  );

  return (
    <div className="carousel">
      <UniformSlot name="slides" wrapperComponent={ActiveSlide} />
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => setIndex((i) => (i - 1 + slideCount) % slideCount)}
      >
        &lsaquo;
      </button>
      <button type="button" aria-label="Next slide" onClick={() => setIndex((i) => (i + 1) % slideCount)}>
        &rsaquo;
      </button>
    </div>
  );
}

registerUniformComponent({
  type: "carousel",
  component: CarouselComponent,
});
