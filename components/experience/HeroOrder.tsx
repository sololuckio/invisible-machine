"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { useUIStore } from "@/store/uiStore";
import { HERO_CURVE } from "./curves";
import { GEO } from "./materials";

/**
 * The single order the visitor follows in Chapter 2: a warm carrier with a
 * guidance ring and a light trail, driven directly by scroll along the full
 * journey. Clearly dominant over ambient traffic, gone once the story moves on.
 */

const TRAIL = 9;

export function HeroOrder() {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
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
    if (!visible) return;

    const u = THREE.MathUtils.clamp(scrollState.order, 0, 0.999);
    HERO_CURVE.getPointAt(u, pos);
    HERO_CURVE.getTangentAt(u, tangent);
    group.position.copy(pos);
    look.copy(pos).add(tangent);
    group.lookAt(look);

    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 1.4;
    }

    // Light trail: fading samples of the path already travelled.
    if (trailRef.current) {
      for (let k = 0; k < TRAIL; k++) {
        const back = THREE.MathUtils.clamp(u - (k + 1) * 0.008, 0, 1);
        HERO_CURVE.getPointAt(back, pos);
        dummy.position.copy(pos);
        const f = 1 - (k + 1) / (TRAIL + 1);
        dummy.scale.setScalar(0.32 * f * f + 0.03);
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
        <mesh geometry={GEO.octa} scale={0.34}>
          <meshBasicMaterial color={PALETTE.hero} toneMapped={false} />
        </mesh>
        {/* Guidance ring around the direction of travel. */}
        <mesh ref={ringRef} geometry={GEO.torus} scale={0.62}>
          <meshBasicMaterial color={PALETTE.hero} toneMapped={false} transparent opacity={0.55} />
        </mesh>
      </group>
      <instancedMesh ref={trailRef} args={[GEO.sphere, undefined, TRAIL]} frustumCulled={false} visible={false}>
        <meshBasicMaterial toneMapped={false} transparent opacity={0.5} />
      </instancedMesh>
    </>
  );
}
