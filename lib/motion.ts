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

/** Clamp to 0..1 — used constantly when shaping scroll into stage progress. */
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Map a value from one range into normalised 0..1 progress. */
export function span(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from || 1));
}

/** Heavy arrival — long deceleration, for objects with real mass. */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * A decaying oscillation applied after something reaches its stop: the
 * suspension taking up the load. `t` is seconds (or progress) since arrival.
 */
export function settle(t: number, amplitude = 1, rate = 9, frequency = 22): number {
  if (t <= 0) return 0;
  return Math.exp(-t * rate) * Math.sin(t * frequency) * amplitude;
}

/** Timing constants (seconds) shared by DOM and 3D layers. */
export const TIMING = {
  /** AI scan sweep — must match the AI panel's countdown. */
  scan: 2.6,
  /** Bypass route tracing itself in after a recommendation. */
  routeBuild: 1.8,
  /** Station reaction pop after an applied recommendation. */
  stationPop: 1.4,
  /** The constraint lock holding before the intelligence chapter. */
  lock: 1.1,
  /** Downstream release wave travelling out of a restructured station. */
  releaseWave: 2.4,
} as const;
