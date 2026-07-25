"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, TIMING } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { stageState } from "@/lib/stage";
import { useSimStore } from "@/store/simStore";
import { BYPASS_SEGMENT, FLOW_SEGMENTS, SEGMENT_BY_FROM, SUPPORT_SEGMENTS, type Segment } from "./curves";
import { fxBus } from "./fxBus";
import { structuralDarkMat } from "./materials";

/**
 * Conveyors as infrastructure: every route is a dark structural rail with a
 * thin illuminated core riding inside it. Light packets travel at the real
 * throughput of the feeding station, congestion at the receiving station
 * warms the core, and the express bypass physically traces itself into
 * existence when its recommendation is applied — traffic migrates, it never
 * teleports.
 *
 * Two of the site's signature moments are carried here as well. During the
 * intelligence scan each connection is traced by the same descending front
 * that raises the station gauges, so the analysis visibly follows the real
 * graph. When a recommendation is applied, a release travels *downstream* of
 * the station that changed — the consequence propagating, one lane at a time.
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
  uniform float uTrace;    // 0..1 position of the analysis front, -1 when idle
  uniform float uRelease;  // 0..1 position of the release wave, -1 when idle
  uniform vec3 uColor;
  uniform vec3 uWarm;
  uniform vec3 uIntel;
  uniform vec3 uCalm;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uBuild) discard;
    // Soft light packets moving along the tube.
    float band = fract(vUv.x * uRepeats - uOffset);
    float packet = smoothstep(0.0, 0.4, band) * smoothstep(0.95, 0.55, band);
    float trace = uTrace >= 0.0 ? smoothstep(0.10, 0.0, abs(vUv.x - uTrace)) : 0.0;
    float release = uRelease >= 0.0 ? smoothstep(0.16, 0.0, abs(vUv.x - uRelease)) : 0.0;
    vec3 col = mix(uColor, uWarm, uCongest);
    col = mix(col, uIntel, trace);
    col = mix(col, uCalm, release);
    float level = 0.16 + uActivity * packet * 1.25 + trace * 1.5 + release * 1.2;
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
  index,
}: {
  segment: Segment;
  base: string;
  radius: number;
  /** 0 = always visible, 1 = support group (fades in later chapters). */
  fadeGroup: 0 | 1;
  speedScale: number;
  watchTarget: boolean;
  buildAnimated: boolean;
  /** Position in the main flow, or -1 for support/bypass lanes. */
  index: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const builtAt = useRef<number | null>(buildAnimated ? null : 0);
  const congest = useRef(0);

  // Vertical extent of this lane — used to convert the descending scan front
  // into a position along the tube.
  const yRange = useMemo(() => {
    const a = segment.curve.getPoint(0);
    const b = segment.curve.getPoint(1);
    return { top: a.y, bottom: b.y };
  }, [segment]);

  const uniforms = useMemo(
    () => ({
      uOffset: { value: 0 },
      uActivity: { value: 0 },
      uCongest: { value: 0 },
      uBuild: { value: buildAnimated ? 0 : 1 },
      uFade: { value: 1 },
      uRepeats: { value: Math.max(2, Math.round(segment.length * 1.6)) },
      uTrace: { value: -1 },
      uRelease: { value: -1 },
      uColor: { value: new THREE.Color(base) },
      uWarm: { value: new THREE.Color(PALETTE.warn) },
      uIntel: { value: new THREE.Color(PALETTE.intel) },
      uCalm: { value: new THREE.Color(PALETTE.success) },
    }),
    [segment, base, buildAnimated],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const sim = useSimStore.getState().sim;
    const from = sim.nodes[segment.from];
    const to = sim.nodes[segment.to];
    const energy = stageState.energy;

    // Packet speed and brightness follow the real feeding throughput, paced by
    // the beat the experience is currently playing.
    const flow = THREE.MathUtils.clamp(from.throughput / 40, 0, 1.6);
    mat.uniforms.uOffset.value += delta * (0.1 + flow * 0.9) * speedScale * (0.45 + energy * 0.8);
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

    // The analysis front tracing this connection as it passes.
    const scanY = fxBus.scanY;
    if (scanY !== null && scanY <= yRange.top + 0.6 && scanY >= yRange.bottom - 0.6) {
      mat.uniforms.uTrace.value = clamp01(
        (yRange.top - scanY) / Math.max(0.001, yRange.top - yRange.bottom),
      );
    } else if (mat.uniforms.uTrace.value >= 0) {
      mat.uniforms.uTrace.value = -1;
    }

    // Release propagating downstream of a restructured station.
    if (index >= 0 && fxBus.popNode) {
      const origin = SEGMENT_BY_FROM.get(fxBus.popNode);
      const age = (performance.now() - fxBus.appliedAt) / 1000;
      if (origin !== undefined && index >= origin) {
        const delay = (index - origin) * 0.26;
        const k = (age - delay) / 0.8;
        mat.uniforms.uRelease.value = k >= 0 && k <= 1 ? k : -1;
      } else if (mat.uniforms.uRelease.value >= 0) {
        mat.uniforms.uRelease.value = -1;
      }
      if (age > TIMING.releaseWave && mat.uniforms.uRelease.value >= 0) {
        mat.uniforms.uRelease.value = -1;
      }
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
      {FLOW_SEGMENTS.map((seg, i) => (
        <LanePipe
          key={`${seg.from}-${seg.to}`}
          segment={seg}
          base={PALETTE.signal}
          radius={0.03}
          fadeGroup={0}
          speedScale={1}
          watchTarget
          buildAnimated={false}
          index={i}
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
          index={-1}
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
          index={-1}
        />
      )}
    </group>
  );
}
