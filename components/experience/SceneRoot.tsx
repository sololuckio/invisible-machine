"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type * as THREE from "three";
import { damp } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { QUALITY_PROFILES } from "@/lib/quality";
import { scrollState } from "@/lib/scrollState";
import { NODE_DEFS } from "@/simulation/nodes";
import { useUIStore } from "@/store/uiStore";
import { CameraRig } from "./CameraRig";
import { HeroOrder } from "./HeroOrder";
import { MachineEnvironment } from "./MachineEnvironment";
import { OrderParticles } from "./OrderParticles";
import { Pathways } from "./Pathways";
import { QueueMarkers } from "./QueueMarkers";
import { ScanEffects } from "./ScanEffects";
import { StationNode } from "./StationNode";
import { SurfacePlate } from "./SurfacePlate";

/**
 * Distinguishes a genuine GPU context loss from R3F's deliberate
 * force-context-loss during canvas disposal: the effect cleanup removes the
 * listener before R3F tears the renderer down, so switching to the diagram
 * view never registers as a device failure.
 */
function ContextGuard() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      useUIStore.getState().reportSceneFailure();
    };
    el.addEventListener("webglcontextlost", onLost);
    useUIStore.getState().markSceneReady();
    return () => el.removeEventListener("webglcontextlost", onLost);
  }, [gl]);
  return null;
}

/** Fog depth per chapter — atmosphere as composition, not as an effect. */
const DEPTH: { at: number; near: number; far: number }[] = [
  // Chapter 1: the street reads shallow; whatever is below is only implied.
  { at: 2, near: 12, far: 34 },
  // Chapter 2: descending through haze — the machine arrives as silhouette.
  { at: 3, near: 10, far: 32 },
  // Working chapters: clear enough to read instruments.
  { at: 6, near: 14, far: 48 },
  // Chapter 6–7: wide, air between the layers.
  { at: 7.5, near: 18, far: 64 },
  // The closure: depth returns, the machine recedes into it.
  { at: 9, near: 12, far: 38 },
];

/**
 * Atmospheric perspective, animated per chapter. Fog near/far are plain
 * uniforms, so this costs nothing and buys layered depth: foreground
 * architecture, midground machine, background shaft.
 */
function DepthDirector() {
  const scene = useThree((s) => s.scene);
  useFrame((_, delta) => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    if (useUIStore.getState().reducedMotion) {
      fog.near = 14;
      fog.far = 48;
      return;
    }
    const cf = scrollState.chapterFloat;
    const key = DEPTH.find((d) => cf < d.at) ?? DEPTH[DEPTH.length - 1];
    const k = damp(1.1, delta);
    fog.near += (key.near - fog.near) * k;
    fog.far += (key.far - fog.far) * k;
  });
  return null;
}

/**
 * The full 3D machine. Loaded lazily so the opening copy never waits for
 * the three.js bundle; quality tier controls resolution and particle load.
 */
export default function SceneRoot() {
  const quality = useUIStore((s) => s.quality);
  // Chapter 1's promise: nothing below the surface exists until it opens.
  const revealed = useUIStore(
    (s) => s.surfaceOpen || s.labOpen || s.reducedMotion || s.activeChapter >= 2,
  );
  const profile = QUALITY_PROFILES[quality];

  return (
    <Canvas
      dpr={profile.dpr}
      camera={{ position: [0, 2.6, 10.5], fov: 50, near: 0.5, far: 80 }}
      gl={{
        antialias: profile.antialias,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
      }}
      frameloop="always"
      onCreated={({ gl }) => {
        // A touch of exposure headroom — ACES otherwise crushes the graphite.
        gl.toneMappingExposure = 1.2;
      }}
    >
      <ContextGuard />
      <DepthDirector />
      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 14, 48]} />

      <MachineEnvironment detailed={profile.environment && revealed} />
      <SurfacePlate />
      <group visible={revealed}>
        {NODE_DEFS.map((def) => (
          <StationNode key={def.id} def={def} revealed={revealed} />
        ))}
        <Pathways />
        <HeroOrder />
        <OrderParticles key={`pool-${profile.particles}`} pool={profile.particles} />
        <QueueMarkers key={`queue-${profile.queueDots}`} maxPerNode={profile.queueDots} />
        <ScanEffects />
      </group>
      <CameraRig />
    </Canvas>
  );
}
