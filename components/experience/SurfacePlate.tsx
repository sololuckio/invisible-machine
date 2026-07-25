"use client";

import { Edges, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, easeInOut, settle, smooth01, span } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { SURFACE_STAGES } from "@/lib/stage";
import { useUIStore } from "@/store/uiStore";
import { GEO, structuralDarkMat } from "./materials";

/**
 * Chapter 1's signature moment, staged as six deliberate beats:
 *
 *   A  stillness      the storefront reads as complete and calm
 *   B  instability    a fine tension runs the coming seam; light answers locally
 *   C  ignition       energy travels the seam with direction, end to end
 *   D  release        the halves load, break free, and open with mass
 *   E  depth          light spills up, dust lifts, the shaft reads by silhouette
 *   F  settle         the plates take up their stops and stop moving
 *
 * Chapter 8 plays the same instrument in reverse without being a reversed
 * animation: the halves close under their own weight, meet with a settle, and
 * leave the seam faintly lit — the machine is still down there.
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
/** Seam segments — enough that ignition reads as travel, not as a switch. */
const SEAM_SEGMENTS = 26;
const SEAM_HALF_LENGTH = 5.45;
/** Length of one seam segment, with a hairline gap so the run reads as built. */
const SEAM_SEG_LENGTH = ((SEAM_HALF_LENGTH * 2) / SEAM_SEGMENTS) * 0.82;
/** Where the halves come to rest when fully open (narrow screens open less). */
const SEPARATION = 5.2;
const SEPARATION_NARROW = 3.5;
/** Chapter position where the epilogue starts closing the surface. */
const CLOSE_FROM = 7.55;
const CLOSE_TO = 8.45;

/**
 * Separation travel with mass: the halves press together under load, break
 * free, accelerate through the middle of the move and settle onto their stops.
 */
function separationProfile(k: number): number {
  if (k <= 0) return 0;
  const load = -0.055 * Math.sin(Math.PI * clamp01(k / 0.14));
  // Double-eased: flat at both ends, quick through the middle — heavy things.
  const main = easeInOut(easeInOut(clamp01((k - 0.08) / 0.92)));
  const arrive = k > 0.9 ? settle((k - 0.9) * 1.6, 0.05, 7, 26) : 0;
  return Math.max(0, main + load + arrive);
}

/** The same weight, closing: momentum in, contact, one small settle. */
function closureProfile(k: number): number {
  const main = 1 - easeInOut(easeInOut(clamp01(k)));
  const impact = k > 0.88 ? settle((k - 0.88) * 2.2, 0.05, 8, 30) : 0;
  return Math.max(0, main + impact);
}

