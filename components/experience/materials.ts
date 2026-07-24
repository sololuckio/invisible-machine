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
 *  - shell:      station bodies — machined dark metal, selective sheen
 *  - panel:      inset faces and internal walls — matte, recessed
 *  - glow:       small self-lit details — never tone-mapped, always tinted
 */

export const structuralMat = new THREE.MeshStandardMaterial({
  color: "#39434f",
  metalness: 0.3,
  roughness: 0.58,
});

export const structuralDarkMat = new THREE.MeshStandardMaterial({
  color: "#232a33",
  metalness: 0.22,
  roughness: 0.68,
});

export const shellMat = new THREE.MeshStandardMaterial({
  color: "#46525f",
  metalness: 0.38,
  roughness: 0.4,
});

export const panelMat = new THREE.MeshStandardMaterial({
  color: "#2b343f",
  metalness: 0.28,
  roughness: 0.5,
});

export const plinthMat = new THREE.MeshStandardMaterial({
  color: "#252c35",
  metalness: 0.22,
  roughness: 0.64,
});

/** Faint permanent trim light along structural edges. */
export const trimMat = new THREE.MeshBasicMaterial({
  color: PALETTE.signalDeep,
  toneMapped: false,
  transparent: true,
  opacity: 0.55,
});

/** Soft warm interior light — used sparingly inside chambers. */
export const interiorGlowMat = new THREE.MeshBasicMaterial({
  color: "#2b3a45",
  toneMapped: false,
  transparent: true,
  opacity: 0.85,
});

/** Shared unit geometries, scaled per use — one allocation for the fleet. */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  cylinder6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.CylinderGeometry(0.5, 0.12, 1, 24),
  torus: new THREE.TorusGeometry(0.5, 0.035, 10, 48),
  torusThick: new THREE.TorusGeometry(0.5, 0.07, 10, 40),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  sphere: new THREE.SphereGeometry(0.5, 20, 20),
} as const;
