import * as THREE from "three";

/**
 * The holding lane: a single arc rail around each station's plinth where
 * waiting work physically accumulates. Stations render the rail, QueueMarkers
 * fill it with backlog blocks, and queued order particles advance along it
 * toward the release point — all from this one layout, so they never disagree.
 */

export const QUEUE_R = 1.0;
/** Arc start (XZ angle) — also the release point orders exit from. */
export const QUEUE_A0 = Math.PI * 0.75;
export const QUEUE_SPAN = Math.PI * 1.3;
export const SLOTS_PER_LAYER = 12;
/** Rail height relative to the station origin. */
export const RAIL_Y = -0.6;

/** Slot k (0-based) across stacked layers; writes into `out`. */
export function queueSlot(k: number, out: THREE.Vector3): void {
  const layer = Math.floor(k / SLOTS_PER_LAYER);
  const idx = k % SLOTS_PER_LAYER;
  const a = QUEUE_A0 + (idx / (SLOTS_PER_LAYER - 1)) * QUEUE_SPAN;
  out.set(Math.cos(a) * QUEUE_R, RAIL_Y + 0.09 + layer * 0.15, Math.sin(a) * QUEUE_R);
}

/** XZ angle of slot k — markers orient tangentially to the rail. */
export function queueSlotAngle(k: number): number {
  const idx = k % SLOTS_PER_LAYER;
  return QUEUE_A0 + (idx / (SLOTS_PER_LAYER - 1)) * QUEUE_SPAN;
}

/**
 * A queued particle's position in the lane: enters deep in the arc and
 * advances toward the release point (QUEUE_A0) as its wait runs down.
 */
export function queueHold(j: number, waitFrac: number, out: THREE.Vector3): void {
  const depth = (0.12 + j * 0.85) * Math.max(0, Math.min(1, waitFrac));
  const a = QUEUE_A0 + depth * QUEUE_SPAN;
  out.set(Math.cos(a) * QUEUE_R, RAIL_Y + 0.22, Math.sin(a) * QUEUE_R);
}

/** The rail's own geometry — a thin tube along the exact slot arc. */
export function makeRailGeometry(): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const STEPS = 32;
  for (let i = 0; i <= STEPS; i++) {
    const a = QUEUE_A0 + (i / STEPS) * QUEUE_SPAN;
    pts.push(new THREE.Vector3(Math.cos(a) * QUEUE_R, RAIL_Y, Math.sin(a) * QUEUE_R));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.01);
  return new THREE.TubeGeometry(curve, 40, 0.026, 6, false);
}
