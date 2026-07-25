"use client";

import { Html, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { fmtInt } from "@/lib/format";
import { TIMING, damp, travelDwell } from "@/lib/motion";
import { PALETTE, STATUS_COLORS, STATUS_LABELS } from "@/lib/palette";
import { stageState } from "@/lib/stage";
import type { NodeDef } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";
import { makeRailGeometry } from "./queueLayout";
import {
  GEO,
  glassMat,
  interiorGlowMat,
  machinedMat,
  markingMat,
  panelMat,
  plinthMat,
  polymerMat,
  sealMat,
  shellMat,
  structuralDarkMat,
  structuralMat,
  trimMat,
  wornMat,
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
  /** Second axis or counter-rotating layer, where the station has one. */
  mech2: React.RefObject<THREE.Object3D | null>;
  cells: React.RefObject<THREE.InstancedMesh | null>;
  reservoir: React.RefObject<THREE.Mesh | null>;
}

/**
 * Per-station mechanism state. Real actuators carry momentum: they spin up,
 * they coast down, and a pick-and-place spends much of its cycle standing
 * still. Keeping velocity and cycle phase here — rather than deriving position
 * straight from a clock — is what stops a change in tempo from teleporting a
 * mechanism to a new speed.
 */
interface MechState {
  /** Free-running cycle phase for travelling mechanisms. */
  phase: number;
  /** Angular velocity, damped toward the demanded speed. */
  spin: number;
  /** Damped follower for the picking head. */
  head: number;
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
      {/* Collection manifold: what the dish actually gathers into. */}
      <mesh geometry={GEO.torusThick} material={machinedMat} scale={[1.24, 1.24, 1.24]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} dispose={null} />
      {/* Signal fins collecting from three directions, each on its own duct. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <group key={i} rotation={[0, -a, 0]} position={[Math.cos(a) * 0.82, 0.62, Math.sin(a) * 0.82]}>
            <mesh geometry={GEO.box} material={structuralMat} scale={[0.05, 0.66, 0.2]} rotation={[0, 0, 0.28]} dispose={null} />
            <mesh geometry={GEO.cylinder8} material={polymerMat} scale={[0.09, 0.86, 0.09]} position={[0, -0.72, 0]} dispose={null} />
          </group>
        );
      })}
      {/* Sensor head under a weather cover — it is outside, after all. */}
      <mesh geometry={GEO.cylinder8} material={structuralMat} scale={[0.07, 0.5, 0.07]} position={[0.62, 0.5, -0.66]} dispose={null} />
      <mesh geometry={GEO.sphere} material={glassMat} scale={[0.2, 0.2, 0.2]} position={[0.62, 0.78, -0.66]} dispose={null} />
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
      {/* Scanner head on the lintel, reading whatever passes beneath it. */}
      <mesh geometry={GEO.box} material={machinedMat} scale={[0.34, 0.16, 0.22]} position={[0, 0.5, 0.24]} dispose={null} />
      <mesh geometry={GEO.box} material={glassMat} scale={[0.26, 0.03, 0.16]} position={[0, 0.41, 0.24]} dispose={null} />
      {/* Precision alignment rails: orders arrive square or not at all. */}
      <mesh geometry={GEO.box} material={machinedMat} scale={[1.5, 0.04, 0.05]} position={[0, -0.56, 0.19]} dispose={null} />
      <mesh geometry={GEO.box} material={machinedMat} scale={[1.5, 0.04, 0.05]} position={[0, -0.56, -0.19]} dispose={null} />
      {/* Control cabinet on the approach side. */}
      <mesh geometry={GEO.box} material={panelMat} scale={[0.3, 0.66, 0.3]} position={[-0.88, -0.24, -0.42]} dispose={null} />
    </group>
  );
}

