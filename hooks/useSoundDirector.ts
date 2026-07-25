"use client";

import { useEffect, useRef } from "react";
import { fxBus } from "@/components/experience/fxBus";
import { soundEngine } from "@/lib/audio";
import { scrollState } from "@/lib/scrollState";
import { stageState } from "@/lib/stage";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Sound direction: the same beats that drive the picture drive the audio, so
 * the two can never disagree. Discrete cues fire on transitions; two
 * continuous layers (room presence and material tension) are updated on a
 * slow interval that only exists while sound is on.
 *
 * Everything is optional and reversible — nothing here is required to
 * understand the experience, sound is off until the visitor asks for it, the
 * tab going hidden holds it silent, and unmounting releases the context.
 */

/** Continuous layers only need a handful of updates per second. */
const LAYER_MS = 140;

export function useSoundDirector(): void {
  const lastCompleted = useRef(0);

  useEffect(() => {
    // ---- discrete cues from the simulation ----------------------------
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
        // The payoff, staged: confirmation, then the route coming into
        // service, then the system finding its rhythm again.
        soundEngine.resolve();
        window.setTimeout(() => soundEngine.routeActivate(), 420);
        window.setTimeout(() => soundEngine.stabilise(), 1400);
      }
    });

    // ---- discrete cues from the narrative ------------------------------
    const unsubUI = useUIStore.subscribe((state, prev) => {
      if (!state.soundOn) return;
      if (state.scanStatus === "scanning" && prev.scanStatus !== "scanning") soundEngine.scan();
      if (state.scanStatus === "complete" && prev.scanStatus !== "complete") {
        soundEngine.constraintFound();
      }
      if (state.stageBeat === prev.stageBeat) return;
      switch (state.stageBeat) {
        case "ignition":
          soundEngine.seamIgnite();
          break;
        case "release":
          soundEngine.mechanicalRelease();
          break;
        case "descent":
          soundEngine.settle();
          break;
        case "lock":
          soundEngine.constraintLock();
          break;
        case "prescan":
          soundEngine.duck(0.3, 1.4);
          break;
        case "managed":
          soundEngine.stabilise();
          break;
        case "closure":
          soundEngine.closing();
          break;
      }
    });

    // ---- continuous layers, only while sound is on ---------------------
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastHeroNode: string | null = null;
    let finalPlayed = false;

    const layers = () => {
      const ui = useUIStore.getState();
      if (!ui.soundOn) return;
      const beat = stageState.beat;

      soundEngine.setAmbient(stageState.energy);

      // Material tension exists only while the surface is still closed.
      soundEngine.setTension(
        beat === "instability" ? Math.min(1, scrollState.surface * 4) : beat === "ignition" ? 0.5 : 0,
      );

      // The hero order's own cues, taken from where it actually is.
      if (beat === "hero") {
        const node = fxBus.heroNode;
        if (node !== lastHeroNode) {
          if (node) {
            soundEngine.stationEnter();
            // …and the work being finished on it, a beat later.
            window.setTimeout(() => soundEngine.processConfirm(), 520);
          } else if (lastHeroNode) {
            soundEngine.dispatch();
          }
          lastHeroNode = node;
        }
      } else {
        lastHeroNode = null;
      }

      if (beat === "rising") soundEngine.strain(0.35);
      if (beat === "compression") soundEngine.strain(0.95);
      if (beat === "scan" && fxBus.scanY !== null) soundEngine.measure();

      // Contact, once, as the halves meet.
      if (beat === "closure" && scrollState.chapterFloat > 8.42) {
        if (!finalPlayed) {
          finalPlayed = true;
          soundEngine.finalResonance();
        }
      } else if (scrollState.chapterFloat < 8.2) {
        finalPlayed = false;
      }
    };

    const startLayers = () => {
      if (timer === null && !document.hidden) timer = setInterval(layers, LAYER_MS);
    };
    const stopLayers = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      soundEngine.setTension(0);
    };

    const unsubSound = useUIStore.subscribe((state, prev) => {
      if (state.soundOn === prev.soundOn) return;
      if (state.soundOn) startLayers();
      else stopLayers();
    });
    if (useUIStore.getState().soundOn) startLayers();

    // ---- tab visibility -------------------------------------------------
    const onVisibility = () => {
      if (document.hidden) {
        stopLayers();
        soundEngine.suspend();
      } else if (useUIStore.getState().soundOn) {
        soundEngine.resume();
        startLayers();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ---- one delegated press cue for every control ----------------------
    const onPress = (e: PointerEvent) => {
      if (!useUIStore.getState().soundOn) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("button, a, input, [role='button']")) soundEngine.click();
    };
    document.addEventListener("pointerdown", onPress, true);

    return () => {
      unsubSim();
      unsubUI();
      unsubSound();
      stopLayers();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onPress, true);
      // Leaving the experience releases the audio context entirely.
      soundEngine.destroy();
    };
  }, []);
}
