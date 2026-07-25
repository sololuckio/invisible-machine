import * as THREE from "three";
import { FLOW_PATH, NODE_MAP } from "@/simulation/nodes";
import type { NodeId } from "@/simulation/types";

/**
 * Precomputed luminous pathways between stations. Orders travel along these
 * curves; the same geometry feeds the visible conveyor lines, so particles
 * and pathways can never disagree.
 */

export interface Segment {
  from: NodeId;
  to: NodeId;
  curve: THREE.QuadraticBezierCurve3;
  length: number;
}

function vec(id: NodeId): THREE.Vector3 {
  const [x, y, z] = NODE_MAP[id].position;
  return new THREE.Vector3(x, y, z);
}

function makeSegment(from: NodeId, to: NodeId, bulge: number): Segment {
  const a = vec(from);
  const b = vec(to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  // Push the control point sideways (perpendicular in XZ) and slightly up,
  // so pathways arc like conduits instead of clipping through structure.
  const dir = b.clone().sub(a);
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(bulge);
  mid.add(side).add(new THREE.Vector3(0, Math.abs(bulge) * 0.4, 0));
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return { from, to, curve, length: curve.getLength() };
}

/** Main conveyor: acquisition → … → revenue. */
export const FLOW_SEGMENTS: Segment[] = FLOW_PATH.slice(0, -1).map((id, i) =>
  makeSegment(id, FLOW_PATH[i + 1], i % 2 === 0 ? 1.4 : -1.4),
);

/** Express lane unlocked by the "alternate express route" recommendation. */
export const BYPASS_SEGMENT: Segment = makeSegment("checkout", "inventory", -3.2);

/** Issue conduits feeding the support bay. */
export const SUPPORT_SEGMENTS: Segment[] = (["payment", "fulfilment", "delivery"] as NodeId[]).map(
  (id, i) => makeSegment(id, "support", 1 + i * 0.4),
);

/** The hero order's full journey as a single continuous curve. */
export const HERO_CURVE = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(0, 1.2, 0), ...FLOW_PATH.map((id) => vec(id))],
  false,
  "catmullrom",
  0.15,
);

/** Segment index lookup by source node. */
export const SEGMENT_BY_FROM = new Map<NodeId, number>(FLOW_SEGMENTS.map((s, i) => [s.from, i]));

/* ------------------------------------------------------------------ */
/* The hero order's timeline                                           */
/* ------------------------------------------------------------------ */

/**
 * Arc-length position (0..1) of each station along the hero curve, found by
 * sampling once at module load. The hero order needs to know where the
 * stations actually are so it can arrive at them, not merely fly past.
 */
export const HERO_STOPS: number[] = (() => {
  const SAMPLES = 600;
  const probe = new THREE.Vector3();
  return FLOW_PATH.map((id) => {
    const target = vec(id);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      HERO_CURVE.getPointAt(u, probe);
      const d = probe.distanceToSquared(target);
      if (d < bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  });
})();

/** How long the hero order is handled at each station, relative to the others. */
const DWELL_WEIGHTS = [0.8, 1.0, 1.25, 1.0, 1.45, 1.0, 1.2];
/** Share of the chapter's scroll spent being processed rather than travelling. */
const DWELL_SHARE = 0.34;

interface Leg {
  x0: number;
  x1: number;
  u0: number;
  u1: number;
  /** Station index when this leg is a processing dwell, else -1. */
  stop: number;
}

/**
 * The journey as alternating travel legs and processing dwells. Scroll is the
 * clock, so the whole sequence scrubs identically in both directions — the
 * hero order slows into a station, is worked on, and accelerates out, without
 * a single time-dependent term.
 */
const HERO_TIMELINE: Leg[] = (() => {
  const travelSpans = HERO_STOPS.map((u, i) => u - (i === 0 ? 0 : HERO_STOPS[i - 1]));
  const travelTotal = travelSpans.reduce((a, b) => a + b, 0) || 1;
  const dwellTotal = DWELL_WEIGHTS.reduce((a, b) => a + b, 0);

  const legs: Leg[] = [];
  let x = 0;
  for (let i = 0; i < HERO_STOPS.length; i++) {
    const travel = (travelSpans[i] / travelTotal) * (1 - DWELL_SHARE);
    legs.push({
      x0: x,
      x1: x + travel,
      u0: i === 0 ? 0 : HERO_STOPS[i - 1],
      u1: HERO_STOPS[i],
      stop: -1,
    });
    x += travel;
    const dwell = (DWELL_WEIGHTS[i] / dwellTotal) * DWELL_SHARE;
    legs.push({ x0: x, x1: x + dwell, u0: HERO_STOPS[i], u1: HERO_STOPS[i], stop: i });
    x += dwell;
  }
  return legs;
})();

export interface HeroFrame {
  /** Position along the hero curve. */
  u: number;
  /** 0..1 — how fast the order is currently moving (0 while being processed). */
  speed: number;
  /** 0..1 progress through a processing dwell; 0 while travelling. */
  processing: number;
  /** Index into FLOW_PATH of the station handling it, or -1 while in transit. */
  stop: number;
  /** Index into FLOW_PATH of the station being approached, or -1. */
  approaching: number;
}

const heroFrame: HeroFrame = { u: 0, speed: 0, processing: 0, stop: -1, approaching: -1 };

/** Sample the hero journey at scroll position `x` (0..1). Reuses one object. */
export function heroAt(x: number): HeroFrame {
  const clamped = x < 0 ? 0 : x > 0.9999 ? 0.9999 : x;
  let leg = HERO_TIMELINE[HERO_TIMELINE.length - 1];
  let index = HERO_TIMELINE.length - 1;
  for (let i = 0; i < HERO_TIMELINE.length; i++) {
    if (clamped < HERO_TIMELINE[i].x1) {
      leg = HERO_TIMELINE[i];
      index = i;
      break;
    }
  }
  const k = (clamped - leg.x0) / Math.max(1e-6, leg.x1 - leg.x0);

  if (leg.stop >= 0) {
    heroFrame.u = leg.u0;
    heroFrame.speed = 0;
    heroFrame.processing = k;
    heroFrame.stop = leg.stop;
    heroFrame.approaching = -1;
  } else {
    // Ease within the leg: accelerate away, brake into the next station.
    const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    heroFrame.u = leg.u0 + (leg.u1 - leg.u0) * eased;
    heroFrame.speed = 1 - Math.abs(2 * k - 1);
    heroFrame.processing = 0;
    heroFrame.stop = -1;
    heroFrame.approaching = Math.floor(index / 2);
  }
  return heroFrame;
}
