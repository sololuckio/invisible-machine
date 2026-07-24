"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { smooth01 } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { BYPASS_SEGMENT, FLOW_SEGMENTS } from "./curves";
import { queueHold } from "./queueLayout";

/**
 * Orders as travelling work. A fixed instanced pool is recycled endlessly:
 * tokens spawn at acquisition in proportion to the live arrival rate, ease
 * between stations with real acceleration and arrival slow-down, hold in the
 * station's physical queue lane while its backlog clears, occasionally fail
 * and fall, and release through the revenue ledger when they complete.
 *
 * Tokens are oriented octahedra — compact carriers, not debug dots — warm
 * like the customers they came from, against the machine's cool signals.
 */

const enum Mode {
  Idle,
  Moving,
  Queued,
  Failing,
  Done,
}

/** Segment index meaning: 0..5 main conveyor, BYPASS = express lane. */
const BYPASS = -2;

interface Particle {
  mode: Mode;
  seg: number;
  t: number;
  speed: number;
  wait: number;
  waitMax: number;
  angle: number;
  radius: number;
  fall: number;
  life: number;
  j1: number;
  j2: number;
}

const fract = (v: number) => v - Math.floor(v);

export function OrderParticles({ pool }: { pool: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: pool }, (_, i) => ({
        mode: Mode.Idle,
        seg: 0,
        t: 0,
        speed: 1,
        wait: 0,
        waitMax: 1,
        angle: 0,
        radius: 0.7,
        fall: 0,
        life: 0,
        j1: fract(i * 0.618033),
        j2: fract(i * 0.754877 + 0.31),
      })),
    [pool],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const hold = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const cOrder = useMemo(() => new THREE.Color(PALETTE.order), []);
  const cWarn = useMemo(() => new THREE.Color(PALETTE.warn), []);
  const cDanger = useMemo(() => new THREE.Color(PALETTE.danger), []);
  const cSuccess = useMemo(() => new THREE.Color(PALETTE.success), []);

  useFrame((state, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const delta = Math.min(rawDelta, 0.1);
    const simStore = useSimStore.getState();
    const sim = simStore.sim;
    const reduced = useUIStore.getState().reducedMotion;
    const speedMul = reduced ? 0.35 : 1;
    const cf = scrollState.chapterFloat;
    // While the hero order carries Chapter 2, ambient traffic stays sparse.
    const heroWindow = cf >= 1.78 && cf < 3.05;
    const bypassActive = sim.appliedRecommendations.includes("alternate-express-route");

    // How many particles should be alive, tracking the real arrival rate.
    const targetActive = heroWindow
      ? 4
      : Math.min(
          pool,
          Math.max(
            sim.metrics.arrivalRate > 1 ? 4 : 0,
            Math.round(pool * THREE.MathUtils.clamp(sim.metrics.arrivalRate / 55, 0, 1)),
          ),
        );

    let active = 0;
    for (const p of particles) if (p.mode !== Mode.Idle) active++;

    let spawnBudget = 2;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < pool; i++) {
      const p = particles[i];

      // ---- lifecycle -----------------------------------------------------
      if (p.mode === Mode.Idle && active < targetActive && spawnBudget > 0) {
        spawnBudget--;
        active++;
        p.mode = Mode.Moving;
        p.seg = 0;
        p.t = p.j1 * 0.1;
        p.speed = 2.5 + p.j2 * 1.2;
      } else if (p.mode !== Mode.Idle && active > targetActive * 1.4 && p.seg === 0 && p.t < 0.1) {
        // Demand collapsed — quietly retire surplus particles at the inlet.
        p.mode = Mode.Idle;
        active--;
      }

      if (p.mode === Mode.Moving) {
        const seg = p.seg === BYPASS ? BYPASS_SEGMENT : FLOW_SEGMENTS[p.seg];
        p.t += (delta * p.speed * speedMul) / seg.length;
        if (p.t >= 1) {
          const arrivedAt = seg.to;
          const node = sim.nodes[arrivedAt];
          // Express-lane arrivals merge back into the main flow at inventory:
          // segment 2 ends there, so its queue-and-release logic applies.
          if (p.seg === BYPASS) p.seg = 2;
          p.mode = Mode.Queued;
          p.waitMax =
            THREE.MathUtils.clamp(node.queue / Math.max(node.throughput, 2), 0, 6) * 0.35 +
            p.j2 * 0.15;
          p.wait = p.waitMax;
          p.angle = p.j1 * Math.PI * 2;
          p.radius = 0.62 + p.j2 * 0.28;
        }
      } else if (p.mode === Mode.Queued) {
        p.wait -= delta * speedMul;
        if (p.wait <= 0) {
          const seg = p.seg === BYPASS ? BYPASS_SEGMENT : FLOW_SEGMENTS[p.seg];
          const node = sim.nodes[seg.to];
          const roll = fract(p.j1 + sim.tick * 0.113 + i * 0.017);
          if (node.errorRate > 0 && roll < node.errorRate * 1.3) {
            p.mode = Mode.Failing;
            p.life = 1;
            p.fall = 0;
          } else if (seg.to === "revenue") {
            p.mode = Mode.Done;
            p.life = 0.4;
          } else {
            const nextSeg = p.seg + 1;
            if (bypassActive && seg.to === "checkout" && i % 4 === 0) {
              p.seg = BYPASS;
            } else {
              p.seg = nextSeg;
            }
            p.mode = Mode.Moving;
            p.t = 0;
          }
        }
      } else if (p.mode === Mode.Failing) {
        p.life -= delta / 1.1;
        p.fall += delta * 1.8;
        if (p.life <= 0) p.mode = Mode.Idle;
      } else if (p.mode === Mode.Done) {
        p.life -= delta;
        if (p.life <= 0) p.mode = Mode.Idle;
      }

      // ---- position + appearance ----------------------------------------
      let scale = 0;
      let stretch = 1;
      let oriented = false;
      if (p.mode === Mode.Moving) {
        const seg = p.seg === BYPASS ? BYPASS_SEGMENT : FLOW_SEGMENTS[p.seg];
        // Ease the sampled position: leave with acceleration, arrive braking.
        const u = smooth01(Math.min(p.t, 1));
        seg.curve.getPoint(u, pos);
        seg.curve.getTangent(u, tangent);
        oriented = true;
        // Faster mid-route travel visibly stretches the carrier.
        stretch = 1 + Math.sin(Math.min(p.t, 1) * Math.PI) * 0.5;
        scale = 1;
        color.copy(cOrder);
      } else if (p.mode === Mode.Queued) {
        const seg = p.seg === BYPASS ? BYPASS_SEGMENT : FLOW_SEGMENTS[p.seg];
        const def = NODE_MAP[seg.to];
        // Hold in the station's physical queue lane, advancing to release.
        queueHold(p.j1, p.wait / Math.max(p.waitMax, 0.001), hold);
        pos.set(def.position[0] + hold.x, def.position[1] + hold.y, def.position[2] + hold.z);
        if (!reduced) pos.y += Math.sin(t * 1.3 + p.angle) * 0.02;
        scale = 0.8;
        const strain = THREE.MathUtils.clamp(p.waitMax / 2.2, 0, 1);
        color.copy(cOrder).lerp(cWarn, strain);
      } else if (p.mode === Mode.Failing) {
        const seg = p.seg === BYPASS ? BYPASS_SEGMENT : FLOW_SEGMENTS[p.seg];
        const def = NODE_MAP[seg.to];
        pos.set(
          def.position[0] + Math.cos(p.angle) * p.radius,
          def.position[1] - p.fall * p.fall,
          def.position[2] + Math.sin(p.angle) * p.radius,
        );
        scale = Math.max(0, p.life) * 0.9;
        color.copy(cDanger);
      } else if (p.mode === Mode.Done) {
        const def = NODE_MAP.revenue;
        pos.set(def.position[0], def.position[1] + (0.4 - p.life) * 1.6, def.position[2]);
        scale = 1 + (0.4 - p.life) * 2.4;
        color.copy(cSuccess);
      }

      if (scale > 0) {
        dummy.position.copy(pos);
        if (oriented) {
          look.copy(pos).add(tangent);
          dummy.lookAt(look);
          dummy.rotation.z = t * 1.7 + p.j1 * 6.28;
        } else {
          dummy.rotation.set(0, t * 0.6 + p.j1 * 6.28, 0);
        }
        dummy.scale.set(scale, scale, scale * stretch);
      } else {
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, pool]} frustumCulled={false}>
      <octahedronGeometry args={[0.085, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
