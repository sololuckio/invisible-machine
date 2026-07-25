"use client";

import { Grid } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FACILITY, FACILITY_CORE, SHAFT_BOTTOM, SHAFT_R, SHAFT_TOP } from "@/lib/facility";
import type { FacilityLayout, Placement } from "@/lib/facility";
import { damp } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { stageState } from "@/lib/stage";
import { NODE_DEFS, NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";
import {
  GEO,
  frameMat,
  lampMat,
  markingMat,
  railMat,
  structuralDarkMat,
  structuralMat,
  trimMat,
  wornMat,
} from "./materials";

/**
 * The shaft the machine lives in — and, more importantly, the plant it is one
 * cell of. Columns and ring beams give the well its architecture; the
 * instanced service layers (walkways, handrails, ladders, access doors, cable
 * trays, cooling units, distant blocks) give it **scale and occupancy**: this
 * is somewhere people maintain, whether or not anyone is watching.
 *
 * Every service layer is a single `InstancedMesh`, so hundreds of parts cost
 * one draw call each. Layout comes from `lib/facility.ts` and is computed once
 * at module load, never per frame.
 */

/* ------------------------------------------------------------------ *
 * Instanced service layers
 * ------------------------------------------------------------------ */

const TMP = new THREE.Object3D();

function useLayer(parts: Placement[], geometry: THREE.BufferGeometry, material: THREE.Material) {
  return useMemo(() => {
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      TMP.position.set(p.pos[0], p.pos[1], p.pos[2]);
      TMP.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      TMP.scale.set(p.scale[0], p.scale[1], p.scale[2]);
      TMP.updateMatrix();
      mesh.setMatrixAt(i, TMP.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // Cull against where the instances actually are, not the unit source cube.
    mesh.computeBoundingSphere();
    mesh.matrixAutoUpdate = false;
    return mesh;
  }, [parts, geometry, material]);
}

function ServiceLayers({ layout }: { layout: FacilityLayout }) {
  const frames = useLayer(layout.frame, GEO.box, frameMat);
  const plates = useLayer(layout.plate, GEO.box, structuralDarkMat);
  const tubes = useLayer(layout.tube, GEO.cylinder8, railMat);
  const lamps = useLayer(layout.lamp, GEO.box, lampMat);
  const markings = useLayer(layout.marking, GEO.box, markingMat);
  return (
    <>
      <primitive object={frames} dispose={null} />
      <primitive object={plates} dispose={null} />
      <primitive object={tubes} dispose={null} />
      <primitive object={lamps} dispose={null} />
      <primitive object={markings} dispose={null} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The plant runs itself
 * ------------------------------------------------------------------ */

/**
 * A maintenance hoist working its way down the far side of the shaft on a
 * ninety-second cycle. Nobody is asked to look at it. It is here because a
 * facility that only moves when the story needs it to is a set, and a facility
 * with one indifferent machine going about its own business is a place.
 */
function MaintenanceHoist() {
  const car = useRef<THREE.Group>(null);
  const angle = 3.94;
  const radius = SHAFT_R - 1.15;

  useFrame((state) => {
    if (!car.current) return;
    const t = state.clock.elapsedTime;
    // A slow triangle wave: down, pause at the bottom, back up.
    const cycle = (t % 96) / 96;
    const k = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
    const eased = k * k * (3 - 2 * k);
    car.current.position.y = -2.4 - eased * 15.4;
  });

  return (
    <group rotation={[0, -angle, 0]} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
      {/* Hoist rail the car runs on. */}
      <mesh
        geometry={GEO.box}
        material={structuralMat}
        scale={[0.14, 18.6, 0.3]}
        position={[0, -10.6, 0]}
        dispose={null}
      />
      <group ref={car} position={[0, -3, 0]}>
        <mesh geometry={GEO.box} material={wornMat} scale={[0.72, 0.95, 1.1]} dispose={null} />
        <mesh
          geometry={GEO.box}
          material={structuralDarkMat}
          scale={[0.1, 0.62, 0.9]}
          position={[-0.38, 0, 0]}
          dispose={null}
        />
        {/* Working light on the car. */}
        <mesh
          geometry={GEO.box}
          material={lampMat}
          scale={[0.12, 0.08, 0.34]}
          position={[-0.42, 0.36, 0]}
          dispose={null}
        />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Lighting direction
 * ------------------------------------------------------------------ */

interface LightState {
  ambient: number;
  hemi: number;
  key: number;
  counter: number;
  signal: number;
  /** Local light on whatever station the story is pointing at. */
  focus: number;
  /** The intelligence layer's clinical measuring light. */
  scan: number;
  /** 0 = neutral key, 1 = the pale analytical key. */
  clinical: number;
}

/**
 * Five lighting states, mapped from the stage director's beats. The failure
 * state is the important one: it does **not** wash the scene red. It pulls
 * the fill down, drops the ambient so shadows deepen, quietens the flow light
 * everywhere else, and raises one hard local source on the station the engine
 * actually named — so the picture says "the problem is *here*" using contrast
 * rather than colour, which also keeps it legible to colour-blind visitors.
 */
const LIGHT_STATES: Record<string, LightState> = {
  // The reveal: dramatic, underlit, most of the plant still secret.
  reveal: { ambient: 0.17, hemi: 0.66, key: 2.05, counter: 0.36, signal: 24, focus: 0, scan: 0, clinical: 0 },
  // Normal operation: calm, precise, controlled.
  normal: { ambient: 0.3, hemi: 1.15, key: 1.7, counter: 0.6, signal: 40, focus: 0, scan: 0, clinical: 0 },
  // Growth: more of everything, the plant working harder.
  growth: { ambient: 0.35, hemi: 1.32, key: 1.92, counter: 0.72, signal: 60, focus: 0, scan: 0, clinical: 0 },
  // Pressure building: fill starts to withdraw, the constraint starts to tell.
  strain: { ambient: 0.23, hemi: 0.88, key: 1.48, counter: 0.48, signal: 42, focus: 34, scan: 0, clinical: 0 },
  // The lock: contrast at maximum, everything irrelevant in shadow.
  failure: { ambient: 0.12, hemi: 0.46, key: 0.98, counter: 0.26, signal: 15, focus: 105, scan: 0, clinical: 0 },
  // Intelligence: clinical, flat, analytical — measurement light, not mood.
  intel: { ambient: 0.38, hemi: 1.04, key: 1.36, counter: 0.32, signal: 15, focus: 26, scan: 74, clinical: 1 },
  // Recovery: harmony and confidence, balanced rather than bright.
  recovery: { ambient: 0.33, hemi: 1.26, key: 1.86, counter: 0.74, signal: 48, focus: 0, scan: 0, clinical: 0 },
  // The epilogue: settled, quiet, the machine at rest.
  calm: { ambient: 0.25, hemi: 0.98, key: 1.62, counter: 0.54, signal: 28, focus: 0, scan: 0, clinical: 0 },
};

const STATE_BY_BEAT: Record<string, keyof typeof LIGHT_STATES> = {
  stillness: "reveal",
  instability: "reveal",
  ignition: "reveal",
  release: "reveal",
  descent: "reveal",
  hero: "normal",
  pressure: "growth",
  rising: "strain",
  compression: "strain",
  lock: "failure",
  inspect: "failure",
  prescan: "normal",
  scan: "intel",
  restructure: "recovery",
  managed: "recovery",
  reflect: "recovery",
  closure: "calm",
  lab: "normal",
};

const KEY_NEUTRAL = new THREE.Color("#e4ecff");
const KEY_CLINICAL = new THREE.Color(PALETTE.intel);

function LightDirector() {
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const counter = useRef<THREE.DirectionalLight>(null);
  const signal = useRef<THREE.PointLight>(null);
  const focus = useRef<THREE.PointLight>(null);
  const scan = useRef<THREE.PointLight>(null);
  // Damped current values, so a beat change glides instead of cutting.
  const now = useRef<LightState>({ ...LIGHT_STATES.reveal });

  useFrame((_, delta) => {
    const ui = useUIStore.getState();
    const target = LIGHT_STATES[STATE_BY_BEAT[stageState.beat] ?? "normal"] ?? LIGHT_STATES.normal;
    const c = now.current;
    // Reduced motion still gets the states — it just arrives at them instantly
    // rather than being taken there.
    const k = ui.reducedMotion ? 1 : damp(1.7, delta);
    c.ambient += (target.ambient - c.ambient) * k;
    c.hemi += (target.hemi - c.hemi) * k;
    c.key += (target.key - c.key) * k;
    c.counter += (target.counter - c.counter) * k;
    c.signal += (target.signal - c.signal) * k;
    c.focus += (target.focus - c.focus) * k;
    c.scan += (target.scan - c.scan) * k;
    c.clinical += (target.clinical - c.clinical) * k;

    if (ambient.current) ambient.current.intensity = c.ambient;
    if (hemi.current) hemi.current.intensity = c.hemi;
    if (counter.current) counter.current.intensity = c.counter;
    if (signal.current) signal.current.intensity = c.signal;
    if (key.current) {
      key.current.intensity = c.key;
      key.current.color.copy(KEY_NEUTRAL).lerp(KEY_CLINICAL, c.clinical);
    }

    // The focus light rides to whichever station the story is pointing at.
    if (focus.current) {
      const id = fxBus.focusNode ?? useSimStore.getState().sim.bottleneck;
      const def = id ? NODE_MAP[id] : null;
      if (def && c.focus > 0.5) {
        focus.current.visible = true;
        focus.current.intensity = c.focus;
        const [x, y, z] = def.position;
        focus.current.position.set(x + 1.4, y + 2.2, z + 2.2);
      } else {
        focus.current.visible = false;
      }
    }

    // Measurement light: travels with the scan plane, then leaves with it.
    if (scan.current) {
      const y = fxBus.scanY;
      if (y !== null && c.scan > 0.5) {
        scan.current.visible = true;
        scan.current.intensity = c.scan;
        scan.current.position.set(0, y, 3.2);
      } else {
        scan.current.visible = false;
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.17} color="#3c4450" />
      <hemisphereLight ref={hemi} args={["#48566a", "#0a0d12", 0.66]} />
      <directionalLight ref={key} position={[6, 10, 7]} intensity={2.05} color="#e4ecff" />
      <directionalLight ref={counter} position={[-8, -6, -5]} intensity={0.36} color="#3d5c6e" />
      <pointLight ref={signal} position={[0, -8, 5]} intensity={24} distance={28} color={PALETTE.signal} />
      <pointLight ref={focus} visible={false} intensity={0} distance={11} color={PALETTE.danger} />
      <pointLight ref={scan} visible={false} intensity={0} distance={17} color={PALETTE.intel} />
      <pointLight position={[0, -19.4, 3]} intensity={18} distance={16} color={PALETTE.warn} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Shaft architecture
 * ------------------------------------------------------------------ */

/** One transform per structural instance, computed once. */
function useShaftLayout() {
  return useMemo(() => {
    const columns: { pos: [number, number, number]; rotY: number }[] = [];
    const COLS = 10;
    for (let i = 0; i < COLS; i++) {
      const a = (i / COLS) * Math.PI * 2 + 0.31;
      // Leave the camera's usual approach corridor open.
      if (Math.abs(Math.sin(a - Math.PI / 2)) > 0.94) continue;
      columns.push({
        pos: [Math.cos(a) * SHAFT_R, (SHAFT_TOP + SHAFT_BOTTOM) / 2, Math.sin(a) * SHAFT_R],
        rotY: -a,
      });
    }
    // A ring beam at each station's working depth ties levels together.
    const beltYs = Array.from(new Set(NODE_DEFS.map((n) => n.position[1] - 0.75)));
    return { columns, beltYs };
  }, []);
}

export function MachineEnvironment({ detail }: { detail: "none" | "core" | "full" }) {
  const { columns, beltYs } = useShaftLayout();
  const detailed = detail !== "none";

  const beltGeo = useMemo(() => {
    const pts: number[] = [];
    const seg = 64;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      pts.push(
        Math.cos(a0) * SHAFT_R,
        0,
        Math.sin(a0) * SHAFT_R,
        Math.cos(a1) * SHAFT_R,
        0,
        Math.sin(a1) * SHAFT_R,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  return (
    <group>
      <LightDirector />

      {detailed && (
        <>
          {/* Structural columns: web, flange and a permanent hairline of trim. */}
          {columns.map((c, i) => (
            <group key={i} position={c.pos} rotation={[0, c.rotY, 0]}>
              <mesh
                geometry={GEO.box}
                material={structuralMat}
                scale={[0.34, SHAFT_TOP - SHAFT_BOTTOM, 0.5]}
                dispose={null}
              />
              <mesh
                geometry={GEO.box}
                material={structuralDarkMat}
                scale={[0.5, SHAFT_TOP - SHAFT_BOTTOM, 0.22]}
                position={[0, 0, -0.18]}
                dispose={null}
              />
              <mesh
                geometry={GEO.box}
                material={trimMat}
                scale={[0.04, SHAFT_TOP - SHAFT_BOTTOM, 0.04]}
                position={[0.2, 0, 0.26]}
                dispose={null}
              />
            </group>
          ))}

          {/* Ring beams marking each working depth. */}
          {beltYs.map((y) => (
            <lineSegments key={y} geometry={beltGeo} position={[0, y, 0]}>
              <lineBasicMaterial color={PALETTE.structureFaint} transparent opacity={0.5} />
            </lineSegments>
          ))}

          {/* Everything that makes it a workplace. */}
          <ServiceLayers layout={detail === "full" ? FACILITY : FACILITY_CORE} />
          {detail === "full" && <MaintenanceHoist />}

          {/* Service floor. */}
          <mesh
            geometry={GEO.cylinder}
            material={structuralDarkMat}
            position={[0, SHAFT_BOTTOM - 0.65, 0]}
            scale={[SHAFT_R * 2.35, 0.5, SHAFT_R * 2.35]}
            dispose={null}
          />
          <Grid
            position={[0, SHAFT_BOTTOM - 0.38, 0]}
            args={[70, 70]}
            cellSize={1.4}
            cellThickness={0.6}
            cellColor={PALETTE.structureFaint}
            sectionSize={7}
            sectionThickness={1}
            sectionColor={PALETTE.structure}
            fadeDistance={38}
            fadeStrength={2}
          />
        </>
      )}
    </group>
  );
}
