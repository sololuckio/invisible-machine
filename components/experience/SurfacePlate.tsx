"use client";

import { Edges, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { useUIStore } from "@/store/uiStore";

/**
 * Chapter 1's signature moment: the calm storefront slab that splits apart
 * to reveal the machine shaft below. On top sits the "simple" business —
 * a product, a customer, a transaction — which dissolves as the surface opens.
 * In Chapter 8 the halves glide back together, closing the loop.
 */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

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

export function SurfacePlate() {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const tableauRef = useRef<THREE.Group>(null);
  const seamRef = useRef<THREE.Mesh>(null);
  const seamMat = useRef<THREE.MeshBasicMaterial>(null);
  const productRef = useRef<THREE.Mesh>(null);

  const topTexture = useMemo(makeSurfaceTexture, []);
  const trianglePts = useMemo(
    () =>
      [
        [0, 0.46, 0.7],
        [-1.35, 0.46, -0.75],
        [1.4, 0.46, -0.65],
        [0, 0.46, 0.7],
      ] as [number, number, number][],
    [],
  );

  useFrame((state) => {
    const reduced = useUIStore.getState().reducedMotion;
    const cf = scrollState.chapterFloat;

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

    // Halves rest exactly touching (half-width 4.25), then slide apart.
    const shift = 4.25 + open * 5.2;
    const tilt = open * 0.05;
    if (leftRef.current) {
      leftRef.current.position.x = -shift;
      leftRef.current.rotation.z = tilt;
    }
    if (rightRef.current) {
      rightRef.current.position.x = shift;
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
      productRef.current.rotation.y = state.clock.elapsedTime * 0.35;
    }

    // Seam: a thin line that ignites as the split begins, then hands the
    // stage to the opening itself.
    if (seamMat.current && seamRef.current) {
      const ignite = THREE.MathUtils.clamp(open / 0.1, 0, 1);
      const fade = 1 - THREE.MathUtils.smoothstep(open, 0.25, 0.65);
      seamMat.current.opacity = reduced ? 0 : ignite * fade * 0.9;
      seamRef.current.scale.x = 1 + open * 2.2;
    }
  });

  return (
    <group>
      {/* The two halves of the storefront slab */}
      {[leftRef, rightRef].map((ref, i) => (
        <group key={i} ref={ref} position={[i === 0 ? -4.25 : 4.25, 0, 0]}>
          <mesh>
            <boxGeometry args={[8.5, 0.5, 11]} />
            <meshStandardMaterial
              color="#1c2129"
              metalness={0.7}
              roughness={0.42}
              map={topTexture ?? undefined}
            />
          </mesh>
          <Edges scale={1.001} color={PALETTE.structure} />
        </group>
      ))}

      {/* The glowing seam where the machine first shows through */}
      <mesh ref={seamRef} position={[0, 0.27, 0]}>
        <boxGeometry args={[0.06, 0.05, 10.9]} />
        <meshBasicMaterial
          ref={seamMat}
          color={PALETTE.signal}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>

      {/* A product. A customer. A transaction. */}
      <group ref={tableauRef} position={[0, 0.3, 0]}>
        <mesh ref={productRef} position={[0, 0.62, 0.7]}>
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
        <mesh position={[-1.35, 0.52, -0.75]}>
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
        <mesh position={[1.4, 0.5, -0.65]} rotation={[Math.PI / 2, 0, 0]}>
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
