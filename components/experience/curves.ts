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
