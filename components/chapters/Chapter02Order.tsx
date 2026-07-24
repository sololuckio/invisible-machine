"use client";

import { useEffect, useRef } from "react";
import { CHAPTERS } from "@/data/copy";
import { scrollState } from "@/lib/scrollState";
import { NODE_DEFS } from "@/simulation/nodes";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[1];

/**
 * The visitor rides one glowing order down the shaft. The stage manifest
 * tracks the hero's position — highlighted imperatively from scrollState,
 * so it stays perfectly in sync with the 3D descent at zero render cost.
 */
export function Chapter02Order() {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    let raf = 0;
    let last = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const active = Math.min(
        items.length - 1,
        Math.floor(scrollState.order * (items.length + 0.35)),
      );
      if (active !== last) {
        last = active;
        items.forEach((el, i) => {
          el.classList.toggle("is-active", i === active);
          el.classList.toggle("is-passed", i < active);
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ChapterSection ch={ch} heightClass="min-h-[280vh]">
      <div className="chapter-layout is-split">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} />
        </div>
        <ol ref={listRef} className="stage-manifest" aria-label="The order's journey">
          {NODE_DEFS.map((def) => (
            <li key={def.id} className="stage-item">
              <span className="stage-tag">{def.tag}</span>
              <span className="stage-name">{def.name}</span>
            </li>
          ))}
        </ol>
      </div>
    </ChapterSection>
  );
}
