"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download, Maximize2 } from "lucide-react";

/**
 * Full-screen deck viewer.
 *
 * A carousel is judged at full size — the thumbnail row is for picking, not for
 * reading. This shows one slide at a time as large as the viewport allows, with
 * the same navigation as the inline deck plus real browser fullscreen.
 *
 * Rendered through a portal so it escapes the post card's overflow and stacking
 * context; inside the card it would be clipped by the rounded container.
 */
export function DeckLightbox({
  images,
  startIndex = 0,
  onClose,
  label,
}: {
  images: string[];
  startIndex?: number;
  onClose: () => void;
  label?: string;
}) {
  const [i, setI] = useState(startIndex);
  const [mounted, setMounted] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (n: number) => setI((cur) => Math.max(0, Math.min(images.length - 1, cur + n))),
    [images.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      if (e.key === "Home") { e.preventDefault(); setI(0); }
      if (e.key === "End") { e.preventDefault(); setI(images.length - 1); }
    }
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the overlay owns the screen.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose, images.length]);

  // Touch swipe. Only horizontal intent counts, so a vertical drag does not
  // flick the slide.
  const touch = useRef<{ x: number; y: number } | null>(null);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label ?? "Carousel full screen"}
      ref={shellRef}
    >
      {/* Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white/90 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium tabular-nums">
          {i + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const el = shellRef.current;
              if (!document.fullscreenElement) el?.requestFullscreen?.();
              else document.exitFullscreen?.();
            }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/25 hover:bg-white/15"
            title="Browser full screen (F11-style)"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Full screen
          </button>
          <a
            href={images[i]}
            download
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/25 hover:bg-white/15"
          >
            <Download className="w-3.5 h-3.5" /> Slide
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/25 hover:bg-white/15 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center px-2 pb-2 relative"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          aria-label="Previous slide"
          className="absolute left-3 z-10 w-11 h-11 rounded-full bg-white/15 border border-white/30 text-white flex items-center justify-center hover:bg-white/25 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[i]}
          alt={`Slide ${i + 1} of ${images.length}`}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl select-none"
          draggable={false}
        />

        <button
          onClick={() => go(1)}
          disabled={i === images.length - 1}
          aria-label="Next slide"
          className="absolute right-3 z-10 w-11 h-11 rounded-full bg-white/15 border border-white/30 text-white flex items-center justify-center hover:bg-white/25 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Filmstrip */}
      <div
        className="shrink-0 flex gap-2 overflow-x-auto px-4 pb-4 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {images.map((url, n) => (
          <button
            key={n}
            onClick={() => setI(n)}
            className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
              n === i ? "border-[#ED383B]" : "border-transparent opacity-60 hover:opacity-100"
            }`}
            aria-label={`Go to slide ${n + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-16 w-auto" draggable={false} />
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
