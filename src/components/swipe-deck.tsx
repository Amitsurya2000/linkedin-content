"use client";

import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal slide deck you can swipe through — the way a LinkedIn carousel
 * actually behaves.
 *
 * Touch keeps the browser's native momentum scrolling (with scroll-snap doing
 * the settling); mouse users get click-drag, arrows, dots and arrow keys, none
 * of which they had when this was a bare `overflow-x-auto` row.
 */
export function SwipeDeck({
  children,
  slideClassName = "w-[70%]",
  gapClassName = "gap-2",
  showDots = true,
  label = "Slides",
  className = "",
}: {
  children: React.ReactNode;
  /** Width of each slide — the deck is only swipeable if slides overflow. */
  slideClassName?: string;
  gapClassName?: string;
  showDots?: boolean;
  label?: string;
  className?: string;
}) {
  const slides = Children.toArray(children);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Mouse drag state. Touch is left to the browser.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (!kids.length) return;

    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    kids.forEach((k, i) => {
      const kCenter = k.offsetLeft - kids[0].offsetLeft + k.offsetWidth / 2;
      const dist = Math.abs(kCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });

    setIndex(best);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
    setOverflows(el.scrollWidth > el.clientWidth + 1);
  }, []);

  // Images arrive after first paint, so widths (and therefore whether the deck
  // even overflows) are only known once they've laid out.
  useLayoutEffect(() => {
    sync();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [sync, slides.length]);

  useEffect(() => {
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync]);

  const goTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const target = kids[Math.max(0, Math.min(i, kids.length - 1))];
    if (!target) return;
    el.scrollTo({ left: target.offsetLeft - kids[0].offsetLeft, behavior: "smooth" });
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Native touch scrolling already feels right — don't hijack it.
    if (e.pointerType === "touch") return;
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    // Snap fights a scrollLeft we're driving by hand; restored on release.
    el.style.scrollSnapType = "none";
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
    sync();
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    const el = scrollerRef.current;
    if (!el) return;
    el.releasePointerCapture?.(e.pointerId);
    el.style.scrollSnapType = "";
    if (drag.current.moved) goTo(index);
  }

  // A drag that ends on a slide shouldn't also fire that slide's click.
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
    if (e.key === "Home") { e.preventDefault(); goTo(0); }
    if (e.key === "End") { e.preventDefault(); goTo(slides.length - 1); }
  }

  const arrowCls =
    "absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[#14141A]/85 backdrop-blur border border-white/20 shadow-lg flex items-center justify-center text-white hover:bg-[#14141A] hover:border-[#ED383B] disabled:opacity-0 disabled:pointer-events-none transition-all";

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onScroll={sync}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
        className={`flex ${gapClassName} overflow-x-auto snap-x snap-mandatory pb-2 outline-none [&::-webkit-scrollbar]:hidden focus-visible:ring-2 focus-visible:ring-[#ED383B]/40 rounded-xl ${
          overflows ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`snap-start shrink-0 ${slideClassName}`}
            aria-label={`Slide ${i + 1} of ${slides.length}`}
            aria-roledescription="slide"
          >
            {slide}
          </div>
        ))}
      </div>

      {overflows && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={atStart}
            aria-label="Previous slide"
            className={`${arrowCls} left-1`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={atEnd}
            aria-label="Next slide"
            className={`${arrowCls} right-1`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {showDots && overflows && slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-[#ED383B]" : "w-1.5 bg-white/[.08] hover:bg-[#ED383B]/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
