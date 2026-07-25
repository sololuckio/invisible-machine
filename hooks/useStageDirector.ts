"use client";

import { useEffect } from "react";
import { fxBus } from "@/components/experience/fxBus";
import { damp } from "@/lib/motion";
import { scrollState } from "@/lib/scrollState";
import { computeStage, RESTRUCTURE_MS, stageState } from "@/lib/stage";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The stage director. Once per frame it decides which beat the experience is
 * playing, damps the machine's energy toward that beat's tempo, and publishes
 * the result three ways:
 *
 *   • `stageState`  — read by the 3D frame loops (no React work)
 *   • `data-stage`  — read by CSS, which recedes the chrome in cinematic beats
 *   • the UI store  — only on beat boundaries, for the few React consumers
 *
 * It also owns the "a recommendation just landed" window, so the payoff beat
 * plays in the 2D diagram view too, not only in the 3D scene.
 */
export function useStageDirector(): void {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let last = performance.now();

    // Start in control mode and let the first frame promote it: the chrome is
    // never hidden by a beat that has not been computed yet.
    stageState.cinematic = false;
    root.dataset.stage = "control";
    root.dataset.beat = stageState.beat;

    // Applying a recommendation opens a short cinematic payoff window.
    const unsubSim = useSimStore.subscribe((state, prev) => {
      if (state.appliedPulse > prev.appliedPulse && state.lastAppliedRec) {
        fxBus.appliedAt = performance.now();
        fxBus.popNode = state.lastAppliedRec.targetNode;
        fxBus.popAt = fxBus.appliedAt;
      }
    });

    // Touching a console means the visitor is working: control mode wins.
    const onEngage = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".chapter-console, .lab-overlay, .settings-root")) return;
      const ui = useUIStore.getState();
      if (ui.engagedChapter !== ui.activeChapter) ui.engageConsole(ui.activeChapter);
    };
    document.addEventListener("pointerdown", onEngage, true);
    document.addEventListener("focusin", onEngage, true);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;

      const ui = useUIStore.getState();
      const restructuring = fxBus.appliedAt > 0 && now - fxBus.appliedAt < RESTRUCTURE_MS;

      const next = computeStage({
        chapterFloat: scrollState.chapterFloat,
        surface: scrollState.surface,
        scanning: ui.scanStatus === "scanning",
        scanComplete: ui.scanStatus === "complete",
        restructuring,
        labOpen: ui.labOpen,
        reducedMotion: ui.reducedMotion,
        engagedChapter: ui.engagedChapter,
      });

      if (next.beat !== stageState.beat) {
        // The constraint lock is a moment, not a state — stamp when it lands.
        if (next.beat === "lock") fxBus.lockAt = now;
        stageState.beat = next.beat;
        // Published on the root element too: CSS can key off it, and browser
        // verification can assert the beat instead of inferring it.
        root.dataset.beat = next.beat;
        ui.setStageBeat(next.beat);
      }
      if (next.cinematic !== stageState.cinematic) {
        stageState.cinematic = next.cinematic;
        ui.setCinematic(next.cinematic);
        root.dataset.stage = next.cinematic ? "cinematic" : "control";
      }

      stageState.energyTarget = next.energy;
      stageState.energy += (next.energy - stageState.energy) * damp(2.4, delta);

      // Where the story is pointing. One station at a time, or none.
      const store = useSimStore.getState();
      const beat = next.beat;
      if (beat === "hero") {
        fxBus.focusNode = fxBus.heroNode;
      } else if (beat === "restructure") {
        fxBus.focusNode = store.lastAppliedRec?.targetNode ?? null;
      } else if (beat === "lock" || beat === "inspect") {
        fxBus.focusNode = store.analysis?.bottleneck ?? store.sim.bottleneck ?? null;
      } else {
        fxBus.focusNode = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) raf = requestAnimationFrame(frame);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onEngage, true);
      document.removeEventListener("focusin", onEngage, true);
      unsubSim();
      delete root.dataset.stage;
      delete root.dataset.beat;
    };
  }, []);
}
