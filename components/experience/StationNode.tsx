"use client";

import { Edges, Html, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { fmtInt } from "@/lib/format";
import { PALETTE, STATUS_COLORS } from "@/lib/palette";
import type { NodeDef } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";

/**
 * One station of the machine. Geometry is procedural and typed:
 * flow stages are processing chambers, inventory is a silo with a live
 * stock gauge, support is a service bay, revenue is the ledger slab.
 * A shader ring around the base fills with utilisation and overflows red.
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

export function StationNode({ def, revealed }: { def: NodeDef; revealed: boolean }) {
  const selected = useUIStore((s) => s.selectedNode === def.id);
  const selectNode = useUIStore((s) => s.selectNode);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const stockBar = useRef<THREE.Mesh>(null);
  const stockMat = useRef<THREE.MeshBasicMaterial>(null);
  const bracketRef = useRef<THREE.LineSegments>(null);
  const queueEl = useRef<HTMLSpanElement>(null);
  const lastQueueText = useRef("");

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
  const brackets = useMemo(() => bracketGeometry(1.05), []);
  const statusColor = useMemo(() => new THREE.Color(STATUS_COLORS.idle), []);
  const targetColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const sim = useSimStore.getState().sim;
    const node = sim.nodes[def.id];
    const t = state.clock.elapsedTime;
    const reduced = useUIStore.getState().reducedMotion;

    // Utilisation ring: fill 0..1, overflow blends the fill toward danger.
    ringUniforms.uFill.value = THREE.MathUtils.clamp(node.utilization, 0, 1);
    ringUniforms.uOverflow.value = THREE.MathUtils.clamp((node.utilization - 1) / 1.5, 0, 1);

    // Core: colour follows status, pulse follows real throughput.
    targetColor.set(STATUS_COLORS[node.status]);
    statusColor.lerp(targetColor, Math.min(1, delta * 3));
    if (coreMat.current) {
      coreMat.current.emissive.copy(statusColor);
      const activity = THREE.MathUtils.clamp(node.throughput / Math.max(node.capacity, 1), 0, 1);
      const flicker =
        node.status === "critical" && !reduced ? 0.35 * Math.sin(t * 7 + def.position[0]) : 0;
      // The AI scan plane lights each station as it passes.
      const scanGlow =
        fxBus.scanY !== null
          ? Math.max(0, 1 - Math.abs(fxBus.scanY - def.position[1]) / 1.3) * 1.4
          : 0;
      coreMat.current.emissiveIntensity = 0.35 + activity * 0.85 + flicker + scanGlow;
    }
    if (coreMesh.current && !reduced) {
      const activity = THREE.MathUtils.clamp(node.throughput / Math.max(node.capacity, 1), 0, 1);
      const pulse = 1 + 0.06 * activity * Math.sin(t * (2 + activity * 3) + def.position[1]);
      coreMesh.current.scale.setScalar(pulse);
    }

    // Recommendation pop: the targeted station visibly expands, then settles.
    if (groupRef.current) {
      let scale = 1;
      if (fxBus.popNode === def.id) {
        const age = (performance.now() - fxBus.popAt) / 1000;
        if (age < 1.4) {
          scale = 1 + Math.exp(-age * 3.2) * Math.sin(age * 9) * 0.16 + Math.exp(-age * 2.5) * 0.1;
        }
      }
      groupRef.current.scale.setScalar(scale);
    }

    // Inventory stock gauge.
    if (stockBar.current && stockMat.current) {
      const level = THREE.MathUtils.clamp(sim.stock / 100, 0.02, 1);
      stockBar.current.scale.y = level;
      stockBar.current.position.y = -0.55 + level * 0.55;
      stockMat.current.color.set(
        sim.stock < 20 ? PALETTE.danger : sim.stock < 45 ? PALETTE.warn : PALETTE.signal,
      );
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

  const core = (() => {
    switch (def.type) {
      case "stock":
        return <cylinderGeometry args={[0.42, 0.5, 0.9, 12]} />;
      case "service":
        return <boxGeometry args={[0.7, 0.62, 0.7]} />;
      case "sink":
        return <boxGeometry args={[1.15, 0.28, 1.15]} />;
      default:
        return <boxGeometry args={[0.78, 0.62, 0.78]} />;
    }
  })();

  const frame = (() => {
    switch (def.type) {
      case "stock":
        return <cylinderGeometry args={[0.62, 0.68, 1.25, 12]} />;
      case "service":
        return <boxGeometry args={[1.0, 0.95, 1.0]} />;
      case "sink":
        return <boxGeometry args={[1.55, 0.5, 1.55]} />;
      default:
        return <boxGeometry args={[1.15, 0.95, 1.15]} />;
    }
  })();

  return (
    <group position={def.position}>
      <group ref={groupRef}>
        {/* Outer chamber frame */}
        <mesh>
          {frame}
          <meshStandardMaterial
            color="#10141b"
            metalness={0.85}
            roughness={0.45}
            transparent
            opacity={0.42}
          />
        </mesh>
        <mesh>
          {frame}
          <Edges color={PALETTE.structure} />
        </mesh>

        {/* Processing core */}
        <mesh ref={coreMesh}>
          {core}
          <meshStandardMaterial
            ref={coreMat}
            color="#1a1e24"
            metalness={0.6}
            roughness={0.3}
            emissive={PALETTE.signal}
            emissiveIntensity={0.4}
          />
        </mesh>

        {/* Inventory's stock gauge */}
        {def.id === "inventory" && (
          <mesh ref={stockBar} position={[0.85, 0, 0]}>
            <boxGeometry args={[0.09, 1.1, 0.09]} />
            <meshBasicMaterial ref={stockMat} color={PALETTE.signal} toneMapped={false} />
          </mesh>
        )}

        {/* Utilisation ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
          <ringGeometry args={[0.78, 0.9, 64]} />
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
        <lineSegments ref={bracketRef} geometry={brackets} visible={false}>
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
          <sphereGeometry args={[1.05, 12, 12]} />
        </mesh>
      </group>

      {/* Technical label — mounted only once the machine is unveiled,
          because drei's Html lives in the DOM, not the WebGL scene graph. */}
      {revealed && (
        <Html
          position={[0, 1.05, 0]}
          center
          distanceFactor={11}
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
