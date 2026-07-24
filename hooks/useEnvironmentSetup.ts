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

    // WebGL: capability is a device fact, set once here (and reconfirmed by a
    // successful scene start) — never inferred from what is currently mounted.
    const webglOk = detectWebGL();
    ui.setWebglCapability(webglOk ? "available" : "unavailable");

    // Quality: session override wins, otherwise detect.
    const storedQuality = readSession(STORAGE_KEYS.quality) as Quality | null;
    if (storedQuality === "high" || storedQuality === "balanced" || storedQuality === "reduced") {
      ui.setQuality(storedQuality, "user");
    } else {
      ui.setQuality(detectQuality(), "auto");
    }

    // View mode: restore the user's preference; fall back automatically when
    // the device can't do 3D. Neither path may rewrite capability.
    const storedView = readSession(STORAGE_KEYS.view);
    if (!webglOk) {
      ui.setViewMode("diagram", "auto");
    } else if (storedView === "diagram") {
      ui.setViewMode("diagram", "user");
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
