"use client";

import { useEffect } from "react";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/** Engine cadence: 4 cycles per second. */
const TICK_MS = 250;

/**
 * Drives the simulation clock. The loop only runs after the boot sequence
 * and stops entirely while the tab is hidden — no wasted work, no drift.
 */
export function useSimulationLoop(): void {
  const bootDone = useUIStore((s) => s.bootDone);

  useEffect(() => {
    if (!bootDone) return;

    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => useSimStore.getState().tick(), TICK_MS);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bootDone]);
}
