"use client";

import { Edges, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeInOut, smooth01 } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { useUIStore } from "@/store/uiStore";
import { GEO, structuralDarkMat } from "./materials";

/**
 * Chapter 1's signature moment, staged in phases: the calm storefront slab;
 * a faint instability along the coming seam; ignition; mechanical separation
 * with the halves sinking slightly under their own weight; light spilling up
 * out of the cut; and a column of slow motes rising where the machine
 * breathes out. In Chapter 8 the halves glide back together, closing the loop.
 */

/** Procedural top texture: fine technical grid on brushed near-black. */
function makeSurfaceTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#101318";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(110, 231, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(232, 234, 237, 0.09)";
  ctx.strokeRect(16, 16, 480, 480);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Vertical light-well gradient: bright at the cut, dissolving upward.
 * Used as a colour map under additive blending — black adds nothing, so the
 * plane itself can never read as a solid quad.
 */
function makeWellTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, "rgb(210,210,210)");
  g.addColorStop(0.4, "rgb(52,52,52)");
  g.addColorStop(1, "rgb(0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  return new THREE.CanvasTexture(c);
}

const MOTES = 22;

export function SurfacePlate() {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const tableauRef = useRef<THREE.Group>(null);
  const seamRef = useRef<THREE.Mesh>(null);
  const seamMat = useRef<THREE.MeshBasicMaterial>(null);
  const productRef = useRef<THREE.Mesh>(null);
  const cutLeftMat = useRef<THREE.MeshBasicMaterial>(null);
  const cutRightMat = useRef<THREE.MeshBasicMaterial>(null);
  const wellRef = useRef<THREE.Group>(null);
  const wellMats = useRef<(THREE.MeshBasicMaterial | null)[]>([null, null]);
  const motesRef = useRef<THREE.InstancedMesh>(null);
  const moteDummy = useMemo(() => new THREE.Object3D(), []);

  const topTexture = useMemo(makeSurfaceTexture, []);
  const wellTexture = useMemo(makeWellTexture, []);
  const trianglePts = useMemo(
    () =>
      [
        [0, 0.5, 0.7],
        [-1.35, 0.5, -0.75],
        [1.4, 0.5, -0.65],
        [0, 0.5, 0.7],
      ] as [number, number, number][],
    [],
  );

  useFrame((state) => {
    const reduced = useUIStore.getState().reducedMotion;
    const quality = useUIStore.getState().quality;
    const cf = scrollState.chapterFloat;
    const t = state.clock.elapsedTime;

    // How far the surface is open: scripted by chapter position.
    let open: number;
    if (reduced) {
      open = 1;
    } else if (cf < 2) {
      open = easeInOut(THREE.MathUtils.clamp(scrollState.surface * 1.25, 0, 1));
    } else if (cf < 7.45) {
      open = 1;
    } else {
      // Epilogue: the halves glide back, leaving only the glowing seam.
      open = 1 - THREE.MathUtils.clamp((cf - 7.45) / 0.5, 0, 0.9);
    }

    // Halves rest exactly touching (half-width 4.25), separate mechanically,
    // and sink a breath under their own weight as they release.
    const shift = 4.25 + open * 5.2;
    const tilt = open * 0.065;
    const sink = smooth01(open * 2.2) * 0.16;
    if (leftRef.current) {
      leftRef.current.position.x = -shift;
      leftRef.current.position.y = -sink;
      leftRef.current.rotation.z = tilt;
    }
    if (rightRef.current) {
      rightRef.current.position.x = shift;
      rightRef.current.position.y = -sink;
      rightRef.current.rotation.z = -tilt;
    }

    // The "simple business" tableau dissolves as the truth opens up.
    if (tableauRef.current) {
      const vis = reduced
        ? THREE.MathUtils.clamp(1.6 - cf * 0.4, 0, 1)
        : THREE.MathUtils.clamp(1 - open * 1.9, 0, 1);
      tableauRef.current.visible = vis > 0.01;
      tableauRef.current.scale.setScalar(Math.max(0.001, 0.7 + vis * 0.3));
      tableauRef.current.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (mat && "opacity" in mat) {
          mat.opacity = vis;
        }
      });
    }
    if (productRef.current && !reduced) {
      productRef.current.rotation.y = t * 0.35;
    }

    // Seam: faint instability first, then ignition, then it hands the stage
    // to the opening itself.
    if (seamMat.current && seamRef.current) {
      const instability =
        scrollState.surface > 0.015 && open < 0.02 && !reduced
          ? (0.5 + 0.5 * Math.sin(t * 11)) * smooth01(scrollState.surface / 0.06) * 0.35
          : 0;
      const ignite = THREE.MathUtils.clamp(open / 0.1, 0, 1);
      const fade = 1 - THREE.MathUtils.smoothstep(open, 0.25, 0.65);
      seamMat.current.opacity = reduced ? 0 : Math.max(instability, ignite * fade * 0.9);
      seamRef.current.scale.x = 1 + open * 2.2;
    }

    // Freshly cut faces glow with the light from below.
    const cutGlow = smooth01(open * 1.6) * (1 - smooth01((open - 0.75) * 4)) * 0.85;
    if (cutLeftMat.current) cutLeftMat.current.opacity = cutGlow;
    if (cutRightMat.current) cutRightMat.current.opacity = cutGlow;

    // The light well breathes out of the opening, strongest mid-split,
    // then hands the stage to the machine below.
    const wellStrength = reduced
      ? 0
      : smooth01(open * 1.8) * (1 - smooth01((open - 0.55) * 2.4)) * 0.8;
    if (wellRef.current) wellRef.current.visible = wellStrength > 0.01;
    for (const m of wellMats.current) {
      if (m) m.opacity = wellStrength;
    }

    // Motes rising in the light column.
    if (motesRef.current) {
      const show = !reduced && quality !== "reduced" && open > 0.2 && cf < 2.6;
      motesRef.current.visible = show;
      if (show) {
        const width = open * 5.2;
        for (let k = 0; k < MOTES; k++) {
          const seed = k * 0.618033;
          const cycle = (t * (0.055 + (seed % 0.05)) + seed) % 1;
          moteDummy.position.set(
            (fractOf(seed * 7.13) - 0.5) * width * 1.6,
            -0.4 + cycle * 4.6,
            (fractOf(seed * 3.77) - 0.5) * 8,
          );
          const s = 0.02 + (1 - cycle) * 0.025;
          moteDummy.scale.setScalar(s * smooth01(open * 3));
          moteDummy.rotation.set(0, seed * 6.28 + t * 0.2, 0);
          moteDummy.updateMatrix();
          motesRef.current.setMatrixAt(k, moteDummy.matrix);
        }
        motesRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* The two halves of the storefront slab — layered street-level mass. */}
      {[leftRef, rightRef].map((ref, i) => {
        const inner = i === 0 ? 4.25 : -4.25;
        return (
          <group key={i} ref={ref} position={[i === 0 ? -4.25 : 4.25, 0, 0]}>
            <mesh>
              <boxGeometry args={[8.5, 0.55, 11]} />
              <meshStandardMaterial
                color="#1c2129"
                metalness={0.7}
                roughness={0.42}
                map={topTexture ?? undefined}
              />
            </mesh>
            {/* Under-slab lip: the plate has depth, not just a face. */}
            <mesh geometry={GEO.box} material={structuralDarkMat} scale={[8.2, 0.3, 10.7]} position={[0, -0.4, 0]} dispose={null} />
            {/* The freshly cut inner face catches the light from below. */}
            <mesh position={[inner, -0.05, 0]}>
              <boxGeometry args={[0.03, 0.5, 10.9]} />
              <meshBasicMaterial
                ref={i === 0 ? cutLeftMat : cutRightMat}
                color={PALETTE.signal}
                transparent
                opacity={0}
                toneMapped={false}
              />
            </mesh>
            <Edges scale={1.001} color={PALETTE.structure} />
          </group>
        );
      })}

      {/* The glowing seam where the machine first shows through */}
      <mesh ref={seamRef} position={[0, 0.29, 0]}>
        <boxGeometry args={[0.06, 0.05, 10.9]} />
        <meshBasicMaterial
          ref={seamMat}
          color={PALETTE.signal}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>

      {/* Light spilling up out of the cut — two crossed gradient planes. */}
      <group ref={wellRef} visible={false}>
        {[0, 1].map((k) => (
          <mesh
            key={k}
            position={[0, 2.0, 0]}
            rotation={[0, k === 0 ? 0 : Math.PI / 2, 0]}
          >
            <planeGeometry args={[k === 0 ? 9.5 : 10.4, 4.6]} />
            <meshBasicMaterial
              ref={(m) => {
                wellMats.current[k] = m;
              }}
              color={PALETTE.signal}
              transparent
              opacity={0}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              map={wellTexture ?? undefined}
            />
          </mesh>
        ))}
      </group>

      {/* Motes drifting up in the light column. */}
      <instancedMesh ref={motesRef} args={[GEO.octa, undefined, MOTES]} visible={false} frustumCulled={false}>
        <meshBasicMaterial color={PALETTE.signal} transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </instancedMesh>

      {/* A product. A customer. A transaction. */}
      <group ref={tableauRef} position={[0, 0.32, 0]}>
        <mesh geometry={GEO.cylinder} material={structuralDarkMat} scale={[0.7, 0.16, 0.7]} position={[0, 0.36, 0.7]} dispose={null} />
        <mesh ref={productRef} position={[0, 0.72, 0.7]}>
          <boxGeometry args={[0.46, 0.46, 0.46]} />
          <meshStandardMaterial
            color="#e8eaed"
            metalness={0.4}
            roughness={0.25}
            transparent
            emissive="#3a4048"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[-1.35, 0.56, -0.75]}>
          <sphereGeometry args={[0.21, 24, 24]} />
          <meshStandardMaterial
            color={PALETTE.signal}
            metalness={0.2}
            roughness={0.35}
            transparent
            emissive={PALETTE.signalDeep}
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh position={[1.4, 0.54, -0.65]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.06, 28]} />
          <meshStandardMaterial
            color={PALETTE.hero}
            metalness={0.85}
            roughness={0.3}
            transparent
            emissive="#4a3d24"
            emissiveIntensity={0.5}
          />
        </mesh>
        <Line
          points={trianglePts}
          color={PALETTE.structure}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      </group>
    </group>
  );
}

function fractOf(v: number): number {
  return v - Math.floor(v);
}
