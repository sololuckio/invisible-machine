"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, damp, easeInOut, easeOutQuint } from "@/lib/motion";
import { isCoarsePointer } from "@/lib/quality";
import { scrollState } from "@/lib/scrollState";
import { PRESSURE_STAGES, stageState } from "@/lib/stage";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { HERO_CURVE, heroAt } from "./curves";

/**
 * Cinematography. Each chapter gets its own composition rather than another
 * centred view of the same machine:
 *
 *   1  hovering over the surface, then peering down through the split
 *   2  a seven-shot sequence around the hero order — establishing, side track,
 *      reverse flank, station entry, macro detail, route level, and a long
 *      pull back until the whole spine is in frame
 *   3  the control room: the spine framed between copy and console
 *   4  an investigation: wide, then down the queue, then onto the constraint
 *      the engine actually found, then a half-step back to read it
 *   5  a step back — the whole working depth, stable, ready to be measured,
 *      closing in while the scan actually runs
 *   6  long frontal elevation, both fates readable
 *   7  low reverse angle: the machine as a built object
 *   8  the whole organism, then a rise up the shaft to the closing seam
 *
 * The gaze leads and the camera body follows a beat behind, so movement has
 * weight; drift and parallax scale with the stage's energy, so the lock beat
 * really does hold still. Narrow viewports recompose rather than crop.
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
  8: { p: [0.6, -9.6, 27.5], t: [0, -9.9, 0] },
};

const SURFACE_A: Pose = { p: [0, 2.6, 10.5], t: [0, 0.2, 0] };
const SURFACE_B: Pose = { p: [0, 4.4, 8.4], t: [0, -3.2, 0] };
const LAB_POSE: Pose = { p: [10.5, -8.5, 13.5], t: [0, -9.5, 0] };
const REDUCED_POSE: Pose = { p: [11, -6.5, 17], t: [0, -8.5, 0] };

/**
 * Chapter 2's shot list, keyed to the hero order's own progress and expressed
 * as offsets from it — so the visitor never loses track of the protagonist
 * even as the angle changes completely. The hero's processing dwells hold the
 * camera still for a beat: the rests are free.
 */
const HERO_SHOTS: { x: number; off: [number, number, number]; look: [number, number, number] }[] = [
  // Wide establishing — carried over from the surface pose, order still small.
  { x: 0.0, off: [1.6, 3.2, 8.4], look: [0, -1.6, 0] },
  // Side tracking down the right flank.
  { x: 0.16, off: [5.4, 1.3, 5.0], look: [0, -0.4, 0] },
  // Reverse flank: the machine wraps around behind the order.
  { x: 0.36, off: [4.4, 1.4, -5.2], look: [0, -0.25, 0] },
  // Close station entry from the left three-quarter.
  { x: 0.52, off: [-3.2, 0.8, 3.6], look: [0, -0.15, 0] },
  // Macro: the mechanism doing the work, at arm's length.
  { x: 0.67, off: [-2.0, 0.55, 2.4], look: [0, -0.05, 0] },
  // Route level — back out far enough to see where it goes next.
  { x: 0.81, off: [3.4, 1.2, 4.4], look: [0, -0.6, 0] },
  // Network reveal: a long pull back and up as the order lands, until the
  // entire descending spine is in frame at once. The order finishes small,
  // which is the point of the chapter — one order, eight systems.
  { x: 1.0, off: [4.8, 9.6, 17.2], look: [0, 7.4, 0] },
];

