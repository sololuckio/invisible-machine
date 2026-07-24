"use client";

import { useEffect } from "react";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The guided narrative's stage direction: as the visitor scrolls into each
 * chapter, demand is choreographed so the story beats land — a trickle for
 * the first order, pressure for the bottleneck, calm for the epilogue.
 *
 * The director steps aside permanently once the visitor takes the controls
 * (userTouched) or enters the System Lab.
 */
export function useChapterDirector(): void {
  const chapter = useUIStore((s) => s.activeChapter);
  const labOpen = useUIStore((s) => s.labOpen);

  useEffect(() => {
    const sim = useSimStore.getState();
    if (labOpen || sim.userTouched) return;

    switch (chapter) {
      case 1:
      case 2:
        // A near-silent machine: one order at a time.
        sim.directControls({ demand: 6 });
        break;
      case 3:
        // Back to the scenario's honest baseline.
        sim.directControls({ demand: 40 });
        break;
      case 4:
      case 5:
        // Growth arrives. The narrowest chamber will announce itself,
        // and the AI scan in Chapter 5 gets a real problem to solve.
        sim.directControls({ demand: 92 });
        break;
      case 6:
        // Leave the state alone — the comparison must be honest.
        break;
      case 7:
      case 8:
        // The epilogue: calm but alive.
        sim.directControls({ demand: 34 });
        break;
    }
  }, [chapter, labOpen]);
}
