"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTERS } from "@/data/copy";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Screen-reader narration of important visual state: chapter changes,
 * bottleneck emergence, scan results and applied optimisations.
 * Politely rate-limited so it informs instead of chattering.
 */
export function SrStatus() {
  const [message, setMessage] = useState("");
  const lastAt = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const announce = (text: string) => {
      const now = Date.now();
      const wait = Math.max(0, 2000 - (now - lastAt.current));
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        lastAt.current = Date.now();
        setMessage(text);
      }, wait);
    };

    const unsubUI = useUIStore.subscribe((state, prev) => {
      if (state.activeChapter !== prev.activeChapter) {
        const ch = CHAPTERS.find((c) => c.index === state.activeChapter);
        if (ch) announce(`Chapter ${ch.index}: ${ch.title}.`);
      }
      if (state.scanStatus === "complete" && prev.scanStatus !== "complete") {
        const analysis = useSimStore.getState().analysis;
        if (analysis) announce(analysis.narrative);
      }
    });

    const unsubSim = useSimStore.subscribe((state, prev) => {
      const bn = state.sim.bottleneck;
      if (bn && bn !== prev.sim.bottleneck) {
        announce(`System alert: ${NODE_MAP[bn].name} has become the bottleneck.`);
      }
      if (state.appliedPulse > prev.appliedPulse && state.lastAppliedRec) {
        announce(`Applied: ${state.lastAppliedRec.title}. The system is reorganizing.`);
      }
    });

    return () => {
      unsubUI();
      unsubSim();
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  );
}
