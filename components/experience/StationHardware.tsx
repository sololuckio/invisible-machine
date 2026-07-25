"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { NODE_DEFS } from "@/simulation/nodes";
import { GEO, machinedMat, polymerMat, sealMat, wornMat } from "./materials";

/**
 * The hardware every station carries because it was manufactured and has to be
 * maintained: anchor bolts around the plinth, rubber vibration mounts under it,
 * a service hatch, a nameplate, and the conduit that feeds it.
 *
 * None of it is animated and none of it is interactive. It exists so that a
 * close shot has something true to find — a station that is bolted down reads
 * as an object with weight, and one that simply intersects the floor does not.
 *
 * All eight stations' hardware is pooled into four `InstancedMesh`es built once
 * at mount, so the entire fleet costs four draw calls rather than roughly a
 * hundred and thirty individual meshes.
 */

const BOLTS = 12;
const BOLT_RING = 1.16;
const MOUNTS = 4;

interface Part {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
}

function buildParts() {
  const bolts: Part[] = [];
  const mounts: Part[] = [];
  const plates: Part[] = [];
  const conduit: Part[] = [];

  for (const def of NODE_DEFS) {
    const [sx, sy, sz] = def.position;

    // Anchor bolts around the plinth rim.
    for (let i = 0; i < BOLTS; i++) {
      const a = (i / BOLTS) * Math.PI * 2;
      bolts.push({
        pos: [sx + Math.cos(a) * BOLT_RING, sy - 0.63, sz + Math.sin(a) * BOLT_RING],
        rot: [0, 0, 0],
        scale: [0.085, 0.075, 0.085],
      });
    }

    // Rubber vibration mounts, carrying the load into the deck.
    for (let i = 0; i < MOUNTS; i++) {
      const a = (i / MOUNTS) * Math.PI * 2 + Math.PI / 4;
      mounts.push({
        pos: [sx + Math.cos(a) * 0.92, sy - 0.95, sz + Math.sin(a) * 0.92],
        rot: [0, 0, 0],
        scale: [0.3, 0.16, 0.3],
      });
    }

    // Service hatch on the plinth face, and the plant nameplate beside it.
    plates.push({
      pos: [sx - 0.34, sy - 0.72, sz + 1.06],
      rot: [0, 0, 0],
      scale: [0.52, 0.3, 0.04],
    });
    plates.push({
      pos: [sx + 0.42, sy - 0.66, sz + 1.06],
      rot: [0, 0, 0],
      scale: [0.34, 0.11, 0.03],
    });

    // Supply conduit dropping out of the plinth underside.
    conduit.push({
      pos: [sx - 0.72, sy - 1.15, sz - 0.62],
      rot: [0, 0, 0],
      scale: [0.11, 0.62, 0.11],
    });
    conduit.push({
      pos: [sx - 0.86, sy - 1.15, sz - 0.5],
      rot: [0, 0, 0],
      scale: [0.08, 0.62, 0.08],
    });
  }

  return { bolts, mounts, plates, conduit };
}

const TMP = new THREE.Object3D();

function pool(parts: Part[], geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    TMP.position.set(...p.pos);
    TMP.rotation.set(...p.rot);
    TMP.scale.set(...p.scale);
    TMP.updateMatrix();
    mesh.setMatrixAt(i, TMP.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export function StationHardware() {
  const meshes = useMemo(() => {
    const { bolts, mounts, plates, conduit } = buildParts();
    return [
      pool(bolts, GEO.cylinder6, machinedMat),
      pool(mounts, GEO.cylinder8, sealMat),
      pool(plates, GEO.box, wornMat),
      pool(conduit, GEO.cylinder8, polymerMat),
    ];
  }, []);

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} dispose={null} />
      ))}
    </>
  );
}
