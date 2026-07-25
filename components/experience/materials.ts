import * as THREE from "three";
import { PALETTE } from "@/lib/palette";

/**
 * The machine's material families — one shared, deliberately narrow kit
 * instead of ad-hoc materials scattered across components.
 *
 * All materials here are module singletons: meshes that use them must set
 * `dispose={null}` (R3F would otherwise dispose a shared material when any
 * one mesh unmounts). GPU resources are reclaimed with the context when the
 * canvas itself is torn down, so switching to the diagram view leaks nothing.
 *
 * Families (see the art-direction notes in the README):
 *  - structural: shaft frames, rails, supports — deep graphite, near-silent
 *  - frame:      plant steel — heavier, rougher, load-bearing
 *  - shell:      station bodies — machined dark metal, selective sheen
 *  - machined:   moving contact surfaces — polished, tighter highlight
 *  - panel:      inset faces and internal walls — matte, recessed
 *  - heat:       surfaces that run hot — discoloured, slightly warmer
 *  - worn:       maintenance areas — scuffed, flat, handled
 *  - glass:      inspection windows and sensor covers
 *  - polymer:    belts, seals, dampers — the non-metal that stops everything
 *                looking milled from one billet
 *  - glow:       small self-lit details — never tone-mapped, always tinted
 */

/* ------------------------------------------------------------------ *
 * Procedural surface detail
 * ------------------------------------------------------------------ */

/**
 * Everything in this scene is procedural geometry, which means perfectly
 * uniform surfaces — the one thing manufactured metal never has. Rather than
 * ship texture maps (bytes, decode time, and UVs that would smear across
 * non-uniformly scaled unit boxes), the standard shader is patched with a
 * world-space detail pass:
 *
 *  - **wear**   low-frequency roughness variation, so light breaks up
 *  - **grain**  an anisotropic streak along one axis — brushed direction
 *  - **dust**   settles only on upward faces, exactly as it does in a plant
 *  - **mottle** a whisper of albedo variation, so flats are never dead flat
 *  - **rim**    a grazing-angle specular lift that finds machined edges and
 *               keeps silhouettes readable in a very dark room
 *
 * All of it is uniform-driven from one shared program, so the whole kit adds
 * a single shader, no textures and no draw calls. Amplitudes are deliberately
 * low: this should be felt, not spotted.
 */
export interface SurfaceDetail {
  /** World-space frequency of the wear/mottle noise. */
  scale?: number;
  /** Roughness modulation amplitude. */
  wear?: number;
  /** Albedo modulation amplitude. */
  mottle?: number;
  /** How much dust collects on upward faces. */
  dust?: number;
  /** Brushed-streak amplitude. */
  brush?: number;
  /** Streak frequency per axis — high across the grain, low along it. */
  grain?: [number, number, number];
  /** Edge/rim specular lift. */
  rim?: number;
}

const DETAIL_PARS = /* glsl */ `
  varying vec3 vSurfPos;
  varying vec3 vSurfNrm;
  uniform vec4 uDetail;   // x scale, y mottle, z dust, w wear
  uniform vec3 uGrain;
  uniform vec2 uBrushRim; // x brush, y rim
  uniform vec3 uDustCol;

  float sdHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float sdNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(sdHash(i), sdHash(i + vec3(1,0,0)), f.x),
          mix(sdHash(i + vec3(0,1,0)), sdHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(sdHash(i + vec3(0,0,1)), sdHash(i + vec3(1,0,1)), f.x),
          mix(sdHash(i + vec3(0,1,1)), sdHash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
`;

const DETAIL_VERTEX = /* glsl */ `
  #include <begin_vertex>
  vec4 sdWorld = vec4(transformed, 1.0);
  vec3 sdNrm = objectNormal;
  #ifdef USE_INSTANCING
    sdWorld = instanceMatrix * sdWorld;
    sdNrm = mat3(instanceMatrix) * sdNrm;
  #endif
  sdWorld = modelMatrix * sdWorld;
  vSurfPos = sdWorld.xyz;
  vSurfNrm = normalize(mat3(modelMatrix) * sdNrm);
`;

