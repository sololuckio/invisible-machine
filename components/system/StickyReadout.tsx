"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { fmtInt, fmtMoney, fmtPct } from "@/lib/format";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * A three-figure readout pinned under the nav on small screens.
 *
 * On a phone the console scrolls inside its own box, so the moment the visitor
 * reaches for a slider the numbers those sliders move have gone off-screen —
 * which removes the entire point of the chapter. This keeps the trio that
 * answers "did that help?" visible the whole time the machine is being worked.
 *
 * It is decorative reinforcement, not the source of truth: the full strip and
 * the screen-reader channel both still carry everything, so this is hidden
 * from assistive tech rather than duplicating announcements. Above 768px it
 * never renders at all — the strip is already in view there.
 */

const WORKING_CHAPTERS = new Set([3, 4, 5, 6]);

export function StickyReadout() {
  const active = useUIStore((s) => s.activeChapter);
  const m = useSimStore(
    useShallow((s) => ({
      health: Math.round(s.sim.metrics.systemHealth),
      trapped: Math.round(s.sim.metrics.trappedRevenue / 100) * 100,
      queue: Math.round(s.sim.metrics.totalQueue),
    })),
  );

  const healthRef = useRef<HTMLSpanElement>(null);
  const trappedRef = useRef<HTMLSpanElement>(null);
  const queueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (healthRef.current) healthRef.current.textContent = fmtPct(m.health);
    if (trappedRef.current) trappedRef.current.textContent = fmtMoney(m.trapped);
    if (queueRef.current) queueRef.current.textContent = fmtInt(m.queue);
  }, [m.health, m.trapped, m.queue]);

  if (!WORKING_CHAPTERS.has(active)) return null;

  const tone = m.health < 50 ? "danger" : m.health < 75 ? "warn" : "ok";

  return (
    <div className="sticky-readout" aria-hidden="true">
      <span className={`sticky-readout-item tone-${tone}`}>
        <span className="sticky-readout-key">HEALTH</span>
        <span ref={healthRef} className="sticky-readout-val">
          {fmtPct(m.health)}
        </span>
      </span>
      <span className="sticky-readout-item">
        <span className="sticky-readout-key">TRAPPED</span>
        <span ref={trappedRef} className="sticky-readout-val">
          {fmtMoney(m.trapped)}
        </span>
      </span>
      <span className="sticky-readout-item">
        <span className="sticky-readout-key">QUEUED</span>
        <span ref={queueRef} className="sticky-readout-val">
          {fmtInt(m.queue)}
        </span>
      </span>
    </div>
  );
}
