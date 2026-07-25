"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SHAFT_BOTTOM, SHAFT_TOP, hash01 } from "@/lib/facility";
import { damp } from "@/lib/motion";
import { PALETTE } from "@/lib/palette";
import { stageState } from "@/lib/stage";
import { useUIStore } from "@/store/uiStore";
import { fxBus } from "./fxBus";

/**
 * Air.
 *
 * A dark room only reads as *deep* when there is something in the space
 * between the camera and the far wall. Rather than fake volumetric shafts
 * with additive cones — which cost fill rate and always look like a decal —
 * this is the real mechanism: fine dust suspended in the shaft, which catches
 * the working lights and the intelligence layer's measuring plane as they pass.
 *
 * The whole field is one draw call and one buffer. All motion happens in the
 * vertex shader from a single time uniform, so there is no per-frame CPU work
 * and no allocation. Presence is directed rather than constant: the brief is
 * that atmosphere should support the reveal, the scan and the closure, and get
 * out of the way while the visitor is reading instruments.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScanY;
  uniform float uSize;
  attribute float aSeed;
  attribute float aSpeed;
  varying float vFade;

  void main() {
    vec3 p = position;
    // Slow settle, wrapped through the shaft height.
    float span = ${(SHAFT_TOP - SHAFT_BOTTOM).toFixed(2)};
    p.y = mod(p.y - uTime * aSpeed - ${SHAFT_BOTTOM.toFixed(2)}, span) + ${SHAFT_BOTTOM.toFixed(2)};
    // Convection drift — dust never falls straight in a working plant.
    float w = uTime * 0.11 + aSeed * 6.2831;
    p.x += sin(w) * 0.5 + sin(w * 0.37) * 0.9;
    p.z += cos(w * 0.83) * 0.5 + cos(w * 0.29) * 0.7;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Motes light up where light actually is: the measuring plane as it sweeps.
    float lit = 1.0 - smoothstep(0.0, 3.4, abs(p.y - uScanY));
    vFade = 0.35 + 0.65 * fract(aSeed * 7.3) + lit * 1.9;
    gl_PointSize = uSize * (0.55 + fract(aSeed * 3.1)) * (14.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vFade;

  void main() {
    // Soft round mote — no texture needed.
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.06, d);
    gl_FragColor = vec4(uColor, a * uOpacity * vFade);
  }
`;

/** How present the air is during each beat. Never constant, never maximal. */
const PRESENCE: Record<string, number> = {
  stillness: 0.5,
  instability: 0.6,
  ignition: 0.85,
  release: 1,
  descent: 1,
  hero: 0.62,
  pressure: 0.3,
  rising: 0.36,
  compression: 0.44,
  lock: 0.5,
  inspect: 0.26,
  prescan: 0.26,
  scan: 0.95,
  restructure: 0.7,
  managed: 0.28,
  reflect: 0.34,
  closure: 0.9,
  lab: 0.22,
};

export function Atmosphere({ count }: { count: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const opacity = useRef(0);

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Deterministic placement, biased toward the walls so the middle stays
      // clear for the machine.
      const a = hash01(i * 1.7) * Math.PI * 2;
      const r = 1.6 + Math.sqrt(hash01(i * 3.3)) * 7.6;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = SHAFT_BOTTOM + hash01(i * 5.9) * (SHAFT_TOP - SHAFT_BOTTOM);
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = hash01(i * 11.3);
      speed[i] = 0.06 + hash01(i * 13.7) * 0.22;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    return geo;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScanY: { value: -999 },
      uOpacity: { value: 0 },
      uSize: { value: 2.4 },
      uColor: { value: new THREE.Color(PALETTE.intel) },
    }),
    [],
  );

  useFrame((state, delta) => {
    const reduced = useUIStore.getState().reducedMotion;
    uniforms.uTime.value = reduced ? 0 : state.clock.elapsedTime;
    uniforms.uScanY.value = fxBus.scanY ?? -999;
    const target = (PRESENCE[stageState.beat] ?? 0.3) * (reduced ? 0.35 : 1) * 0.34;
    opacity.current += (target - opacity.current) * damp(1.4, delta);
    uniforms.uOpacity.value = opacity.current;
    if (material.current) material.current.visible = opacity.current > 0.004;
  });

  if (count <= 0) return null;

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
