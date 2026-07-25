"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01 } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { FLOW_PATH } from "@/simulation/nodes";
import { useUIStore } from "@/store/uiStore";
import { HERO_CURVE, heroAt } from "./curves";
import { fxBus } from "./fxBus";
import { GEO } from "./materials";

/**
 * The order the visitor follows in Chapter 2 — a protagonist, not a
 * highlighted particle.
 *
 * Its journey is a timeline, not a constant slide: it accelerates out of each
 * station, brakes on approach, is visibly *worked on* while it waits (a pair
 * of processing beats, then a wind-up), and is released again. Scroll is the
 * only clock, so the whole performance scrubs identically in both directions.
 * Its trail lengthens with speed and collapses while it is being handled, and
 * it tells the rest of the machine which station it is at so that station can
 * answer.
 */

const TRAIL = 10;

export function HeroOrder() {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const trailColor = useMemo(() => new THREE.Color(), []);
  const cHero = useMemo(() => new THREE.Color(PALETTE.hero), []);
  const cBg = useMemo(() => new THREE.Color(PALETTE.bg), []);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const cf = scrollState.chapterFloat;
    const reduced = useUIStore.getState().reducedMotion;
    const visible = !reduced && cf >= 1.78 && cf < 3.05;
    group.visible = visible;
    if (trailRef.current) trailRef.current.visible = visible;
    if (!visible) {
      if (fxBus.heroNode !== null) fxBus.heroNode = null;
      return;
    }

    const t = state.clock.elapsedTime;
    const frame = heroAt(scrollState.order);
    const processing = frame.stop >= 0;

    HERO_CURVE.getPointAt(frame.u, pos);
    HERO_CURVE.getTangentAt(frame.u, tangent);
    group.position.copy(pos);
    look.copy(pos).add(tangent);
    group.lookAt(look);

    // Tell the machine where its protagonist is — the station it is entering
    // brightens, everything else steps back.
    fxBus.heroNode = processing
      ? FLOW_PATH[frame.stop]
      : frame.approaching >= 0 && frame.speed < 0.45
        ? FLOW_PATH[frame.approaching]
        : null;

    // Shape: stretched while travelling, compressed and beating while worked
    // on, wound up just before release.
    let core: number;
    let stretch: number;
    let windUp = 0;
    if (processing) {
      const p = frame.processing;
      windUp = p > 0.84 ? (p - 0.84) / 0.16 : 0;
      const beats = Math.max(0, Math.sin(p * Math.PI * 3));
      core = 1 + beats * 0.12 - windUp * 0.14;
      stretch = 1 - windUp * 0.2;
    } else {
      core = 1 - frame.speed * 0.06;
      stretch = 1 + frame.speed * 0.62;
    }
    if (coreRef.current) coreRef.current.scale.set(0.34 * core, 0.34 * core, 0.34 * core * stretch);

    // Inner pulse — the order carries something, and it is alive.
    if (haloRef.current && haloMat.current) {
      const beat = processing
        ? 0.5 + 0.5 * Math.sin(frame.processing * Math.PI * 6)
        : 0.5 + 0.5 * Math.sin(t * 2.6);
      haloRef.current.scale.setScalar(0.46 + beat * 0.1 + windUp * 0.12);
      haloMat.current.opacity = 0.1 + beat * 0.16 + windUp * 0.35;
    }

    // Guidance ring: spins with travel, holds and flares under processing.
    if (ringRef.current && ringMat.current) {
      ringRef.current.rotation.z = processing ? -t * 0.4 : t * (0.7 + frame.speed * 2.8);
      const flare = processing ? Math.sin(frame.processing * Math.PI) * 0.26 : frame.speed * 0.1;
      ringRef.current.scale.setScalar(0.62 * (1 + flare));
      ringMat.current.opacity = 0.34 + (processing ? 0.4 : frame.speed * 0.4);
    }

    // Trail: a real consequence of speed, not a permanent decoration.
    if (trailRef.current) {
      const reach = 0.004 + frame.speed * 0.012;
      for (let k = 0; k < TRAIL; k++) {
        const back = clamp01(frame.u - (k + 1) * reach);
        HERO_CURVE.getPointAt(back, pos);
        dummy.position.copy(pos);
        const f = 1 - (k + 1) / (TRAIL + 1);
        dummy.scale.setScalar((0.3 * f * f + 0.02) * (0.25 + frame.speed * 0.75));
        dummy.updateMatrix();
        trailRef.current.setMatrixAt(k, dummy.matrix);
        trailColor.copy(cHero).lerp(cBg, 1 - f * 0.85);
        trailRef.current.setColorAt(k, trailColor);
      }
      trailRef.current.instanceMatrix.needsUpdate = true;
      if (trailRef.current.instanceColor) trailRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={groupRef} visible={false}>
        {/* Carrier core. */}
        <mesh ref={coreRef} geometry={GEO.octa} scale={0.34}>
          <meshBasicMaterial color={PALETTE.hero} toneMapped={false} />
        </mesh>
        {/* The pulse inside it. */}
        <mesh ref={haloRef} geometry={GEO.octa} scale={0.46}>
          <meshBasicMaterial
            ref={haloMat}
            color={PALETTE.hero}
            toneMapped={false}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Guidance ring around the direction of travel. */}
        <mesh ref={ringRef} geometry={GEO.torus} scale={0.62}>
          <meshBasicMaterial ref={ringMat} color={PALETTE.hero} toneMapped={false} transparent opacity={0.55} />
        </mesh>
      </group>
      <instancedMesh ref={trailRef} args={[GEO.sphere, undefined, TRAIL]} frustumCulled={false} visible={false}>
        <meshBasicMaterial toneMapped={false} transparent opacity={0.5} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
