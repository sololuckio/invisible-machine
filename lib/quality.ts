/**
 * Rendering-quality tiers. A sensible tier is auto-detected from device
 * signals; visitors can override it in the settings panel at any time.
 */

export type Quality = "high" | "balanced" | "reduced";

export interface QualityProfile {
  /** Device-pixel-ratio clamp passed to the canvas. */
  dpr: [number, number];
  /** Size of the order-particle pool. */
  particles: number;
  /** Max queue markers rendered per node. */
  queueDots: number;
  antialias: boolean;
  /** Render scene fog + shaft structure lines. */
  environment: boolean;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  high: { dpr: [1, 2], particles: 320, queueDots: 22, antialias: true, environment: true },
  balanced: { dpr: [1, 1.5], particles: 180, queueDots: 14, antialias: true, environment: true },
  reduced: { dpr: [1, 1], particles: 90, queueDots: 8, antialias: false, environment: false },
};

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/** Pick a starting tier from device signals. Conservative on mobile. */
export function detectQuality(): Quality {
  if (typeof window === "undefined") return "balanced";
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 4;
    const mobile = isCoarsePointer() || window.innerWidth < 768;
    if (mobile) return mem >= 6 && cores >= 6 ? "balanced" : "reduced";
    if (cores >= 8 && mem >= 8) return "high";
    if (cores <= 4 || mem <= 4) return "reduced";
    return "balanced";
  } catch {
    return "balanced";
  }
}

export function detectWebGL(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return gl !== null;
  } catch {
    return false;
  }
}
