"use client";

import { Html, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { fmtInt } from "@/lib/format";
import { TIMING } from "@/lib/motion";
import { PALETTE, STATUS_COLORS } from "@/lib/palette";
import { stageState } from "@/lib/stage";
import type { NodeDef } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";
import { makeRailGeometry } from "./queueLayout";
import {
  GEO,
  interiorGlowMat,
  panelMat,
  plinthMat,
  shellMat,
  structuralDarkMat,
  structuralMat,
  trimMat,
} from "./materials";

/**
 * One station of the machine. Every station shares a chassis — hex plinth,
 * utilisation ring, corner posts, status lamp, queue rail — and carries its
 * own operational identity on top:
 *
 *   acquisition  intake dish with signal fins        (reception array)
 *   checkout     validation gate between pylons      (decision frame)
 *   payment      rotating verification ring + core   (secure gate)
 *   inventory    rack of stock cells that empty      (capacity bank)
 *   fulfilment   assembly chamber with moving gantry (processing core)
 *   delivery     dispatch ramp with outbound chutes  (departure structure)
 *   support      comm loops + unresolved reservoir   (resolution array)
 *   revenue      stacked ledger discs                (consolidation core)
 *
 * Animation communicates state, not decoration: mechanisms run at the real
 * processing tempo, stock cells empty with the real stock level, the support
 * reservoir fills with real open issues.
 */

const RING_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform float uFill;
  uniform float uOverflow;
  uniform vec3 uColor;
  uniform vec3 uTrack;
  uniform vec3 uDanger;
  varying vec2 vPos;
  void main() {
    float angle = atan(vPos.y, vPos.x);           // -PI..PI, 0 at +X
    float norm = fract((angle + 3.14159265) / 6.2831853 + 0.25); // start at top
    float filled = step(norm, uFill);
    vec3 color = mix(uTrack, mix(uColor, uDanger, uOverflow), filled);
    float alpha = mix(0.3, 0.95, filled);
    gl_FragColor = vec4(color, alpha);
  }
`;

function bracketGeometry(size: number): THREE.BufferGeometry {
  const s = size;
  const l = size * 0.38;
  const pts: number[] = [];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    // Two strokes per corner, in the XZ plane.
    pts.push(sx * s, 0, sy * s, sx * (s - l), 0, sy * s);
    pts.push(sx * s, 0, sy * s, sx * s, 0, sy * (s - l));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

/** Queue rail arc — the physical gutter queued orders wait in. */
const RAIL_GEO = makeRailGeometry();

interface StationRefs {
  accent: React.RefObject<THREE.MeshStandardMaterial | null>;
  mech: React.RefObject<THREE.Object3D | null>;
  cells: React.RefObject<THREE.InstancedMesh | null>;
  reservoir: React.RefObject<THREE.Mesh | null>;
}

/** The animated accent material every variant carries somewhere. */
function AccentMaterial({ refObj }: { refObj: StationRefs["accent"] }) {
  return (
    <meshStandardMaterial
      ref={refObj}
      color="#11151c"
      metalness={0.6}
      roughness={0.3}
      emissive={PALETTE.signal}
      emissiveIntensity={0.4}
    />
  );
}

function AcquisitionBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Intake dish opening skyward. */}
      <mesh geometry={GEO.cone} material={shellMat} scale={[1.5, -0.62, 1.5]} position={[0, 0.28, 0]} dispose={null} />
      <mesh geometry={GEO.cylinder} material={panelMat} scale={[0.6, 0.5, 0.6]} position={[0, -0.2, 0]} dispose={null} />
      {/* Inner reception glow — breathes with real arrivals. */}
      <mesh geometry={GEO.cylinder} scale={[1.18, 0.03, 1.18]} position={[0, 0.44, 0]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
      {/* Signal fins collecting from three directions. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <group key={i} rotation={[0, -a, 0]} position={[Math.cos(a) * 0.82, 0.62, Math.sin(a) * 0.82]}>
            <mesh geometry={GEO.box} material={structuralMat} scale={[0.05, 0.66, 0.2]} rotation={[0, 0, 0.28]} dispose={null} />
          </group>
        );
      })}
    </group>
  );
}

function CheckoutBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Two pylons and a lintel: the decision frame. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[0.28, 1.16, 0.42]} position={[-0.52, 0, 0]} dispose={null} />
      <mesh geometry={GEO.box} material={shellMat} scale={[0.28, 1.16, 0.42]} position={[0.52, 0, 0]} dispose={null} />
      <mesh geometry={GEO.box} material={panelMat} scale={[1.34, 0.2, 0.46]} position={[0, 0.66, 0]} dispose={null} />
      <mesh geometry={GEO.box} material={trimMat} scale={[1.2, 0.02, 0.05]} position={[0, 0.54, 0.2]} dispose={null} />
      {/* The validation field between the pylons. */}
      <mesh geometry={GEO.box} scale={[0.76, 0.9, 0.05]} position={[0, -0.04, 0]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
    </group>
  );
}

function PaymentBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Locked transaction core. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[0.62, 0.72, 0.62]} dispose={null} />
      <mesh geometry={GEO.box} scale={[0.4, 0.44, 0.66]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
      {/* Verification ring spinning at processing tempo. */}
      <group ref={r.mech as React.RefObject<THREE.Group>}>
        <mesh geometry={GEO.torusThick} material={structuralMat} scale={[1.9, 1.9, 1.9]} rotation={[Math.PI / 2, 0, 0]} dispose={null} />
        <mesh geometry={GEO.box} material={trimMat} scale={[0.08, 0.08, 0.14]} position={[0.95, 0, 0]} dispose={null} />
      </group>
      {/* Dual authorisation blocks. */}
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 0.9, 0.2]} position={[-0.55, -0.1, -0.5]} dispose={null} />
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 0.9, 0.2]} position={[0.55, -0.1, 0.5]} dispose={null} />
    </group>
  );
}

const CELL_COLS = 4;
const CELL_ROWS = 3;

function InventoryBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Storage rack frame. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[1.3, 1.28, 0.5]} position={[0, 0.05, -0.2]} dispose={null} />
      <mesh geometry={GEO.box} material={panelMat} scale={[1.14, 1.12, 0.1]} position={[0, 0.05, 0.06]} dispose={null} />
      {/* Stock cells — lit cells are real units on real shelves. */}
      <instancedMesh
        ref={r.cells}
        args={[GEO.box, undefined, CELL_COLS * CELL_ROWS]}
        position={[0, 0.05, 0.14]}
        frustumCulled={false}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Refill chute from above. */}
      <mesh geometry={GEO.box} material={structuralMat} scale={[0.24, 0.5, 0.24]} position={[-0.75, 0.9, -0.2]} rotation={[0, 0, 0.5]} dispose={null} />
      <mesh geometry={GEO.box} scale={[0.16, 0.05, 0.16]} position={[-0.62, 0.68, -0.2]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
    </group>
  );
}

function FulfilmentBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Assembly chamber with an open working face. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[1.5, 1.06, 0.94]} position={[0, 0.1, -0.24]} dispose={null} />
      <mesh geometry={GEO.box} material={interiorGlowMat} scale={[1.3, 0.82, 0.06]} position={[0, 0.1, 0.22]} dispose={null} />
      {/* The picking gantry — its sweep speed is the station's real tempo. */}
      <mesh geometry={GEO.box} material={structuralMat} scale={[1.62, 0.08, 0.12]} position={[0, 0.62, 0.3]} dispose={null} />
      <group ref={r.mech as React.RefObject<THREE.Group>} position={[0, 0.28, 0.3]}>
        <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.16, 0.78, 0.14]} dispose={null} />
        <mesh geometry={GEO.box} scale={[0.22, 0.16, 0.18]} position={[0, -0.34, 0.02]}>
          <AccentMaterial refObj={r.accent} />
        </mesh>
      </group>
      {/* Roof vents. */}
      {[-0.45, 0, 0.45].map((x) => (
        <mesh key={x} geometry={GEO.box} material={structuralDarkMat} scale={[0.22, 0.1, 0.5]} position={[x, 0.7, -0.3]} dispose={null} />
      ))}
    </group>
  );
}

function DeliveryBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Dispatch bay. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[1.1, 0.92, 0.9]} position={[0, 0.06, -0.3]} dispose={null} />
      {/* Departure aperture. */}
      <mesh geometry={GEO.box} scale={[0.66, 0.5, 0.06]} position={[0, 0.12, 0.17]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
      {/* Outbound ramp and three route chutes fanning outwards. */}
      <mesh geometry={GEO.box} material={panelMat} scale={[0.9, 0.07, 0.8]} position={[0, -0.28, 0.5]} rotation={[0.24, 0, 0]} dispose={null} />
      {[-0.4, 0, 0.4].map((a) => (
        <mesh
          key={a}
          geometry={GEO.box}
          material={structuralMat}
          scale={[0.09, 0.05, 0.62]}
          position={[Math.sin(a) * 0.62, -0.44, 0.86 + Math.cos(Math.abs(a)) * 0.14]}
          rotation={[0.24, a, 0]}
          dispose={null}
        />
      ))}
    </group>
  );
}

function SupportBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Resolution hub. */}
      <mesh geometry={GEO.cylinder} material={shellMat} scale={[0.72, 0.9, 0.72]} position={[0, 0.02, 0]} dispose={null} />
      <mesh geometry={GEO.cylinder} scale={[0.5, 0.08, 0.5]} position={[0, 0.52, 0]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
      {/* Communication loops orbiting the hub. */}
      <group ref={r.mech as React.RefObject<THREE.Group>}>
        <mesh geometry={GEO.torus} material={structuralMat} scale={[1.7, 1.7, 1.7]} rotation={[Math.PI / 2.3, 0, 0]} dispose={null} />
        <mesh geometry={GEO.torus} material={structuralMat} scale={[1.44, 1.44, 1.44]} rotation={[Math.PI / 1.8, 0, 0.9]} dispose={null} />
      </group>
      {/* Unresolved-issue reservoir — fills with real open conversations. */}
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 1.0, 0.2]} position={[0.66, 0.0, -0.4]} dispose={null} />
      <mesh ref={r.reservoir} geometry={GEO.box} position={[0.66, -0.48, -0.4]}>
        <meshBasicMaterial color={PALETTE.warn} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RevenueBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Consolidation slab. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[1.5, 0.2, 1.5]} position={[0, -0.42, 0]} dispose={null} />
      {/* Ledger discs — the archive of everything that survived. */}
      <group ref={r.mech as React.RefObject<THREE.Group>}>
        <mesh geometry={GEO.cylinder} material={panelMat} scale={[1.9, 0.12, 1.9]} position={[0, -0.22, 0]} dispose={null} />
        <mesh geometry={GEO.cylinder} material={structuralMat} scale={[1.5, 0.12, 1.5]} position={[0, -0.02, 0]} dispose={null} />
        <mesh geometry={GEO.cylinder} material={panelMat} scale={[1.1, 0.12, 1.1]} position={[0, 0.18, 0]} dispose={null} />
      </group>
      <mesh geometry={GEO.cylinder} scale={[0.5, 0.34, 0.5]} position={[0, 0.42, 0]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
    </group>
  );
}

const BODIES: Record<string, (p: { r: StationRefs }) => React.JSX.Element> = {
  acquisition: AcquisitionBody,
  checkout: CheckoutBody,
  payment: PaymentBody,
  inventory: InventoryBody,
  fulfilment: FulfilmentBody,
  delivery: DeliveryBody,
  support: SupportBody,
  revenue: RevenueBody,
};

export function StationNode({ def, revealed }: { def: NodeDef; revealed: boolean }) {
  const selected = useUIStore((s) => s.selectedNode === def.id);
  const selectNode = useUIStore((s) => s.selectNode);
  // Labels belong to control mode: they join once the visitor is working with
  // the machine, and step aside during cinematic beats so the machine itself
  // tells the story. (Chapter 2's manifest already names every station.)
  const labelled = useUIStore(
    (s) => s.labOpen || s.reducedMotion || (s.activeChapter >= 3 && !s.cinematic),
  );
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const accentMat = useRef<THREE.MeshStandardMaterial>(null);
  const mechRef = useRef<THREE.Object3D>(null);
  const cellsRef = useRef<THREE.InstancedMesh>(null);
  const reservoirRef = useRef<THREE.Mesh>(null);
  const lampMat = useRef<THREE.MeshBasicMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const bracketRef = useRef<THREE.LineSegments>(null);
  const queueEl = useRef<HTMLSpanElement>(null);
  const lastQueueText = useRef("");

  const refs: StationRefs = useMemo(
    () => ({ accent: accentMat, mech: mechRef, cells: cellsRef, reservoir: reservoirRef }),
    [],
  );

  const ringUniforms = useMemo(
    () => ({
      uFill: { value: 0 },
      uOverflow: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.signal) },
      uTrack: { value: new THREE.Color(PALETTE.structureFaint) },
      uDanger: { value: new THREE.Color(PALETTE.danger) },
    }),
    [],
  );
  const brackets = useMemo(() => bracketGeometry(1.25), []);
  const statusColor = useMemo(() => new THREE.Color(STATUS_COLORS.idle), []);
  const targetColor = useMemo(() => new THREE.Color(), []);
  const cellDummy = useMemo(() => new THREE.Object3D(), []);
  const cellColor = useMemo(() => new THREE.Color(), []);
  const cLit = useMemo(() => new THREE.Color(PALETTE.signal), []);
  const cLow = useMemo(() => new THREE.Color(PALETTE.warn), []);
  const cDark = useMemo(() => new THREE.Color("#131820"), []);

  useFrame((state, delta) => {
    const sim = useSimStore.getState().sim;
    const node = sim.nodes[def.id];
    const t = state.clock.elapsedTime;
    const reduced = useUIStore.getState().reducedMotion;
    const activity = THREE.MathUtils.clamp(node.throughput / Math.max(node.capacity, 1), 0, 1);

    // Utilisation ring: fill 0..1, overflow blends the fill toward danger.
    ringUniforms.uFill.value = THREE.MathUtils.clamp(node.utilization, 0, 1);
    ringUniforms.uOverflow.value = THREE.MathUtils.clamp((node.utilization - 1) / 1.5, 0, 1);

    // Accent + lamp: colour follows status, intensity follows real activity.
    targetColor.set(STATUS_COLORS[node.status]);
    statusColor.lerp(targetColor, Math.min(1, delta * 3));
    if (accentMat.current) {
      accentMat.current.emissive.copy(statusColor);
      const flicker =
        node.status === "critical" && !reduced ? 0.35 * Math.sin(t * 7 + def.position[0]) : 0;
      const breathe = reduced ? 0 : 0.1 * Math.sin(t * (1.1 + activity * 2) + def.position[1]);
      // The AI scan lights each station as its measurement passes.
      const scanGlow =
        fxBus.scanY !== null
          ? Math.max(0, 1 - Math.abs(fxBus.scanY - def.position[1]) / 1.3) * 1.4
          : 0;
      // When the story is pointing at one station — the locked constraint, the
      // station handling the hero order, the one just restructured — everything
      // else steps back so the emphasis cannot be misread. Status colour and
      // the lamp are never dimmed: state is still legible.
      const focus = fxBus.focusNode;
      const stepBack = focus !== null && focus !== def.id ? 0.45 : 1;
      const emphasis = focus === def.id ? 0.55 : 0;
      accentMat.current.emissiveIntensity =
        (0.4 + activity * 0.9 + flicker + breathe + scanGlow) * stepBack + emphasis;
    }
    if (lampMat.current) lampMat.current.color.copy(statusColor);

    // Variant mechanisms — running at the machine's real tempo, paced by the
    // beat: they compress with the constraint and breathe in the epilogue.
    if (mechRef.current && !reduced) {
      const pace = 0.45 + stageState.energy * 0.75;
      if (def.id === "payment") {
        mechRef.current.rotation.z += delta * (0.25 + activity * 2.2) * pace;
      } else if (def.id === "fulfilment") {
        mechRef.current.position.x = Math.sin(t * (0.5 + activity * 3.2) * pace) * 0.62;
      } else if (def.id === "support") {
        mechRef.current.rotation.y += delta * (0.15 + activity * 1.1) * pace;
      } else if (def.id === "revenue") {
        mechRef.current.rotation.y += delta * 0.12 * pace;
      }
    }

    // Inventory stock cells: lit count is the real stock level.
    if (cellsRef.current) {
      const level = THREE.MathUtils.clamp(sim.stock / 100, 0, 1);
      const total = CELL_COLS * CELL_ROWS;
      const lit = Math.round(level * total);
      let i = 0;
      for (let row = 0; row < CELL_ROWS; row++) {
        for (let col = 0; col < CELL_COLS; col++) {
          cellDummy.position.set((col - (CELL_COLS - 1) / 2) * 0.27, (row - 1) * 0.34, 0);
          cellDummy.scale.setScalar(1);
          cellDummy.scale.set(0.2, 0.24, 0.08);
          cellDummy.updateMatrix();
          cellsRef.current.setMatrixAt(i, cellDummy.matrix);
          const isLit = i < lit;
          cellColor.copy(isLit ? (sim.stock < 25 ? cLow : cLit) : cDark);
          cellsRef.current.setColorAt(i, cellColor);
          i++;
        }
      }
      cellsRef.current.instanceMatrix.needsUpdate = true;
      if (cellsRef.current.instanceColor) cellsRef.current.instanceColor.needsUpdate = true;
    }

    // Support reservoir: physical accumulation of unresolved issues.
    if (reservoirRef.current) {
      const load = THREE.MathUtils.clamp(node.queue / 40, 0.02, 1);
      reservoirRef.current.scale.set(0.14, load * 0.92, 0.14);
      reservoirRef.current.position.y = -0.46 + load * 0.46;
      const resMat = reservoirRef.current.material as THREE.MeshBasicMaterial;
      resMat.color.set(load > 0.7 ? PALETTE.danger : PALETTE.warn);
      resMat.opacity = 0.25 + load * 0.75;
      resMat.transparent = true;
    }

    // Recommendation pop: the targeted station visibly reorganises, then settles.
    if (groupRef.current) {
      let scale = 1;
      if (fxBus.popNode === def.id) {
        const age = (performance.now() - fxBus.popAt) / 1000;
        if (age < TIMING.stationPop) {
          scale = 1 + Math.exp(-age * 3.2) * Math.sin(age * 9) * 0.16 + Math.exp(-age * 2.5) * 0.1;
        }
      }
      groupRef.current.scale.setScalar(scale);
    }

    // Selection reticle rotates slowly.
    if (bracketRef.current) {
      bracketRef.current.visible = selected;
      if (!reduced) bracketRef.current.rotation.y = t * 0.5;
    }

    // Live queue readout — imperative DOM update, no React re-render.
    if (queueEl.current) {
      const text = node.queue >= 1 ? `QUEUE ${fmtInt(node.queue)}` : "CLEAR";
      if (text !== lastQueueText.current) {
        lastQueueText.current = text;
        queueEl.current.textContent = text;
        queueEl.current.dataset.status = node.status;
      }
    }
  });

  const Body = BODIES[def.id] ?? FulfilmentBody;

  return (
    <group position={def.position}>
      <group ref={groupRef}>
        {/* Chassis: hex plinth, corner posts, status lamp, queue rail. */}
        <mesh geometry={GEO.cylinder6} material={plinthMat} scale={[2.3, 0.16, 2.3]} position={[0, -0.72, 0]} dispose={null} />
        <mesh geometry={GEO.cylinder6} material={structuralDarkMat} scale={[2.55, 0.1, 2.55]} position={[0, -0.85, 0]} dispose={null} />
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={i}
              geometry={GEO.box}
              material={structuralMat}
              scale={[0.07, 0.34, 0.07]}
              position={[Math.cos(a) * 1.02, -0.5, Math.sin(a) * 1.02]}
              dispose={null}
            />
          );
        })}
        {/* Status lamp on its mast. */}
        <mesh geometry={GEO.box} material={structuralMat} scale={[0.04, 0.62, 0.04]} position={[0.98, -0.36, -0.98]} dispose={null} />
        <mesh geometry={GEO.box} scale={[0.09, 0.09, 0.09]} position={[0.98, -0.02, -0.98]}>
          <meshBasicMaterial ref={lampMat} color={STATUS_COLORS.idle} toneMapped={false} />
        </mesh>
        {/* Queue rail: the arc gutter where waiting orders physically hold. */}
        <mesh geometry={RAIL_GEO} material={structuralMat} dispose={null} />

        {/* Operational identity. */}
        <group position={[0, 0, 0]}>
          <Body r={refs} />
        </group>

        {/* Utilisation ring on the plinth. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.63, 0]}>
          <ringGeometry args={[1.06, 1.18, 64]} />
          <shaderMaterial
            vertexShader={RING_VERTEX}
            fragmentShader={RING_FRAGMENT}
            uniforms={ringUniforms}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Selection reticle */}
        <lineSegments ref={bracketRef} geometry={brackets} visible={false} position={[0, -0.6, 0]}>
          <lineBasicMaterial color={PALETTE.text} transparent opacity={0.9} />
        </lineSegments>

        {/* Invisible hit target (large enough for touch via DOM list too) */}
        <mesh
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            selectNode(def.id);
          }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[1.15, 12, 12]} />
        </mesh>
      </group>

      {/* Technical label — mounted only once the machine is unveiled,
          because drei's Html lives in the DOM, not the WebGL scene graph. */}
      {revealed && labelled && (
        <Html
          position={[0, 1.18, 0]}
          center
          distanceFactor={8.5}
          style={{ pointerEvents: "none" }}
          zIndexRange={[5, 0]}
        >
          <div className={`node-label${hovered || selected ? " is-active" : ""}`}>
            <span className="node-label-tag">{def.tag}</span>
            <span className="node-label-name">{def.name}</span>
            <span ref={queueEl} className="node-label-queue" />
          </div>
        </Html>
      )}
    </group>
  );
}
