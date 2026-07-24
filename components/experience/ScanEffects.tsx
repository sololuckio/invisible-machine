"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { easeInOut, TIMING } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { NODE_DEFS, NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";
import { GEO } from "./materials";

/**
 * The intelligence layer's visible instrument set — deliberately distinct
 * from the machine's warning language. A fine measurement ring descends the
 * shaft; as it passes each station it raises a spatial gauge showing real
 * load against the capacity datum. When the analysis completes, every gauge
 * stands down except the constraint's, and a reticle with a locator beam
 * holds the actual bottleneck the engine found. Also bridges applied
 * recommendations onto the fxBus so the targeted station can react.
 */

const TOP_Y = 1.2;
const BOTTOM_Y = -21;
const DATUM = 1.15;

function StationGauge({
  def,
  refs,
  index,
}: {
  def: (typeof NODE_DEFS)[number];
  refs: React.MutableRefObject<
    { datum: THREE.MeshBasicMaterial | null; load: THREE.Mesh | null; loadMat: THREE.MeshBasicMaterial | null }[]
  >;
  index: number;
}) {
  return (
    <group position={[def.position[0], def.position[1] + 1.5, def.position[2]]}>
      {/* Capacity datum line. */}
      <mesh geometry={GEO.box} scale={[DATUM, 0.035, 0.035]}>
        <meshBasicMaterial
          ref={(m) => {
            refs.current[index].datum = m;
          }}
          color={PALETTE.intel}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Live load bar beneath it. */}
      <mesh
        geometry={GEO.box}
        position={[0, -0.09, 0]}
        ref={(m) => {
          refs.current[index].load = m;
        }}
      >
        <meshBasicMaterial
          ref={(m) => {
            refs.current[index].loadMat = m;
          }}
          color={PALETTE.intel}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function ScanEffects() {
  const sweepRef = useRef<THREE.Group>(null);
  const markerRef = useRef<THREE.Group>(null);
  const markerRing = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const gaugeRefs = useRef(
    NODE_DEFS.map(() => ({
      datum: null as THREE.MeshBasicMaterial | null,
      load: null as THREE.Mesh | null,
      loadMat: null as THREE.MeshBasicMaterial | null,
    })),
  );

  const cWarn = useMemo(() => new THREE.Color(PALETTE.warn), []);
  const cDanger = useMemo(() => new THREE.Color(PALETTE.danger), []);
  const cIntel = useMemo(() => new THREE.Color(PALETTE.intel), []);

  // Bridge: applied recommendations → one-shot pop on the targeted station.
  useEffect(() => {
    return useSimStore.subscribe((state, prev) => {
      if (state.appliedPulse > prev.appliedPulse && state.lastAppliedRec) {
        fxBus.popNode = state.lastAppliedRec.targetNode;
        fxBus.popAt = performance.now();
      }
    });
  }, []);

  useFrame((state, delta) => {
    const ui = useUIStore.getState();
    const simState = useSimStore.getState();
    const sim = simState.sim;
    const bottleneck = simState.analysis?.bottleneck ?? null;
    const scanning = ui.scanStatus === "scanning";
    const complete = ui.scanStatus === "complete";

    // Descending measurement ring.
    let scanY: number | null = null;
    if (sweepRef.current) {
      if (scanning && !ui.reducedMotion) {
        const raw = (performance.now() - ui.scanStartedAt) / 1000 / TIMING.scan;
        const k = easeInOut(THREE.MathUtils.clamp(raw, 0, 1));
        scanY = TOP_Y + (BOTTOM_Y - TOP_Y) * k;
        sweepRef.current.position.y = scanY;
        sweepRef.current.visible = true;
        sweepRef.current.rotation.y = state.clock.elapsedTime * 0.6;
      } else {
        sweepRef.current.visible = false;
        if (scanning) scanY = BOTTOM_Y; // reduced motion: measured instantly
      }
      fxBus.scanY = scanning ? (scanY ?? BOTTOM_Y) : null;
    }

    // Station gauges: rise as the ring passes, hold while the analysis runs,
    // then stand down everywhere except the constraint.
    for (let i = 0; i < NODE_DEFS.length; i++) {
      const def = NODE_DEFS[i];
      const g = gaugeRefs.current[i];
      if (!g.datum || !g.load || !g.loadMat) continue;
      const node = sim.nodes[def.id];
      const passed = scanning && scanY !== null && scanY < def.position[1] + 1.1;
      const isConstraint = complete && bottleneck === def.id;
      const target = passed ? 0.85 : isConstraint ? 0.9 : 0;
      const next = THREE.MathUtils.lerp(g.datum.opacity, target, Math.min(1, delta * 6));
      g.datum.opacity = next;
      g.loadMat.opacity = next;
      // Load bar: live pressure against the capacity datum.
      const loadFrac = THREE.MathUtils.clamp(node.pressure / 2, 0.02, 1.6);
      g.load.scale.set(DATUM * loadFrac, 0.08, 0.08);
      g.load.position.x = (DATUM * loadFrac - DATUM) / 2;
      g.loadMat.color.copy(
        node.pressure > 3 ? cDanger : node.pressure > 1.5 ? cWarn : cIntel,
      );
    }

    // Constraint reticle + locator beam.
    if (markerRef.current) {
      const show = complete && bottleneck !== null;
      markerRef.current.visible = show;
      if (beamRef.current) beamRef.current.visible = show;
      if (show && bottleneck) {
        const [x, y, z] = NODE_MAP[bottleneck].position;
        markerRef.current.position.set(x, y, z);
        if (markerRing.current && !ui.reducedMotion) {
          const pulse = 1.15 + Math.sin(state.clock.elapsedTime * 2.6) * 0.12;
          markerRing.current.scale.setScalar(pulse);
          markerRing.current.rotation.z = state.clock.elapsedTime * 0.4;
        }
        if (beamRef.current && beamMat.current) {
          const h = TOP_Y - y;
          beamRef.current.position.set(x, y + h / 2, z);
          beamRef.current.scale.set(0.09, h, 0.09);
          beamMat.current.opacity = ui.reducedMotion
            ? 0.3
            : 0.22 + Math.sin(state.clock.elapsedTime * 2.6) * 0.1;
        }
      }
    }
  });

  return (
    <group>
      {/* The descending measurement instrument. */}
      <group ref={sweepRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[19, 19]} />
          <meshBasicMaterial
            color={PALETTE.intel}
            transparent
            opacity={0.09}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[8.2, 8.55, 64]} />
          <meshBasicMaterial
            color={PALETTE.intel}
            transparent
            opacity={0.9}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner measurement ring tracking the machine's working radius. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.1, 4.22, 56]} />
          <meshBasicMaterial
            color={PALETTE.intel}
            transparent
            opacity={0.55}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Measurement ticks riding the ring. */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              geometry={GEO.box}
              position={[Math.cos(a) * 8.42, 0, Math.sin(a) * 8.42]}
              rotation={[0, -a, 0]}
              scale={[0.5, 0.02, 0.06]}
            >
              <meshBasicMaterial color={PALETTE.intel} transparent opacity={0.9} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      {/* Spatial gauges the scan raises above each station. */}
      {NODE_DEFS.map((def, i) => (
        <StationGauge key={def.id} def={def} refs={gaugeRefs} index={i} />
      ))}

      {/* Constraint reticle, held at plinth level where it stays readable. */}
      <group ref={markerRef} visible={false}>
        <mesh ref={markerRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]}>
          <ringGeometry args={[1.42, 1.52, 48]} />
          <meshBasicMaterial
            color={PALETTE.warn}
            transparent
            opacity={0.95}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]}>
          <ringGeometry args={[1.68, 1.72, 48]} />
          <meshBasicMaterial
            color={PALETTE.warn}
            transparent
            opacity={0.45}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Locator beam up to the surface. */}
      <mesh ref={beamRef} geometry={GEO.box} visible={false}>
        <meshBasicMaterial
          ref={beamMat}
          color={PALETTE.warn}
          transparent
          opacity={0.35}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
