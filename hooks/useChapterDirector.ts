"use client";

import { useEffect, useRef } from "react";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The guided narrative's stage direction: demand is choreographed to the
 * current beat so the story lands as cause and effect rather than as a switch
 * being flipped. Chapter 4 in particular escalates — a stable baseline, then
 * rising demand, then real compression — so the constraint is watched forming
 * instead of simply appearing.
 *
 * The director steps aside permanently once the visitor takes the controls
 * (userTouched) or enters the System Lab.
 */

/** Demand the story asks for during each beat; null = leave the state alone. */
const DEMAND_BY_BEAT: Record<string, number | null> = {
  stillness: 6,
  instability: 6,
  ignition: 6,
  release: 6,
  descent: 6,
  hero: 6,
  pressure: 40,
  rising: 62,
  compression: 92,
  lock: 92,
  inspect: 92,
  prescan: 92,
  scan: 92,
  restructure: null,
  managed: null,
  reflect: 34,
  closure: 34,
  lab: null,
};

export function useChapterDirector(): void {
  const beat = useUIStore((s) => s.stageBeat);
  const labOpen = useUIStore((s) => s.labOpen);
  const directed = useRef<number | null>(null);

  useEffect(() => {
    const sim = useSimStore.getState();
    if (labOpen || sim.userTouched) return;

    const demand = DEMAND_BY_BEAT[beat] ?? null;
    if (demand === null || demand === directed.current) return;
    directed.current = demand;
    sim.directControls({ demand });
  }, [beat, labOpen]);
}
