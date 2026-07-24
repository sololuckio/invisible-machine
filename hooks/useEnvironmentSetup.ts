"use client";

import { useEffect } from "react";
import { detectQuality, detectWebGL, type Quality } from "@/lib/quality";
import { readSession, STORAGE_KEYS } from "@/lib/storage";
import { useUIStore } from "@/store/uiStore";

/**
 * One-time client environment probe: WebGL support, quality tier,
 * reduced-motion preference, and session-restored settings.
 * Runs in an effect so server and client render identical first frames.
 */
export function useEnvironmentSetup(): void {
  useEffect(() => {
    const ui = useUIStore.getState();

    // WebGL: if unavailable, the diagram becomes the primary view.
    const webglOk = detectWebGL();
    ui.setWebglOk(webglOk);

    // Quality: session override wins, otherwise detect.
    const storedQuality = readSession(STORAGE_KEYS.quality) as Quality | null;
    if (storedQuality === "high" || storedQuality === "balanced" || storedQuality === "reduced") {
      ui.setQuality(storedQuality, "user");
    } else {
      ui.setQuality(detectQuality(), "auto");
    }

    // View mode: restore, but never force 3D onto a device without WebGL.
    const storedView = readSession(STORAGE_KEYS.view);
    if (!webglOk || storedView === "diagram") {
      ui.setViewMode("diagram");
    }

    // Reduced motion: track live, not just at load.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => useUIStore.getState().setReducedMotion(mq.matches);
    applyMotion();
    mq.addEventListener?.("change", applyMotion);

    // Sound: remembered for the session, but the AudioContext still needs a
    // user gesture — arm a one-time listener instead of autoplaying.
    let disarm: (() => void) | null = null;
    if (readSession(STORAGE_KEYS.sound) === "1") {
      const arm = () => {
        const state = useUIStore.getState();
        if (!state.soundOn) state.toggleSound();
        disarm?.();
      };
      window.addEventListener("pointerdown", arm, { once: true });
      window.addEventListener("keydown", arm, { once: true });
      disarm = () => {
        window.removeEventListener("pointerdown", arm);
        window.removeEventListener("keydown", arm);
      };
    }

    return () => {
      mq.removeEventListener?.("change", applyMotion);
      disarm?.();
    };
  }, []);
}
