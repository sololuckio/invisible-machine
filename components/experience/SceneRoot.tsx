"use client";

import { Canvas } from "@react-three/fiber";
import { PALETTE } from "@/lib/palette";
import { QUALITY_PROFILES } from "@/lib/quality";
import { NODE_DEFS } from "@/simulation/nodes";
import { useUIStore } from "@/store/uiStore";
import { CameraRig } from "./CameraRig";
import { MachineEnvironment } from "./MachineEnvironment";
import { OrderParticles } from "./OrderParticles";
import { Pathways } from "./Pathways";
import { QueueMarkers } from "./QueueMarkers";
import { ScanEffects } from "./ScanEffects";
import { StationNode } from "./StationNode";
import { SurfacePlate } from "./SurfacePlate";

/**
 * The full 3D machine. Loaded lazily so the opening copy never waits for
 * the three.js bundle; quality tier controls resolution and particle load.
 */
export default function SceneRoot() {
  const quality = useUIStore((s) => s.quality);
  const setWebglOk = useUIStore((s) => s.setWebglOk);
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
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => {
            e.preventDefault();
            setWebglOk(false);
          },
          { once: true },
        );
      }}
    >
      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 14, 48]} />

      <MachineEnvironment detailed={profile.environment && revealed} />
      <SurfacePlate />
      <group visible={revealed}>
        {NODE_DEFS.map((def) => (
          <StationNode key={def.id} def={def} revealed={revealed} />
        ))}
        <Pathways />
        <OrderParticles key={`pool-${profile.particles}`} pool={profile.particles} />
        <QueueMarkers key={`queue-${profile.queueDots}`} maxPerNode={profile.queueDots} />
        <ScanEffects />
      </group>
      <CameraRig />
    </Canvas>
  );
}
