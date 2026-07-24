"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { damp, easeInOut } from "@/lib/motion";
import { isCoarsePointer } from "@/lib/quality";
import { scrollState } from "@/lib/scrollState";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The cinematic descent. Camera poses are keyed to chapter positions:
 * hover over the surface, dive with the hero order, settle into the control
 * room, close on the constraint, and finally rise back to the closing seam.
 * The body of the camera lags its gaze slightly — movement with weight, not
 * drift — and everything is damped: no scroll-jacking, no sudden cuts.
 * On narrow viewports every pose pulls back so the machine stays composed
 * rather than cropped.
 */

type Pose = { p: [number, number, number]; t: [number, number, number] };

const POSES: Record<number, Pose> = {
  // Ch3 — control room: machine spine centre-frame between text and console.
  3: { p: [9.2, -7.6, 12.8], t: [0.4, -9.6, 0] },
  // Ch5 — intelligence: a step back, whole working depth in view.
  5: { p: [6.8, -6.4, 12.4], t: [0, -10.2, 0] },
  // Ch6 — comparison: long frontal elevation, both fates readable.
  6: { p: [0.5, -9.5, 16], t: [0, -9.8, 0] },
  // Ch7 — creator: low reverse angle, the machine as built object.
  7: { p: [-6.8, -3.4, 16.2], t: [0, -8.2, 0] },
  // Ch8 — back to the healed surface.
  8: { p: [0, 2.1, 11], t: [0, -0.6, 0] },
};

const SURFACE_A: Pose = { p: [0, 2.6, 10.5], t: [0, 0.2, 0] };
const SURFACE_B: Pose = { p: [0, 4.4, 8.4], t: [0, -3.2, 0] };
const LAB_POSE: Pose = { p: [10.5, -8.5, 13.5], t: [0, -9.5, 0] };
const REDUCED_POSE: Pose = { p: [11, -6.5, 17], t: [0, -8.5, 0] };

function bottleneckPose(): Pose {
  const sim = useSimStore.getState().sim;
  const id = sim.bottleneck ?? "fulfilment";
  const [x, y, z] = NODE_MAP[id].position;
  // Three-quarter close-up: constraint right of centre, queue rail visible,
  // upstream context kept in the top of frame.
  return { p: [x + 3.0, y + 2.5, z + 5.6], t: [x - 0.6, y + 0.45, z] };
}

function poseAt(k: number): Pose {
  if (k <= 2) return SURFACE_B;
  if (k === 4) return bottleneckPose();
  return POSES[Math.min(k, 8)] ?? POSES[8];
}

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
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

    // Narrow viewports: pull back along the view axis so compositions are
    // re-framed for portrait, not cropped from the desktop shot.
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 0.9) {
      const back = 1 + (0.9 - aspect) * 0.85;
      desiredPos.sub(desiredTgt).multiplyScalar(back).add(desiredTgt);
    }

    if (!ui.reducedMotion) {
      // A breath of idle drift keeps the machine alive between scrolls —
      // quieter in the operating chapters where panels need a steady stage.
      const consoleChapter = cf >= 2.6 && cf < 7.4;
      const driftAmp = consoleChapter ? 0.07 : 0.16;
      desiredPos.x += Math.sin(t * 0.23) * driftAmp;
      desiredPos.y += Math.sin(t * 0.31) * driftAmp * 0.6;
      // Pointer parallax (mouse only — never fights touch scrolling).
      if (!coarse && !ui.labOpen) {
        const parallax = consoleChapter ? 0.3 : 0.55;
        desiredPos.x += state.pointer.x * parallax;
        desiredPos.y += state.pointer.y * parallax * 0.55;
      }
    }

    // The gaze leads; the camera body follows a beat behind — weight.
    camera.position.lerp(desiredPos, damp(2.1, delta));
    currentTgt.current.lerp(desiredTgt, damp(3.0, delta));
    camera.lookAt(currentTgt.current);
  });

  return null;
}