export function SurfacePlate() {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const tableauRef = useRef<THREE.Group>(null);
  const seamRef = useRef<THREE.InstancedMesh>(null);
  const seamLight = useRef<THREE.PointLight>(null);
  const productRef = useRef<THREE.Mesh>(null);
  const cutLeftMat = useRef<THREE.MeshBasicMaterial>(null);
  const cutRightMat = useRef<THREE.MeshBasicMaterial>(null);
  const wellRef = useRef<THREE.Group>(null);
  const wellMats = useRef<(THREE.MeshBasicMaterial | null)[]>([null, null]);
  const motesRef = useRef<THREE.InstancedMesh>(null);

  const size = useThree((s) => s.size);
  const moteDummy = useMemo(() => new THREE.Object3D(), []);
  const seamDummy = useMemo(() => new THREE.Object3D(), []);
  const seamColor = useMemo(() => new THREE.Color(), []);
  const cSignal = useMemo(() => new THREE.Color(PALETTE.signal), []);

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
    const ui = useUIStore.getState();
    const reduced = ui.reducedMotion;
    const quality = ui.quality;
    const cf = scrollState.chapterFloat;
    const t = state.clock.elapsedTime;
    // Portrait viewports open a shorter distance so the shaft mouth — not the
    // empty street either side of it — stays the subject, and the seam is
    // drawn heavier so it survives being a third of the width.
    const narrow = size.width / Math.max(1, size.height) < 0.9;
    const separation = narrow ? SEPARATION_NARROW : SEPARATION;
    const seamWeight = narrow ? 1.9 : 1;

    // ---- stage progress -------------------------------------------------
    const s = scrollState.surface;
    const closing = cf >= CLOSE_FROM;
    const closeK = closing ? span(cf, CLOSE_FROM, CLOSE_TO) : 0;

    // Tension builds through stillness and instability; ignition travels the
    // seam; release is the mechanical move itself.
    const tension = reduced ? 0 : span(s, 0.02, SURFACE_STAGES.ignition);
    const ignite = reduced ? 1 : span(s, SURFACE_STAGES.ignition - 0.02, SURFACE_STAGES.release + 0.08);
    const release = span(s, SURFACE_STAGES.release, SURFACE_STAGES.settled);

    let open: number;
    if (reduced) {
      open = closing ? 1 - closeK * 0.98 : 1;
    } else if (cf < 2) {
      open = separationProfile(release);
    } else if (!closing) {
      open = 1;
    } else {
      open = closureProfile(closeK);
    }

    // ---- the halves -----------------------------------------------------
    const shift = 4.25 + open * separation;
    // Structural response: the plates roll a little as they take the load,
    // then level out once they are carrying it.
    const roll = open * 0.05 + (!closing && release > 0 && release < 0.55 ? Math.sin(release * Math.PI * 1.8) * 0.014 : 0);
    const sink =
      smooth01(open * 2.2) * 0.16 +
      (!closing && release > 0.9 ? settle((release - 0.9) * 1.6, 0.035, 8, 24) : 0) +
      (closing && closeK > 0.88 ? settle((closeK - 0.88) * 2.2, 0.03, 8, 30) : 0);
    if (leftRef.current) {
      leftRef.current.position.x = -shift;
      leftRef.current.position.y = -sink;
      leftRef.current.rotation.z = roll;
    }
    if (rightRef.current) {
      rightRef.current.position.x = shift;
      rightRef.current.position.y = -sink;
      rightRef.current.rotation.z = -roll;
    }

    // ---- the tableau: a product, a customer, a transaction ---------------
    if (tableauRef.current) {
      const vis = reduced
        ? THREE.MathUtils.clamp(1.6 - cf * 0.4, 0, 1)
        : THREE.MathUtils.clamp(1 - open * 1.9, 0, 1);
      tableauRef.current.visible = vis > 0.01 && !closing;
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
      // Stage A is stillness: the one moving thing barely moves.
      productRef.current.rotation.y = t * 0.14;
    }

    // ---- the seam: instability, then directional ignition ----------------
    if (seamRef.current) {
      const fade = 1 - THREE.MathUtils.smoothstep(open, 0.22, 0.6);
      // Closing relights it from both ends and leaves a faint filament.
      const closeGlow = closing ? 0.28 + smooth01(closeK * 1.4) * 0.5 : 0;
      const visible = !reduced && (closeGlow > 0 || (cf < 2.4 && (tension > 0 || ignite > 0)));
      seamRef.current.visible = visible;
      if (visible) {
        // The ignition front runs the length of the cut, far end to near.
        const front = ignite * 1.18;
        const shimmer = 0.5 + 0.5 * Math.sin(t * 9);
        for (let k = 0; k < SEAM_SEGMENTS; k++) {
          const zNorm = k / (SEAM_SEGMENTS - 1);
          let level: number;
          if (closing) {
            // Symmetric, not identical: the filament re-lights from the middle.
            const mid = Math.abs(zNorm - 0.5) * 2;
            level = closeGlow * 0.5 * (0.55 + 0.45 * (1 - mid)) * (0.85 + shimmer * 0.15);
          } else {
            const lead = front - zNorm;
            // Bright at the travelling front, settling to a filament behind it.
            const passed = lead > 0 ? 0.14 + Math.exp(-lead * 5) * 0.5 : Math.max(0, 1 + lead * 22) * 0.5;
            // Before ignition the seam is only a rumour: a faint unstable line.
            const unstable = tension * (0.02 + 0.035 * shimmer) * (1 - ignite);
            level = Math.max(unstable, passed * ignite) * fade;
          }
          const z = (zNorm - 0.5) * SEAM_HALF_LENGTH * 2;
          seamDummy.position.set(0, 0.29, z);
          const width = 0.035 * seamWeight * (1 + open * 1.6);
          seamDummy.scale.set(level > 0.001 ? width : 0.0001, 0.05, SEAM_SEG_LENGTH);
          seamDummy.updateMatrix();
          seamRef.current.setMatrixAt(k, seamDummy.matrix);
          seamColor.copy(cSignal).multiplyScalar(THREE.MathUtils.clamp(level, 0, 1.4));
          seamRef.current.setColorAt(k, seamColor);
        }
        seamRef.current.instanceMatrix.needsUpdate = true;
        if (seamRef.current.instanceColor) seamRef.current.instanceColor.needsUpdate = true;
      }
    }

    // Local lighting response — the surface itself is lit by what is beneath.
    if (seamLight.current) {
      const igniteLight = !reduced && cf < 2.4 ? (tension * 0.25 + ignite * 1) * (1 - smooth01((open - 0.4) * 2)) : 0;
      const closeLight = closing ? smooth01(closeK * 1.3) * 0.7 * (1 - closeK * 0.4) : 0;
      seamLight.current.intensity = Math.max(igniteLight, closeLight) * 9;
    }

    // ---- freshly cut faces catch the light from below --------------------
    const cutGlow = closing
      ? smooth01(closeK * 1.6) * (1 - smooth01((closeK - 0.8) * 4)) * 0.7
      : smooth01(open * 1.6) * (1 - smooth01((open - 0.75) * 4)) * 0.85;
    if (cutLeftMat.current) cutLeftMat.current.opacity = cutGlow;
    if (cutRightMat.current) cutRightMat.current.opacity = cutGlow;

    // ---- the light well breathing out of the opening ---------------------
    const wellStrength = reduced
      ? 0
      : closing
        ? // Operational light still visible below, right up until contact.
          smooth01(closeK * 2.6) * (1 - smooth01((closeK - 0.62) * 3.2)) * 0.34
        : smooth01(open * 1.8) * (1 - smooth01((open - 0.55) * 2.4)) * 0.4;
    if (wellRef.current) wellRef.current.visible = wellStrength > 0.01;
    for (const m of wellMats.current) {
      if (m) m.opacity = wellStrength;
    }

    // ---- dust in the light column ----------------------------------------
    if (motesRef.current) {
      const show =
        !reduced &&
        quality !== "reduced" &&
        open > 0.12 &&
        (closing ? closeK < 0.8 : cf < 2.6);
      motesRef.current.visible = show;
      if (show) {
        const width = open * separation;
        for (let k = 0; k < MOTES; k++) {
          const seed = k * 0.618033;
          const cycle = (t * (0.055 + (seed % 0.05)) + seed) % 1;
          // Opening lifts the dust; closing lets it fall back down.
          const rise = closing ? 4.6 - cycle * 4.6 : cycle * 4.6;
          moteDummy.position.set(
            (fractOf(seed * 7.13) - 0.5) * width * 1.6,
            -0.4 + rise,
            (fractOf(seed * 3.77) - 0.5) * 8,
          );
          const sz = 0.02 + (1 - cycle) * 0.025;
          moteDummy.scale.setScalar(sz * smooth01(open * 3));
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

      {/* The seam, in segments, so ignition can travel instead of switching on. */}
      <instancedMesh ref={seamRef} args={[GEO.box, undefined, SEAM_SEGMENTS]} visible={false} frustumCulled={false}>
        <meshBasicMaterial
          color={PALETTE.signal}
          transparent
          opacity={0.6}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* The surface's own light source: whatever is happening underneath. It
          sits just below the cut so it grazes the plate edges rather than
          washing their faces. */}
      <pointLight ref={seamLight} position={[0, -0.15, 0]} intensity={0} distance={13} color={PALETTE.signal} />

      {/* Light spilling up out of the cut — two crossed gradient planes. */}
      <group ref={wellRef} visible={false}>
        {[0, 1].map((k) => (
          <mesh
            key={k}
            position={[0, 2.0, 0]}
            rotation={[0, k === 0 ? 0 : Math.PI / 2, 0]}
          >
            <planeGeometry args={[k === 0 ? 7.2 : 8.0, 3.4]} />
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

      {/* Motes drifting in the light column. */}
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