/** Chapter 8's closure: whole organism → rise → rest above the healed seam. */
const CLOSURE_KEYS: { cf: number; pose: Pose }[] = [
  { cf: 7.5, pose: { p: [-4.0, -6.0, 19.5], t: [0, -9.0, 0] } },
  { cf: 8.08, pose: { p: [0.6, -9.6, 27.5], t: [0, -9.9, 0] } },
  { cf: 8.5, pose: { p: [0.5, -3.2, 17.5], t: [0, -6.8, 0] } },
  { cf: 8.9, pose: { p: [0, 2.7, 10.6], t: [0, -0.2, 0] } },
];

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTgt = useMemo(() => new THREE.Vector3(), []);
  const currentTgt = useRef(new THREE.Vector3(0, 0.2, 0));
  const heroPos = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const coarse = useMemo(() => isCoarsePointer(), []);

  // Two scratch poses so a blend can hold "from" and "to" without allocating.
  const scratchA = useRef<Pose>({ p: [0, 0, 0], t: [0, 0, 0] });
  const scratchB = useRef<Pose>({ p: [0, 0, 0], t: [0, 0, 0] });
  // How far the intelligence chapter has closed in on the machine.
  const scanPush = useRef(0);

  /**
   * Chapter 4, staged as an investigation rather than a move.
   *
   * A camera that flies straight at the broken station has told the visitor
   * the answer before they have seen the evidence. So it works the way a
   * person would: notice the system slowing, find the queue, follow it
   * upstream to whatever it is piling up behind, and only then commit.
   *
   *   0  wide      the whole working depth, traffic visibly thickening
   *   1  the queue at the upstream end of the backlog, looking down its length
   *   2  the cause arriving on the constraint, and stopping there
   *   3  hold      a half-step back so the instruments can be read
   *
   * Every framing is derived from the station the engine actually named, so
   * the sequence is as honest in the Lab or a different scenario as it is on
   * the scripted path.
   */
  const constraintKey = (i: number, out: Pose): Pose => {
    const sim = useSimStore.getState().sim;
    const id = sim.bottleneck ?? "fulfilment";
    const def = NODE_MAP[id];
    const [x, y, z] = def.position;
    const upId = def.upstream[0];
    const up = upId ? NODE_MAP[upId].position : ([x, y + 3, z] as const);

    if (i === 0) {
      // Operational wide: the system, not the station.
      out.p[0] = x + 6.4;
      out.p[1] = y + 5.6;
      out.p[2] = z + 11.4;
      out.t[0] = x - 0.2;
      out.t[1] = y + 2.8;
      out.t[2] = z;
    } else if (i === 1) {
      // On the queue, up at the far end of the backlog.
      out.p[0] = THREE.MathUtils.lerp(up[0], x, 0.3) + 4.3;
      out.p[1] = THREE.MathUtils.lerp(up[1], y, 0.3) + 1.9;
      out.p[2] = THREE.MathUtils.lerp(up[2], z, 0.3) + 6.4;
      out.t[0] = THREE.MathUtils.lerp(up[0], x, 0.82);
      out.t[1] = THREE.MathUtils.lerp(up[1], y, 0.82) + 0.5;
      out.t[2] = THREE.MathUtils.lerp(up[2], z, 0.82);
    } else if (i === 2) {
      // The cause. Tight three-quarter, and this is where it stops.
      out.p[0] = x + 3.0;
      out.p[1] = y + 2.3;
      out.p[2] = z + 5.2;
      out.t[0] = x - 0.5;
      out.t[1] = y + 0.4;
      out.t[2] = z;
    } else {
      // Hold: half a step back, instruments readable, nothing moving.
      out.p[0] = x + 4.4;
      out.p[1] = y + 3.0;
      out.p[2] = z + 7.6;
      out.t[0] = x - 0.2;
      out.t[1] = y + 0.7;
      out.t[2] = z;
    }
    return out;
  };

  /** Where each investigation beat lands within the chapter. */
  const CONSTRAINT_AT = [0, PRESSURE_STAGES.compression, PRESSURE_STAGES.lock, 0.9];

  const poseAt = (k: number, scratch: Pose): Pose => {
    if (k <= 2) return SURFACE_B;
    if (k === 4) return constraintKey(3, scratch);
    return POSES[Math.min(k, 8)] ?? POSES[8];
  };

  useFrame((state, delta) => {
    const ui = useUIStore.getState();
    const cf = scrollState.chapterFloat;
    const t = state.clock.elapsedTime;
    const energy = stageState.energy;

    if (ui.reducedMotion) {
      desiredPos.set(...REDUCED_POSE.p);
      desiredTgt.set(...REDUCED_POSE.t);
    } else if (ui.labOpen) {
      desiredPos.set(...LAB_POSE.p);
      desiredTgt.set(...LAB_POSE.t);
    } else if (cf < 2) {
      // Chapter 1: from the calm hero shot to peering down through the split.
      const s = easeInOut(clamp01(cf - 1));
      desiredPos.set(...SURFACE_A.p).lerp(a.set(...SURFACE_B.p), s);
      desiredTgt.set(...SURFACE_A.t).lerp(b.set(...SURFACE_B.t), s);
    } else if (cf < 3) {
      // Chapter 2: the shot list, composed around the hero order itself.
      const x = clamp01(scrollState.order);
      HERO_CURVE.getPointAt(heroAt(x).u, heroPos);
      let i = 0;
      while (i < HERO_SHOTS.length - 2 && x >= HERO_SHOTS[i + 1].x) i++;
      const from = HERO_SHOTS[i];
      const to = HERO_SHOTS[i + 1];
      const k = easeInOut(clamp01((x - from.x) / Math.max(1e-6, to.x - from.x)));
      desiredPos.set(
        heroPos.x + THREE.MathUtils.lerp(from.off[0], to.off[0], k),
        heroPos.y + THREE.MathUtils.lerp(from.off[1], to.off[1], k),
        heroPos.z + THREE.MathUtils.lerp(from.off[2], to.off[2], k),
      );
      desiredTgt.set(
        heroPos.x + THREE.MathUtils.lerp(from.look[0], to.look[0], k),
        heroPos.y + THREE.MathUtils.lerp(from.look[1], to.look[1], k),
        heroPos.z + THREE.MathUtils.lerp(from.look[2], to.look[2], k),
      );
    } else if (cf < 5) {
      // The investigation. Kept out of the generic chapter blender so the
      // arrival on the constraint is a real stop rather than a waypoint on the
      // way to chapter 5's framing.
      const f = cf - 4;
      let i = 0;
      while (i < CONSTRAINT_AT.length - 2 && f >= CONSTRAINT_AT[i + 1]) i++;
      const raw = clamp01((f - CONSTRAINT_AT[i]) / (CONSTRAINT_AT[i + 1] - CONSTRAINT_AT[i]));
      // Heavy deceleration onto the constraint; even easing elsewhere.
      const k = i === 1 ? easeOutQuint(raw) : easeInOut(raw);
      const from = constraintKey(i, scratchA.current);
      const to = constraintKey(i + 1, scratchB.current);
      desiredPos.set(...from.p).lerp(a.set(...to.p), k);
      desiredTgt.set(...from.t).lerp(b.set(...to.t), k);
      // Hand over to chapter 5 only at the very end of the chapter.
      if (f > 0.9) {
        const h = easeInOut(clamp01((f - 0.9) / 0.1));
        desiredPos.lerp(a.set(...POSES[5].p), h);
        desiredTgt.lerp(b.set(...POSES[5].t), h);
      }
    } else if (cf >= 7.5) {
      // The closure: three staged framings, blended, never a reverse animation.
      let i = 0;
      while (i < CLOSURE_KEYS.length - 2 && cf >= CLOSURE_KEYS[i + 1].cf) i++;
      const from = CLOSURE_KEYS[i];
      const to = CLOSURE_KEYS[i + 1];
      const k = easeInOut(clamp01((cf - from.cf) / (to.cf - from.cf)));
      desiredPos.set(...from.pose.p).lerp(a.set(...to.pose.p), k);
      desiredTgt.set(...from.pose.t).lerp(b.set(...to.pose.t), k);
    } else {
      const k = Math.floor(cf);
      const frac = easeInOut(clamp01(cf - k));
      const from = poseAt(k, scratchA.current);
      const to = poseAt(k + 1, scratchB.current);
      desiredPos.set(...from.p).lerp(a.set(...to.p), frac);
      desiredTgt.set(...from.t).lerp(b.set(...to.t), frac);
    }

    // The intelligence layer earns a move of its own: while the scan is
    // actually running the camera closes in, so the measurement is something
    // the visitor is brought to rather than shown from across the room. It
    // eases back out the moment the scan finishes.
    if (!ui.reducedMotion && cf >= 4.9 && cf < 6.2) {
      scanPush.current += ((stageState.beat === "scan" ? 1 : 0) - scanPush.current) * damp(1.3, delta);
      if (scanPush.current > 0.002) {
        desiredPos.lerp(desiredTgt, 0.24 * scanPush.current);
      }
    }

    // Narrow viewports: pull back along the view axis so compositions are
    // re-framed for portrait, not cropped from the desktop shot. Chapter 2
    // pulls back far less — the hero order has to stay big enough to follow.
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 0.9) {
      const scale = cf >= 2 && cf < 3 ? 0.45 : 1;
      const back = 1 + (0.9 - aspect) * 0.85 * scale;
      desiredPos.sub(desiredTgt).multiplyScalar(back).add(desiredTgt);
    }

    if (!ui.reducedMotion) {
      // Idle drift and pointer parallax both scale with the beat's energy, so
      // calm beats are genuinely calm and the constraint lock holds still.
      const consoleChapter = cf >= 2.6 && cf < 7.4;
      const life = 0.3 + energy * 0.95;
      const driftAmp = (consoleChapter ? 0.07 : 0.16) * life;
      desiredPos.x += Math.sin(t * 0.23) * driftAmp;
      desiredPos.y += Math.sin(t * 0.31) * driftAmp * 0.6;
      if (!coarse && !ui.labOpen) {
        const parallax = (consoleChapter ? 0.3 : 0.55) * life;
        desiredPos.x += state.pointer.x * parallax;
        desiredPos.y += state.pointer.y * parallax * 0.55;
      }
    }

    // The gaze leads; the camera body follows a beat behind — weight. The lock
    // beat tightens both so the camera arrives, settles and stops.
    const settling = stageState.beat === "lock";
    camera.position.lerp(desiredPos, damp(settling ? 3.6 : 2.1, delta));
    currentTgt.current.lerp(desiredTgt, damp(settling ? 4.4 : 3.0, delta));
    camera.lookAt(currentTgt.current);
  });

  return null;
}
