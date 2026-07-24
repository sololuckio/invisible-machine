"use client";

import { useEffect, useRef } from "react";
import { soundEngine } from "@/lib/audio";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Maps system events to the synthesised sound layer:
 * completed orders pulse, new bottlenecks warn, scans sweep,
 * applied optimisations resolve. All rate-limited inside the engine.
 */
export function useSoundDirector(): void {
  const lastCompleted = useRef(0);

  useEffect(() => {
    const unsubSim = useSimStore.subscribe((state, prev) => {
      if (!useUIStore.getState().soundOn) return;

      const completed = state.sim.metrics.completedOrders;
      if (completed - lastCompleted.current >= 30) {
        lastCompleted.current = completed;
        soundEngine.pulse();
      }

      if (state.sim.bottleneck && state.sim.bottleneck !== prev.sim.bottleneck) {
        soundEngine.warn();
      }

      if (state.appliedPulse > prev.appliedPulse) {
        soundEngine.resolve();
      }
    });

    const unsubUI = useUIStore.subscribe((state, prev) => {
      if (state.scanStatus === "scanning" && prev.scanStatus !== "scanning" && state.soundOn) {
        soundEngine.scan();
      }
    });

    return () => {
      unsubSim();
      unsubUI();
    };
  }, []);
}
