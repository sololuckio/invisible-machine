"use client";

import { Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/palette";

/**
 * The shaft: a cage of fine technical lines descending from the surface,
 * ring datums marking depth, and a floor grid far below. Structure, not
 * decoration — it gives the descent scale and verticality.
 */
export function MachineEnvironment({ detailed }: { detailed: boolean }) {
  const cage = useMemo(() => {
    const pts: number[] = [];
    const R = 8.6;
    const TOP = 0.4;
    const BOTTOM = -21.8;
    // Vertical hairlines, with a gap left at the camera's usual approach side.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.5) continue;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      pts.push(x, TOP, z, x, BOTTOM, z);
    }
    // Depth datum rings.
    for (const y of [-3.4, -8.8, -14.2, -19.6]) {
      const seg = 48;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        pts.push(Math.cos(a0) * R, y, Math.sin(a0) * R, Math.cos(a1) * R, y, Math.sin(a1) * R);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  return (
    <group>
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 7, 6]} intensity={1.0} />
      <pointLight position={[0, -8, 5]} intensity={40} distance={26} color={PALETTE.signal} />
      <pointLight position={[0, -19, 3]} intensity={22} distance={18} color={PALETTE.warn} />

      {detailed && (
        <>
          <lineSegments geometry={cage}>
            <lineBasicMaterial color={PALETTE.structureFaint} transparent opacity={0.55} />
          </lineSegments>
          <Grid
            position={[0, -22.3, 0]}
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
