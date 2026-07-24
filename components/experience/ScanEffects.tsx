"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/palette";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";

/**
 * The intelligence layer's visible presence: a luminous analysis plane that
 * sweeps the full depth of the machine, and afterwards a pulsing marker on
 * the constraint it found. Also bridges applied recommendations onto the
 * fxBus so the targeted station can react.
 */

const SCAN_DURATION = 2.6; // seconds — matches the AI panel's timing
const TOP_Y = 1.2;
const BOTTOM_Y = -21;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function ScanEffects() {
  const planeRef = useRef<THREE.Group>(null);
  const markerRef = useRef<THREE.Group>(null);
  const markerRing = useRef<THREE.Mesh>(null);

  const bottleneck = useSimStore((s) => s.analysis?.bottleneck ?? null);
  const scanStatus = useUIStore((s) => s.scanStatus);

  // Bridge: applied recommendations → one-shot pop on the targeted station.
  useEffect(() => {
    return useSimStore.subscribe((state, prev) => {
      if (state.appliedPulse > prev.appliedPulse && state.lastAppliedRec) {
        fxBus.popNode = state.lastAppliedRec.targetNode;
        fxBus.popAt = performance.now();
      }
    });
  }, []);

  useFrame((state) => {
    const ui = useUIStore.getState();

    // Sweep plane.
    if (planeRef.current) {
      if (ui.scanStatus === "scanning") {
        const raw = (performance.now() - ui.scanStartedAt) / 1000 / SCAN_DURATION;
        const k = easeInOut(THREE.MathUtils.clamp(raw, 0, 1));
        const y = TOP_Y + (BOTTOM_Y - TOP_Y) * (ui.reducedMotion ? 1 : k);
        planeRef.current.position.y = y;
        planeRef.current.visible = !ui.reducedMotion;
        fxBus.scanY = y;
      } else {
        planeRef.current.visible = false;
        fxBus.scanY = null;
      }
    }

    // Constraint marker.
    if (markerRef.current) {
      const show = scanStatus === "complete" && bottleneck !== null;
      markerRef.current.visible = show;
      if (show && bottleneck) {
        const [x, y, z] = NODE_MAP[bottleneck].position;
        markerRef.current.position.set(x, y, z);
        if (markerRing.current && !ui.reducedMotion) {
          const pulse = 1.15 + Math.sin(state.clock.elapsedTime * 2.6) * 0.12;
          markerRing.current.scale.setScalar(pulse);
          markerRing.current.rotation.z = state.clock.elapsedTime * 0.4;
        }
      }
    }
  });

  return (
    <group>
      <group ref={planeRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[19, 19]} />
          <meshBasicMaterial
            color={PALETTE.signal}
            transparent
            opacity={0.07}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[8.35, 8.55, 64]} />
          <meshBasicMaterial
            color={PALETTE.signal}
            transparent
            opacity={0.6}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <group ref={markerRef} visible={false}>
        <mesh ref={markerRing} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.15, 1.24, 48]} />
          <meshBasicMaterial
            color={PALETTE.warn}
            transparent
            opacity={0.9}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
