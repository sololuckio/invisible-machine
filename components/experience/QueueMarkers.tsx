"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { STATUS_COLORS } from "@/lib/palette";
import { FLOW_PATH, NODE_MAP } from "@/simulation/nodes";
import type { NodeId } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Waiting work made physical: each marker is a block of queued orders,
 * stacking into a helix above a station as its backlog deepens.
 */

const QUEUE_NODES: NodeId[] = [...FLOW_PATH.filter((id) => id !== "revenue"), "support"];
/** Orders represented by one marker block. */
const ORDERS_PER_MARKER = 8;

export function QueueMarkers({ maxPerNode }: { maxPerNode: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const capacity = QUEUE_NODES.length * maxPerNode;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const sim = useSimStore.getState().sim;
    const reduced = useUIStore.getState().reducedMotion;
    const t = state.clock.elapsedTime;

    let i = 0;
    for (const id of QUEUE_NODES) {
      const node = sim.nodes[id];
      const def = NODE_MAP[id];
      const count = Math.min(maxPerNode, Math.floor(node.queue / ORDERS_PER_MARKER));
      color.set(STATUS_COLORS[node.status]);
      for (let k = 0; k < count; k++) {
        const angle = k * 2.4 + (reduced ? 0 : t * 0.25);
        const r = 0.72 + (k % 3) * 0.09;
        dummy.position.set(
          def.position[0] + Math.cos(angle) * r,
          def.position[1] + 0.15 + k * 0.11,
          def.position[2] + Math.sin(angle) * r,
        );
        dummy.rotation.set(0, angle, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    // Park the rest out of sight.
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (; i < capacity; i++) mesh.setMatrixAt(i, dummy.matrix);

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, capacity]} frustumCulled={false}>
      <boxGeometry args={[0.085, 0.085, 0.085]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
