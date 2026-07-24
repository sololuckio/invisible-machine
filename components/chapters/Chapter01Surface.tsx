"use client";

import { useEffect, useRef } from "react";
import { IconArrowDown } from "@/components/ui/icons";
import { CHAPTERS, UI_STRINGS } from "@/data/copy";
import { scrollState } from "@/lib/scrollState";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[0];

export function Chapter01Surface() {
  const revealRef = useRef<HTMLDivElement>(null);

  // The payoff line rides the surface split itself: it fades in exactly as
  // the slab opens, driven from scrollState at zero React cost.
  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1";
      return;
    }
    let raf = 0;
    let last = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = Math.min(1, Math.max(0, (scrollState.surface - 0.28) / 0.35));
      if (Math.abs(t - last) < 0.01) return;
      last = t;
      el.style.opacity = t.toFixed(3);
      el.style.transform = `translateY(${((1 - t) * 22).toFixed(1)}px)`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ChapterSection ch={ch} heightClass="min-h-[240vh]">
      <div className="chapter-layout">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} as="h1" bodyUpTo={1} size="lg" />
          <div ref={revealRef} className="surface-reveal">
            <p className="chapter-body chapter-body-strong">{ch.body[1]}</p>
          </div>
          <p className="scroll-hint" aria-hidden="true">
            <IconArrowDown /> {UI_STRINGS.scrollHint}
          </p>
        </div>
      </div>
    </ChapterSection>
  );
}
