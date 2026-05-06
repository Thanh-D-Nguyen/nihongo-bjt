"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal scroll strip with edge-fade, thin scrollbar, and arrow buttons for mouse users.
 * Replaces the pattern: <div className="scroll-fade"><div className="flex ... overflow-x-auto scrollbar-none ...">
 */
export function ScrollStrip({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = useCallback((dir: -1 | 1) => {
    ref.current?.scrollBy({ behavior: "smooth", left: dir * 260 });
  }, []);

  return (
    <div className="group/scroll relative">
      {/* Left arrow */}
      {canLeft && (
        <button
          aria-label="Scroll left"
          className="absolute -left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-md ring-1 ring-ink/8 backdrop-blur transition-opacity hover:bg-white sm:block"
          onClick={() => scroll(-1)}
          type="button"
        >
          <svg className="h-4 w-4 text-ink/60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="m15 19-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Scroll container */}
      <div
        className={`flex gap-3 overflow-x-auto scrollbar-thin pb-2 ${className ?? ""}`}
        ref={ref}
      >
        {children}
      </div>

      {/* Right arrow */}
      {canRight && (
        <button
          aria-label="Scroll right"
          className="absolute -right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-md ring-1 ring-ink/8 backdrop-blur transition-opacity hover:bg-white sm:block"
          onClick={() => scroll(1)}
          type="button"
        >
          <svg className="h-4 w-4 text-ink/60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
