"use client";

import { Children, useEffect, useState, type ReactNode } from "react";

type CarouselClientProps = {
  autoplay: boolean;
  slideCount: number;
  children: ReactNode;
};

export function CarouselClient({ autoplay, slideCount, children }: CarouselClientProps) {
  const [index, setIndex] = useState(0);
  const slides = Children.toArray(children);

  useEffect(() => {
    if (!autoplay || slideCount < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideCount), 4000);
    return () => clearInterval(timer);
  }, [autoplay, slideCount]);

  return (
    <div className="carousel">
      <div className="carousel-slide">{slides[index]}</div>
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
