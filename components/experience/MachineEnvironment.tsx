"use client";

import { Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/palette";
import { NODE_DEFS } from "@/simulation/nodes";
import { GEO, structuralDarkMat, structuralMat, trimMat } from "./materials";

/**
 * The shaft the machine lives in: an architectural well of graphite columns,
 * ring beams at each station level and a service floor far below. Lighting is
 * a deliberate hierarchy — soft hemispheric fill so nothing dies into black,
 * one cool key, a low warm counter-light, and local signal light mid-shaft —
 * so stations keep readable silhouettes even when idle.
 */

const SHAFT_R = 8.6;
const TOP = 0.4;
const BOTTOM = -21.8;

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
        pos: [Math.cos(a) * SHAFT_R, (TOP + BOTTOM) / 2, Math.sin(a) * SHAFT_R],
        rotY: -a,
      });
    }
    // A ring beam at each station's working depth ties levels together.
    const beltYs = Array.from(new Set(NODE_DEFS.map((n) => n.position[1] - 0.75)));
    return { columns, beltYs };
  }, []);
}

export function MachineEnvironment({ detailed }: { detailed: boolean }) {
  const { columns, beltYs } = useShaftLayout();

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
      {/* Lighting hierarchy — floor, fill, key, counter, local. */}
      <ambientLight intensity={0.3} color="#3c4450" />
      <hemisphereLight args={["#48566a", "#0a0d12", 1.15]} />
      <directionalLight position={[6, 10, 7]} intensity={1.7} color="#e4ecff" />
      <directionalLight position={[-8, -6, -5]} intensity={0.6} color="#3d5c6e" />
      <pointLight position={[0, -8, 5]} intensity={40} distance={28} color={PALETTE.signal} />
      <pointLight position={[0, -19.4, 3]} intensity={18} distance={16} color={PALETTE.warn} />

      {detailed && (
        <>
          {/* Structural columns with a permanent hairline of trim light. */}
          {columns.map((c, i) => (
            <group key={i} position={c.pos} rotation={[0, c.rotY, 0]}>
              <mesh
                geometry={GEO.box}
                material={structuralMat}
                scale={[0.34, TOP - BOTTOM, 0.5]}
                dispose={null}
              />
              <mesh
                geometry={GEO.box}
                material={structuralDarkMat}
                scale={[0.5, TOP - BOTTOM, 0.22]}
                position={[0, 0, -0.18]}
                dispose={null}
              />
              <mesh
                geometry={GEO.box}
                material={trimMat}
                scale={[0.04, TOP - BOTTOM, 0.04]}
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

          {/* Service floor. */}
          <mesh
            geometry={GEO.cylinder}
            material={structuralDarkMat}
            position={[0, BOTTOM - 0.65, 0]}
            scale={[SHAFT_R * 2.35, 0.5, SHAFT_R * 2.35]}
            dispose={null}
          />
          <Grid
            position={[0, BOTTOM - 0.38, 0]}
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