const DETAIL_COLOR = /* glsl */ `
  #include <map_fragment>
  float sdWear = sdNoise(vSurfPos * uDetail.x);
  // Brushed finish is directional streaks, not blotches, so a plane wave along
  // the grain axis is both truer to the material and a small fraction of the
  // cost of a second noise lookup — which matters, because this runs on every
  // opaque pixel and fill rate is the budget that actually binds on mobile.
  float sdGrain = sin(dot(vSurfPos, uGrain)) * 0.5 + 0.5;
  float sdDust = smoothstep(0.28, 1.0, vSurfNrm.y) * uDetail.z;
  diffuseColor.rgb *= 1.0 + (sdWear - 0.5) * uDetail.y;
  diffuseColor.rgb = mix(diffuseColor.rgb, uDustCol, sdDust * 0.55);
`;

const DETAIL_ROUGH = /* glsl */ `
  #include <roughnessmap_fragment>
  roughnessFactor = clamp(
    roughnessFactor + (sdWear - 0.5) * uDetail.w + (sdGrain - 0.5) * uBrushRim.x + sdDust * 0.4,
    0.045, 1.0);
`;

const DETAIL_RIM = /* glsl */ `
  #include <lights_fragment_end>
  float sdRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.5);
  reflectedLight.indirectSpecular += vec3(sdRim * uBrushRim.y);
`;

const DUST_COLOR = new THREE.Color("#4b525c");

/**
 * Patch a standard material with the detail pass. The compile hook body is
 * identical for every material, so three.js's program cache hands them all the
 * same shader; only the uniform values differ, which is why an eight-family
 * kit still costs one program.
 */
function detailed<T extends THREE.MeshStandardMaterial>(mat: T, d: SurfaceDetail = {}): T {
  const uniforms = {
    uDetail: {
      value: new THREE.Vector4(d.scale ?? 1.6, d.mottle ?? 0.07, d.dust ?? 0.12, d.wear ?? 0.16),
    },
    uGrain: { value: new THREE.Vector3(...(d.grain ?? [48, 1.1, 48])) },
    uBrushRim: { value: new THREE.Vector2(d.brush ?? 0.06, d.rim ?? 0.05) },
    uDustCol: { value: DUST_COLOR },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${DETAIL_PARS}`)
      .replace("#include <begin_vertex>", DETAIL_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${DETAIL_PARS}`)
      .replace("#include <map_fragment>", DETAIL_COLOR)
      .replace("#include <roughnessmap_fragment>", DETAIL_ROUGH)
      .replace("#include <lights_fragment_end>", DETAIL_RIM);
  };
  return mat;
}

/* ------------------------------------------------------------------ *
 * Metal — four behaviours, not one universal dark metallic
 * ------------------------------------------------------------------ */

/** Shaft frames and rails: mid graphite, vertical grain. */
export const structuralMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#39434f", metalness: 0.3, roughness: 0.58 }),
  { wear: 0.18, brush: 0.07, grain: [58, 1.2, 58], rim: 0.07, dust: 0.14 },
);

/** Recessed structure — darker, quieter, further back. */
export const structuralDarkMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#232a33", metalness: 0.22, roughness: 0.68 }),
  { wear: 0.16, brush: 0.05, rim: 0.035, dust: 0.16 },
);

/**
 * Plant steel: heavy, load-bearing, visibly rougher than the machine — and
 * deliberately darker than every station surface. The building is the ground
 * the machine is read against, so it lives in the bottom of the value range;
 * a catwalk that reads as brightly as a station is a catwalk competing with
 * the story.
 */
export const frameMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#1c222a", metalness: 0.14, roughness: 0.82 }),
  { scale: 1.1, wear: 0.2, mottle: 0.1, dust: 0.2, brush: 0.04, rim: 0.028 },
);

/** Facility round stock: handrails, conduit, rungs. Matte, never sparkling. */
export const railMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#232932", metalness: 0.2, roughness: 0.74 }),
  { scale: 2.2, wear: 0.16, mottle: 0.08, dust: 0.16, brush: 0.04, rim: 0.035 },
);

/** Station bodies: machined shells with a selective sheen. */
export const shellMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#46525f", metalness: 0.38, roughness: 0.4 }),
  { scale: 2.4, wear: 0.13, mottle: 0.06, dust: 0.1, brush: 0.08, grain: [62, 1.4, 62], rim: 0.1 },
);