function PaymentBody({ r }: { r: StationRefs }) {
  return (
    <group>
      {/* Locked transaction core, inside a sealed chamber. */}
      <mesh geometry={GEO.box} material={shellMat} scale={[0.62, 0.72, 0.62]} dispose={null} />
      <mesh geometry={GEO.box} scale={[0.4, 0.44, 0.66]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
      {/* Chamber seal and its inspection port — access is controlled, not absent. */}
      <mesh geometry={GEO.box} material={sealMat} scale={[0.68, 0.78, 0.05]} position={[0, 0, 0.33]} dispose={null} />
      <mesh geometry={GEO.box} material={machinedMat} scale={[0.5, 0.5, 0.04]} position={[0, 0, 0.36]} dispose={null} />
      <mesh geometry={GEO.box} material={glassMat} scale={[0.3, 0.3, 0.02]} position={[0, 0, 0.39]} dispose={null} />
      {/* Verification ring spinning at processing tempo. */}
      <group ref={r.mech as React.RefObject<THREE.Group>}>
        <mesh geometry={GEO.torusThick} material={structuralMat} scale={[1.9, 1.9, 1.9]} rotation={[Math.PI / 2, 0, 0]} dispose={null} />
        <mesh geometry={GEO.box} material={trimMat} scale={[0.08, 0.08, 0.14]} position={[0.95, 0, 0]} dispose={null} />
      </group>
      {/* A second authentication layer, counter-rotating: two keys, not one. */}
      <group ref={r.mech2 as React.RefObject<THREE.Group>}>
        <mesh geometry={GEO.torus} material={machinedMat} scale={[1.44, 1.44, 1.44]} rotation={[Math.PI / 2, 0, 0]} dispose={null} />
        <mesh geometry={GEO.box} material={trimMat} scale={[0.06, 0.06, 0.1]} position={[-0.72, 0, 0]} dispose={null} />
      </group>
      {/* Dual authorisation blocks and their shielded supply. */}
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 0.9, 0.2]} position={[-0.55, -0.1, -0.5]} dispose={null} />
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 0.9, 0.2]} position={[0.55, -0.1, 0.5]} dispose={null} />
      <mesh geometry={GEO.cylinder8} material={polymerMat} scale={[0.1, 0.66, 0.1]} position={[-0.55, -0.6, -0.5]} dispose={null} />
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
      {/* Shelf plates the cells actually sit on. */}
      {[-0.35, -0.01, 0.33].map((y) => (
        <mesh key={y} geometry={GEO.box} material={machinedMat} scale={[1.1, 0.025, 0.16]} position={[0, y, 0.14]} dispose={null} />
      ))}
      {/* Inspection window — stock is meant to be countable from outside. */}
      <mesh geometry={GEO.box} material={glassMat} scale={[1.16, 1.1, 0.02]} position={[0, 0.05, 0.22]} dispose={null} />
      <mesh geometry={GEO.box} material={structuralMat} scale={[1.24, 0.05, 0.06]} position={[0, 0.62, 0.22]} dispose={null} />
      <mesh geometry={GEO.box} material={structuralMat} scale={[1.24, 0.05, 0.06]} position={[0, -0.52, 0.22]} dispose={null} />
      {/* Reserve bay: deliberately open and empty, so depletion has somewhere
          to be visible even when the lit cells are full. */}
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.42, 1.16, 0.44]} position={[0.92, 0.05, -0.2]} dispose={null} />
      <mesh geometry={GEO.box} material={panelMat} scale={[0.3, 0.9, 0.06]} position={[0.92, 0.05, 0.04]} dispose={null} />
      {/* Picking head on its vertical rail — it rides to the working shelf. */}
      <mesh geometry={GEO.box} material={machinedMat} scale={[0.05, 1.3, 0.05]} position={[-0.72, 0.05, 0.24]} dispose={null} />
      <group ref={r.mech2 as React.RefObject<THREE.Group>} position={[-0.72, 0.05, 0.24]}>
        <mesh geometry={GEO.box} material={machinedMat} scale={[0.16, 0.14, 0.16]} dispose={null} />
        <mesh geometry={GEO.box} material={polymerMat} scale={[0.2, 0.05, 0.08]} position={[0.1, -0.04, 0]} dispose={null} />
      </group>
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
      {/* Precision rails, top and bottom — the gantry runs on real ways. */}
      <mesh geometry={GEO.box} material={machinedMat} scale={[1.62, 0.06, 0.09]} position={[0, 0.62, 0.3]} dispose={null} />
      <mesh geometry={GEO.box} material={machinedMat} scale={[1.62, 0.05, 0.07]} position={[0, -0.42, 0.3]} dispose={null} />
      <mesh geometry={GEO.box} material={structuralMat} scale={[0.1, 1.12, 0.14]} position={[-0.8, 0.1, 0.3]} dispose={null} />
      <mesh geometry={GEO.box} material={structuralMat} scale={[0.1, 1.12, 0.14]} position={[0.8, 0.1, 0.3]} dispose={null} />
      {/* The picking gantry — its cycle is the station's real tempo. */}
      <group ref={r.mech as React.RefObject<THREE.Group>} position={[0, 0.28, 0.3]}>
        <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.16, 0.78, 0.14]} dispose={null} />
        <mesh geometry={GEO.box} material={machinedMat} scale={[0.2, 0.1, 0.18]} position={[0, 0.3, 0]} dispose={null} />
        <mesh geometry={GEO.box} material={polymerMat} scale={[0.24, 0.06, 0.2]} position={[0, -0.44, 0.02]} dispose={null} />
        <mesh geometry={GEO.box} scale={[0.22, 0.16, 0.18]} position={[0, -0.34, 0.02]}>
          <AccentMaterial refObj={r.accent} />
        </mesh>
      </group>
      {/* Calibration target and the inspection port that reads it. */}
      <mesh geometry={GEO.box} material={markingMat} scale={[0.16, 0.16, 0.02]} position={[0.62, -0.24, 0.24]} dispose={null} />
      <mesh geometry={GEO.box} material={glassMat} scale={[0.26, 0.34, 0.02]} position={[-0.58, 0.16, 0.24]} dispose={null} />
      {/* Tool holders on the chamber flank. */}
      {[-0.2, 0, 0.2].map((z) => (
        <mesh key={z} geometry={GEO.cylinder8} material={machinedMat} scale={[0.07, 0.3, 0.07]} position={[0.86, -0.18, z - 0.3]} dispose={null} />
      ))}
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
      {/* Outbound ramp with real rollers, and three route chutes fanning out. */}
      <mesh geometry={GEO.box} material={panelMat} scale={[0.9, 0.07, 0.8]} position={[0, -0.28, 0.5]} rotation={[0.24, 0, 0]} dispose={null} />
      {[-0.24, -0.06, 0.12, 0.3].map((z) => (
        <mesh
          key={z}
          geometry={GEO.cylinder8}
          material={polymerMat}
          scale={[0.07, 0.82, 0.07]}
          position={[0, -0.22 - z * 0.24, 0.36 + z]}
          rotation={[0, 0, Math.PI / 2]}
          dispose={null}
        />
      ))}
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
      {/* Routing gate: it actually swings to choose a lane. */}
      <group ref={r.mech as React.RefObject<THREE.Group>} position={[0, -0.16, 0.62]}>
        <mesh geometry={GEO.box} material={machinedMat} scale={[0.05, 0.3, 0.5]} position={[0, 0, 0.2]} dispose={null} />
      </group>
      {/* Route indicator lights above each chute. */}
      {[-0.52, 0, 0.52].map((x) => (
        <mesh key={x} geometry={GEO.box} material={trimMat} scale={[0.07, 0.03, 0.07]} position={[x, -0.16, 1.02]} dispose={null} />
      ))}
      {/* Bay door head. */}
      <mesh geometry={GEO.box} material={structuralMat} scale={[1.2, 0.12, 0.16]} position={[0, 0.44, 0.2]} dispose={null} />
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
      {/* Channel bank: the lines every other failure arrives down. */}
      {[-0.27, -0.09, 0.09, 0.27].map((z) => (
        <mesh key={z} geometry={GEO.box} material={panelMat} scale={[0.14, 0.34, 0.1]} position={[-0.72, 0.06, z]} dispose={null} />
      ))}
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 0.5, 0.78]} position={[-0.78, 0.06, 0]} dispose={null} />
      {/* Escalation column beside the reservoir — where it goes when it sticks. */}
      <mesh geometry={GEO.box} material={wornMat} scale={[0.16, 0.8, 0.16]} position={[0.46, 0.1, -0.66]} dispose={null} />
      {/* Unresolved-issue reservoir — fills with real open conversations. */}
      <mesh geometry={GEO.box} material={structuralDarkMat} scale={[0.2, 1.0, 0.2]} position={[0.66, 0.0, -0.4]} dispose={null} />
      <mesh geometry={GEO.box} material={glassMat} scale={[0.24, 1.0, 0.24]} position={[0.66, 0.0, -0.4]} dispose={null} />
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
      {/* Aggregation arms feeding the stack from three directions. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh
            key={i}
            geometry={GEO.box}
            material={machinedMat}
            scale={[0.62, 0.05, 0.09]}
            position={[Math.cos(a) * 0.95, -0.32, Math.sin(a) * 0.95]}
            rotation={[0, -a, 0]}
            dispose={null}
          />
        );
      })}
      {/* The reporting column, under glass. */}
      <mesh geometry={GEO.cylinder} scale={[0.5, 0.34, 0.5]} position={[0, 0.42, 0]}>
        <AccentMaterial refObj={r.accent} />
      </mesh>
      <mesh geometry={GEO.cylinder} material={glassMat} scale={[0.58, 0.42, 0.58]} position={[0, 0.42, 0]} dispose={null} />
      <mesh geometry={GEO.cylinder8} material={machinedMat} scale={[0.1, 0.72, 0.1]} position={[0, 0.9, 0]} dispose={null} />
      <mesh geometry={GEO.box} material={panelMat} scale={[0.5, 0.26, 0.05]} position={[0, 1.16, 0.06]} dispose={null} />
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
  const mech2Ref = useRef<THREE.Object3D>(null);
  const cellsRef = useRef<THREE.InstancedMesh>(null);
  const reservoirRef = useRef<THREE.Mesh>(null);
  const lampMat = useRef<THREE.MeshBasicMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const bracketRef = useRef<THREE.LineSegments>(null);
  const queueEl = useRef<HTMLSpanElement>(null);
  const capEl = useRef<HTMLSpanElement>(null);
  const loadEl = useRef<HTMLSpanElement>(null);
  const lastText = useRef({ queue: "", cap: "", load: "" });
  const mech = useRef<MechState>({ phase: 0, spin: 0, head: 0 });

  const refs: StationRefs = useMemo(
    () => ({
      accent: accentMat,
      mech: mechRef,
      mech2: mech2Ref,
      cells: cellsRef,
      reservoir: reservoirRef,
    }),
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
  // Stock cells sit behind glass and are lit from inside, so they read well
  // below the signal colour's full strength — a shelf with product on it, not
  // a light source.
  const cLit = useMemo(() => new THREE.Color("#2f7f96"), []);
  const cLow = useMemo(() => new THREE.Color("#8a6534"), []);
  const cDark = useMemo(() => new THREE.Color("#10151b"), []);

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
    //
    // Nothing here reads its position straight off the clock. Rotating parts
    // carry angular momentum and have to spin up and coast down; travelling
    // parts accelerate away, decelerate into the stop and then wait there.
    // That delay between demand and motion is most of what separates a
    // mechanism with mass from an animated one.
    if (!reduced) {
      const m = mech.current;
      const pace = 0.45 + stageState.energy * 0.75;
      const inertia = damp(1.15, delta);

      if (mechRef.current) {
        if (def.id === "payment") {
          m.spin += ((0.25 + activity * 2.2) * pace - m.spin) * inertia;
          mechRef.current.rotation.z += delta * m.spin;
        } else if (def.id === "fulfilment") {
          m.phase += delta * (0.16 + activity * 0.62) * pace;
          const travel = travelDwell(m.phase, 0.19);
          mechRef.current.position.x = (travel - 0.5) * 1.24;
          // The head dips to pick and lifts to carry.
          const held = travel > 0.995 || travel < 0.005 ? 1 : 0;
          mechRef.current.position.y = 0.28 - held * 0.12;
        } else if (def.id === "support") {
          m.spin += ((0.15 + activity * 1.1) * pace - m.spin) * inertia;
          mechRef.current.rotation.y += delta * m.spin;
        } else if (def.id === "revenue") {
          m.spin += (0.12 * pace - m.spin) * damp(0.5, delta);
          mechRef.current.rotation.y += delta * m.spin;
        } else if (def.id === "delivery") {
          m.phase += delta * (0.2 + activity * 0.5) * pace;
          mechRef.current.rotation.y = (travelDwell(m.phase, 0.3) - 0.5) * 0.9;
        }
      }

      // Second axes: the counter-rotating authorisation layer, and the picking
      // head that rides to whichever shelf is currently being worked.
      if (mech2Ref.current) {
        if (def.id === "payment") {
          mech2Ref.current.rotation.z -= delta * m.spin * 0.62;
        } else if (def.id === "inventory") {
          const level = THREE.MathUtils.clamp(sim.stock / 100, 0, 1);
          m.head += (level - m.head) * damp(1.6, delta);
          mech2Ref.current.position.y = 0.05 + (m.head - 0.5) * 0.68;
        }
      }

      // Machinery under load vibrates. Below the threshold of notice, and
      // absent when the station is idle — which is exactly the point.
      if (bodyRef.current) {
        const shake = activity * 0.0026;
        bodyRef.current.position.y = Math.sin(t * 46 + def.position[0]) * shake;
        bodyRef.current.position.x = Math.sin(t * 37 + def.position[2]) * shake * 0.6;
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

    // Live readout — imperative DOM updates, no React re-render. The label is
    // an instrument attached to the machine, so it carries the same three
    // numbers an operator would actually want: what it can take, what is
    // waiting, and how hard it is working. Load is spelled out in words as
    // well as coloured, so it never depends on colour to be read.
    const last = lastText.current;
    if (queueEl.current) {
      const text = node.queue >= 1 ? fmtInt(node.queue) : "CLEAR";
      if (text !== last.queue) {
        last.queue = text;
        queueEl.current.textContent = text;
        queueEl.current.dataset.status = node.status;
      }
    }
    if (capEl.current) {
      const text = `${Math.round(THREE.MathUtils.clamp(node.utilization, 0, 9.99) * 100)}%`;
      if (text !== last.cap) {
        last.cap = text;
        capEl.current.textContent = text;
      }
    }
    if (loadEl.current) {
      const text = STATUS_LABELS[node.status].toUpperCase();
      if (text !== last.load) {
        last.load = text;
        loadEl.current.textContent = text;
        loadEl.current.dataset.status = node.status;
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
        <group ref={bodyRef}>
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
            <span className="node-label-rows">
              <span className="node-label-row">
                <span className="node-label-key">CAP</span>
                <span ref={capEl} className="node-label-val" />
              </span>
              <span className="node-label-row">
                <span className="node-label-key">QUEUE</span>
                <span ref={queueEl} className="node-label-val" />
              </span>
              <span className="node-label-row">
                <span className="node-label-key">LOAD</span>
                <span ref={loadEl} className="node-label-val" />
              </span>
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
