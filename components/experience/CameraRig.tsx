"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { isCoarsePointer } from "@/lib/quality";
import { scrollState } from "@/lib/scrollState";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The cinematic descent. Camera poses are keyed to chapter positions:
 * hover over the surface, dive with the hero order, settle into the control
 * room, close on the constraint, and finally rise back to the closing seam.
 * Everything is damped — no scroll-jacking, no sudden cuts.
 */

type Pose = { p: [number, number, number]; t: [number, number, number] };

const POSES: Record<number, Pose> = {
  3: { p: [9.5, -7.5, 12.5], t: [0.5, -9, 0] },
  5: { p: [7.5, -6, 11.5], t: [0, -10, 0] },
  6: { p: [0.5, -9.5, 15.5], t: [0, -9.5, 0] },
  7: { p: [-6.5, -3.5, 16.5], t: [0, -8, 0] },
  8: { p: [0, 2.1, 11], t: [0, -0.6, 0] },
};

const SURFACE_A: Pose = { p: [0, 2.6, 10.5], t: [0, 0.2, 0] };
const SURFACE_B: Pose = { p: [0, 4.4, 8.4], t: [0, -3.2, 0] };
const LAB_POSE: Pose = { p: [10.5, -8.5, 13.5], t: [0, -9.5, 0] };
const REDUCED_POSE: Pose = { p: [11, -6.5, 17], t: [0, -8.5, 0] };

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function bottleneckPose(): Pose {
  const sim = useSimStore.getState().sim;
  const id = sim.bottleneck ?? "fulfilment";
  const [x, y, z] = NODE_MAP[id].position;
  return { p: [x + 3.4, y + 1.6, z + 4.8], t: [x, y, z] };
}

function poseAt(k: number): Pose {
  if (k <= 2) return SURFACE_B;
  if (k === 4) return bottleneckPose();
  return POSES[Math.min(k, 8)] ?? POSES[8];
}

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTgt = useMemo(() => new THREE.Vector3(), []);
  const currentTgt = useRef(new THREE.Vector3(0, 0.2, 0));
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const coarse = useMemo(() => isCoarsePointer(), []);

  useFrame((state, delta) => {
    const ui = useUIStore.getState();
    const cf = scrollState.chapterFloat;
    const t = state.clock.elapsedTime;

    if (ui.reducedMotion) {
      desiredPos.set(...REDUCED_POSE.p);
      desiredTgt.set(...REDUCED_POSE.t);
    } else if (ui.labOpen) {
      desiredPos.set(...LAB_POSE.p);
      desiredTgt.set(...LAB_POSE.t);
    } else if (cf < 2) {
      // Chapter 1: from the calm hero shot to peering down through the split.
      const s = easeInOut(THREE.MathUtils.clamp(cf - 1, 0, 1));
      desiredPos.set(...SURFACE_A.p).lerp(a.set(...SURFACE_B.p), s);
      desiredTgt.set(...SURFACE_A.t).lerp(b.set(...SURFACE_B.t), s);
    } else if (cf < 3) {
      // Chapter 2: descend alongside the hero order.
      const u = easeInOut(THREE.MathUtils.clamp(cf - 2, 0, 1));
      desiredPos.set(5.6, THREE.MathUtils.lerp(1.4, -13.6, u), 8.8);
      desiredTgt.set(0, THREE.MathUtils.lerp(0.2, -15.6, u), 0);
    } else {
      const k = Math.floor(cf);
      const frac = easeInOut(THREE.MathUtils.clamp(cf - k, 0, 1));
      const from = poseAt(k);
      const to = poseAt(k + 1);
      desiredPos.set(...from.p).lerp(a.set(...to.p), frac);
      desiredTgt.set(...from.t).lerp(b.set(...to.t), frac);
    }

    if (!ui.reducedMotion) {
      // Gentle idle drift keeps the machine alive between scrolls.
      desiredPos.x += Math.sin(t * 0.23) * 0.18;
      desiredPos.y += Math.sin(t * 0.31) * 0.1;
      // Pointer parallax (mouse only — never fights touch scrolling).
      if (!coarse && !ui.labOpen) {
        desiredPos.x += state.pointer.x * 0.55;
        desiredPos.y += state.pointer.y * 0.3;
      }
    }

    const k = 1 - Math.exp(-delta * 2.6);
    camera.position.lerp(desiredPos, k);
    currentTgt.current.lerp(desiredTgt, k);
    camera.lookAt(currentTgt.current);
  });

  return null;
}
