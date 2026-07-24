"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { TIMING } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { useSimStore } from "@/store/simStore";
import { BYPASS_SEGMENT, FLOW_SEGMENTS, SUPPORT_SEGMENTS, type Segment } from "./curves";
import { structuralDarkMat } from "./materials";

/**
 * Conveyors as infrastructure: every route is a dark structural rail with a
 * thin illuminated core riding inside it. Light packets travel at the real
 * throughput of the feeding station, congestion at the receiving station
 * warms the core, and the express bypass physically traces itself into
 * existence when its recommendation is applied — traffic migrates, it never
 * teleports.
 */

const FLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOW_FRAGMENT = /* glsl */ `
  uniform float uOffset;
  uniform float uActivity;
  uniform float uCongest;
  uniform float uBuild;
  uniform float uFade;
  uniform float uRepeats;
  uniform vec3 uColor;
  uniform vec3 uWarm;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uBuild) discard;
    // Soft light packets moving along the tube.
    float band = fract(vUv.x * uRepeats - uOffset);
    float packet = smoothstep(0.0, 0.4, band) * smoothstep(0.95, 0.55, band);
    vec3 col = mix(uColor, uWarm, uCongest);
    float level = 0.16 + uActivity * packet * 1.25;
    // The freshly built tip of a new route glows as it assembles.
    float tip = smoothstep(uBuild - 0.06, uBuild, vUv.x) * step(uBuild, 0.999) * 0.8;
    gl_FragColor = vec4(col * (level + tip), uFade * min(1.0, 0.25 + level));
  }
`;

function LanePipe({
  segment,
  base,
  radius,
  fadeGroup,
  speedScale,
  watchTarget,
  buildAnimated,
}: {
  segment: Segment;
  base: string;
  radius: number;
  /** 0 = always visible, 1 = support group (fades in later chapters). */
  fadeGroup: 0 | 1;
  speedScale: number;
  watchTarget: boolean;
  buildAnimated: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const builtAt = useRef<number | null>(buildAnimated ? null : 0);
  const congest = useRef(0);

  const uniforms = useMemo(
    () => ({
      uOffset: { value: 0 },
      uActivity: { value: 0 },
      uCongest: { value: 0 },
      uBuild: { value: buildAnimated ? 0 : 1 },
      uFade: { value: 1 },
      uRepeats: { value: Math.max(2, Math.round(segment.length * 1.6)) },
      uColor: { value: new THREE.Color(base) },
      uWarm: { value: new THREE.Color(PALETTE.warn) },
    }),
    [segment, base, buildAnimated],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const sim = useSimStore.getState().sim;
    const from = sim.nodes[segment.from];
    const to = sim.nodes[segment.to];

    // Packet speed and brightness follow the real feeding throughput.
    const flow = THREE.MathUtils.clamp(from.throughput / 40, 0, 1.6);
    mat.uniforms.uOffset.value += delta * (0.1 + flow * 0.9) * speedScale;
    mat.uniforms.uActivity.value = THREE.MathUtils.clamp(0.25 + flow, 0, 1.4);

    // Congestion at the receiving station warms the lane, smoothly.
    if (watchTarget) {
      const target = to.status === "critical" ? 1 : to.status === "strained" ? 0.55 : 0;
      congest.current += (target - congest.current) * Math.min(1, delta * 2.5);
      mat.uniforms.uCongest.value = congest.current;
    }

    // Support conduits surface once the visitor is deep enough to care.
    if (fadeGroup === 1) {
      mat.uniforms.uFade.value = THREE.MathUtils.clamp(scrollState.chapterFloat - 2.4, 0, 1) * 0.6;
    }

    // A new route assembles itself — traced from origin to destination.
    if (buildAnimated) {
      if (builtAt.current === null) builtAt.current = performance.now();
      const age = (performance.now() - builtAt.current) / 1000;
      const k = THREE.MathUtils.clamp(age / TIMING.routeBuild, 0, 1);
      mat.uniforms.uBuild.value = k * k * (3 - 2 * k);
    }
  });

  return (
    <group>
      {/* Structural under-rail. */}
      <mesh material={structuralDarkMat} dispose={null}>
        <tubeGeometry args={[segment.curve, 36, radius * 1.9, 6, false]} />
      </mesh>
      {/* Illuminated core. */}
      <mesh>
        <tubeGeometry args={[segment.curve, 36, radius, 6, false]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={FLOW_VERTEX}
          fragmentShader={FLOW_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function Pathways() {
  const bypassActive = useSimStore((s) =>
    s.sim.appliedRecommendations.includes("alternate-express-route"),
  );

  return (
    <group>
      {FLOW_SEGMENTS.map((seg) => (
        <LanePipe
          key={`${seg.from}-${seg.to}`}
          segment={seg}
          base={PALETTE.signal}
          radius={0.03}
          fadeGroup={0}
          speedScale={1}
          watchTarget
          buildAnimated={false}
        />
      ))}
      {SUPPORT_SEGMENTS.map((seg) => (
        <LanePipe
          key={`${seg.from}-${seg.to}`}
          segment={seg}
          base={PALETTE.structure}
          radius={0.018}
          fadeGroup={1}
          speedScale={0.5}
          watchTarget={false}
          buildAnimated={false}
        />
      ))}
      {bypassActive && (
        <LanePipe
          segment={BYPASS_SEGMENT}
          base={PALETTE.success}
          radius={0.028}
          fadeGroup={0}
          speedScale={1.4}
          watchTarget={false}
          buildAnimated
        />
      )}
    </group>
  );
}