/** Moving contact surfaces: polished by use, tighter highlight. */
export const machinedMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#59636e", metalness: 0.74, roughness: 0.22 }),
  { scale: 3.2, wear: 0.09, mottle: 0.04, dust: 0.03, brush: 0.05, grain: [2.2, 66, 2.2], rim: 0.145 },
);

/** Inset faces and internal walls: matte, recessed, no sparkle. */
export const panelMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#2b343f", metalness: 0.28, roughness: 0.5 }),
  { scale: 2.8, wear: 0.14, mottle: 0.07, dust: 0.08, rim: 0.04 },
);

export const plinthMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#252c35", metalness: 0.22, roughness: 0.64 }),
  { scale: 1.9, wear: 0.17, mottle: 0.08, dust: 0.2, rim: 0.045 },
);

/** Surfaces that run hot — a faint straw discolouration, rougher oxide. */
export const heatMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#4a4239", metalness: 0.44, roughness: 0.52 }),
  { scale: 3.6, wear: 0.22, mottle: 0.14, dust: 0.06, brush: 0.05, rim: 0.06 },
);

/** Maintenance areas: handled, scuffed, flat. */
export const wornMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#3b4149", metalness: 0.18, roughness: 0.86 }),
  { scale: 4.2, wear: 0.24, mottle: 0.13, dust: 0.28, rim: 0.03 },
);

/* ------------------------------------------------------------------ *
 * Non-metal — so the world is not milled from one billet
 * ------------------------------------------------------------------ */

/** Inspection windows and sensor covers. Used sparingly, over lit interiors. */
export const glassMat = new THREE.MeshStandardMaterial({
  color: "#8fb6c4",
  metalness: 0.1,
  roughness: 0.08,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  side: THREE.DoubleSide,
});

/** Belts, boots and protective covers. */
export const polymerMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#15181d", metalness: 0.0, roughness: 0.94 }),
  { scale: 5.5, wear: 0.1, mottle: 0.09, dust: 0.05, rim: 0.02 },
);

/** Seals and vibration dampers — softer, slightly lifted. */
export const sealMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#1e2228", metalness: 0.0, roughness: 0.88 }),
  { scale: 6.5, wear: 0.08, mottle: 0.07, dust: 0.04, rim: 0.025 },
);

/** Painted service markings — the amber of every plant floor, well faded. */
export const markingMat = detailed(
  new THREE.MeshStandardMaterial({ color: "#463a1e", metalness: 0.05, roughness: 0.85 }),
  { scale: 5, wear: 0.22, mottle: 0.2, dust: 0.34, rim: 0.015 },
);

/* ------------------------------------------------------------------ *
 * Light-emitting details
 * ------------------------------------------------------------------ */

/** Faint permanent trim light along structural edges. */
export const trimMat = new THREE.MeshBasicMaterial({
  color: PALETTE.signalDeep,
  toneMapped: false,
  transparent: true,
  opacity: 0.55,
});

/** Soft warm interior light — used sparingly inside chambers. */
export const interiorGlowMat = new THREE.MeshBasicMaterial({
  color: "#22303a",
  toneMapped: false,
  transparent: true,
  opacity: 0.7,
});

/**
 * Working lamps: inspection lights, over-door lights, distant windows. Kept
 * deliberately faint — they are evidence that the plant is occupied, not a
 * light source competing with the machine's own signal colour.
 */
export const lampMat = new THREE.MeshBasicMaterial({
  color: "#7f909c",
  toneMapped: false,
  transparent: true,
  opacity: 0.3,
});

/** Shared unit geometries, scaled per use — one allocation for the fleet. */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  /** Low-poly round stock: handrails, conduit, rungs — hundreds of instances. */
  cylinder8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cylinder6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.CylinderGeometry(0.5, 0.12, 1, 24),
  torus: new THREE.TorusGeometry(0.5, 0.035, 10, 48),
  torusThick: new THREE.TorusGeometry(0.5, 0.07, 10, 40),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  sphere: new THREE.SphereGeometry(0.5, 20, 20),
  plane: new THREE.PlaneGeometry(1, 1),
} as const;
