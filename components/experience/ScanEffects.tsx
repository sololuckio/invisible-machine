"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, easeInOut, easeOutCubic, smooth01, span, TIMING } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { RESTRUCTURE_MS, stageState } from "@/lib/stage";
import { NODE_DEFS, NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";
import { GEO } from "./materials";

/**
 * Two instruments, deliberately different from each other and from the
 * machine's own warning language.
 *
 * The constraint lock (Chapter 4) is the machine's: a reticle that contracts
 * onto the station the engine actually named, a locator beam to the surface,
 * and then stillness while the diagnosis is read.
 *
 * The intelligence pass (Chapter 5) is the analysis layer's: a diagnostic
 * pulse leaves the machine core, a measurement ring descends the shaft raising
 * a spatial load-against-capacity gauge over each station as it passes, the
 * connections trace themselves (in Pathways, from the same scan front), and
 * when the analysis lands the ranked candidate interventions are marked in
 * space above the stations they would change. Applying one unlocks the
 * targeted structure with a visible release.
 */

const TOP_Y = 1.2;
const BOTTOM_Y = -21;
const DATUM = 1.15;
/** Where the machine's diagnostic pulse originates. */
const CORE_Y = -11;
const CANDIDATES = 3;

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
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const markerRef = useRef<THREE.Group>(null);
  const markerRing = useRef<THREE.Mesh>(null);
  const markerOuter = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const unlockRef = useRef<THREE.Mesh>(null);
  const unlockMat = useRef<THREE.MeshBasicMaterial>(null);
  const candidateRefs = useRef<(THREE.Group | null)[]>(Array(CANDIDATES).fill(null));
  const candidateMats = useRef<(THREE.MeshBasicMaterial | null)[]>(Array(CANDIDATES).fill(null));
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

  useFrame((state, delta) => {
    const ui = useUIStore.getState();
    const simState = useSimStore.getState();
    const sim = simState.sim;
    const analysis = simState.analysis;
    const scanning = ui.scanStatus === "scanning";
    const complete = ui.scanStatus === "complete";
    const now = performance.now();
    const t = state.clock.elapsedTime;
    const beat = stageState.beat;

    // ---- the diagnostic pulse leaving the machine core -------------------
    const scanAge = scanning ? (now - ui.scanStartedAt) / 1000 : -1;
    if (coreRef.current && coreMat.current) {
      const live = scanning && !ui.reducedMotion && scanAge < 0.9;
      coreRef.current.visible = live;
      if (live) {
        const k = clamp01(scanAge / 0.9);
        const r = 0.5 + easeOutCubic(k) * 9.5;
        coreRef.current.scale.set(r, r, 1);
        coreMat.current.opacity = (1 - k) * 0.7;
      }
    }

    // ---- the descending measurement ring ---------------------------------
    let scanY: number | null = null;
    if (sweepRef.current) {
      if (scanning && !ui.reducedMotion) {
        // The ring only starts travelling once the core pulse has left.
        const k = easeInOut(clamp01(span(scanAge, 0.22, TIMING.scan)));
        scanY = TOP_Y + (BOTTOM_Y - TOP_Y) * k;
        sweepRef.current.position.y = scanY;
        sweepRef.current.visible = scanAge > 0.16;
        sweepRef.current.rotation.y = t * 0.6;
      } else {
        sweepRef.current.visible = false;
        if (scanning) scanY = BOTTOM_Y; // reduced motion: measured instantly
      }
      fxBus.scanY = scanning ? (scanY ?? BOTTOM_Y) : null;
    }

    // ---- station gauges ---------------------------------------------------
    const constraint = analysis?.bottleneck ?? sim.bottleneck ?? null;
    for (let i = 0; i < NODE_DEFS.length; i++) {
      const def = NODE_DEFS[i];
      const g = gaugeRefs.current[i];
      if (!g.datum || !g.load || !g.loadMat) continue;
      const node = sim.nodes[def.id];
      const passed = scanning && scanY !== null && scanY < def.position[1] + 1.1;
      const isConstraint = complete && constraint === def.id;
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

    // ---- constraint reticle: the lock, and the analysed result ------------
    if (markerRef.current) {
      const locking = beat === "lock" || beat === "inspect";
      const target = complete ? constraint : locking ? sim.bottleneck : null;
      const show = target !== null && (complete || locking);
      markerRef.current.visible = show;
      if (beamRef.current) beamRef.current.visible = show;
      if (show && target) {
        const [x, y, z] = NODE_MAP[target].position;
        markerRef.current.position.set(x, y, z);
        // Locking on: the rings arrive from outside and contract onto the
        // station, then hold. After that they only breathe.
        const lockK = ui.reducedMotion
          ? 1
          : clamp01((now - fxBus.lockAt) / 1000 / TIMING.lock);
        const arrive = locking && !complete ? 1 + (1 - easeOutCubic(lockK)) * 1.4 : 1;
        if (markerRing.current) {
          const breathe = ui.reducedMotion ? 1.15 : 1.15 + Math.sin(t * 2.6) * 0.1;
          markerRing.current.scale.setScalar(breathe * arrive);
          if (!ui.reducedMotion) markerRing.current.rotation.z = t * 0.4;
        }
        if (markerOuter.current) markerOuter.current.scale.setScalar(arrive);
        if (beamRef.current && beamMat.current) {
          const h = TOP_Y - y;
          beamRef.current.position.set(x, y + h / 2, z);
          beamRef.current.scale.set(0.09, h, 0.09);
          beamMat.current.opacity =
            (ui.reducedMotion ? 0.3 : 0.22 + Math.sin(t * 2.6) * 0.1) *
            (locking && !complete ? easeOutCubic(lockK) : 1);
        }
      }
    }

    // ---- ranked candidate interventions, marked where they would land -----
    const recs = complete ? (analysis?.recommendations ?? []) : [];
    for (let i = 0; i < CANDIDATES; i++) {
      const group = candidateRefs.current[i];
      const mat = candidateMats.current[i];
      if (!group || !mat) continue;
      const rec = recs[i];
      group.visible = Boolean(rec);
      if (!rec) continue;
      const [x, y, z] = NODE_MAP[rec.targetNode].position;
      // Stack them clear of the gauge, primary highest and largest.
      group.position.set(x, y + 2.15, z);
      const scale = i === 0 ? 1 : 0.62;
      group.scale.setScalar(scale);
      if (!ui.reducedMotion) group.rotation.y = t * (i === 0 ? 0.7 : 0.45);
      mat.opacity = i === 0 ? 0.95 : 0.5;
    }

    // ---- restructuring: the targeted structure visibly unlocks ------------
    if (unlockRef.current && unlockMat.current) {
      const applied = fxBus.appliedAt > 0 ? (now - fxBus.appliedAt) / 1000 : Infinity;
      const live = applied < RESTRUCTURE_MS / 1000 && fxBus.popNode !== null;
      unlockRef.current.visible = live && !ui.reducedMotion;
      if (live && fxBus.popNode) {
        const [x, y, z] = NODE_MAP[fxBus.popNode].position;
        // A ring leaves the station outward — the constraint being released.
        const k = clamp01(applied / 1.1);
        unlockRef.current.position.set(x, y - 0.58, z);
        const r = 1.0 + easeOutCubic(k) * 2.6;
        unlockRef.current.scale.set(r, r, 1);
        unlockMat.current.opacity = (1 - smooth01(k)) * 0.75;
      }
    }
  });

  return (
    <group>
      {/* Diagnostic pulse leaving the machine core. */}
      <mesh ref={coreRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, CORE_Y, 0]} visible={false}>
        <ringGeometry args={[0.93, 1, 72]} />
        <meshBasicMaterial
          ref={coreMat}
          color={PALETTE.intel}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

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
        <mesh ref={markerOuter} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]}>
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

      {/* Ranked candidate interventions, in the space they would change. */}
      {Array.from({ length: CANDIDATES }, (_, i) => (
        <group
          key={i}
          ref={(g) => {
            candidateRefs.current[i] = g;
          }}
          visible={false}
        >
          <mesh geometry={GEO.octa} scale={[0.22, 0.34, 0.22]}>
            <meshBasicMaterial
              ref={(m) => {
                candidateMats.current[i] = m;
              }}
              color={PALETTE.intel}
              transparent
              opacity={0.9}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          <mesh geometry={GEO.box} scale={[0.012, 0.5, 0.012]} position={[0, -0.42, 0]}>
            <meshBasicMaterial color={PALETTE.intel} transparent opacity={0.45} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* The release when a recommendation is applied. */}
      <mesh ref={unlockRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.9, 1, 56]} />
        <meshBasicMaterial
          ref={unlockMat}
          color={PALETTE.success}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
