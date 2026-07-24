/**
 * Shared motion vocabulary. Every animated element — DOM or WebGL — pulls its
 * easing and timing from here so the whole machine moves with one accent.
 */

/** Smooth symmetric travel: camera moves, plate separation, chapter blends. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Confident arrival: things that assemble, land or lock into place. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Anticipating departure: things that wind up before releasing. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Standard smoothstep — gradients and threshold fades. */
export function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Frame-rate-independent damping factor for exponential approach. */
export function damp(rate: number, delta: number): number {
  return 1 - Math.exp(-delta * rate);
}

/** Timing constants (seconds) shared by DOM and 3D layers. */
export const TIMING = {
  /** AI scan sweep — must match the AI panel's countdown. */
  scan: 2.6,
  /** Bypass route tracing itself in after a recommendation. */
  routeBuild: 1.8,
  /** Station reaction pop after an applied recommendation. */
  stationPop: 1.4,
} as const;
