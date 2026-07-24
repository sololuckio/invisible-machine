"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE, STATUS_COLORS } from "@/lib/palette";
import { FLOW_PATH, NODE_MAP } from "@/simulation/nodes";
import type { NodeId } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { queueSlot, queueSlotAngle, SLOTS_PER_LAYER } from "./queueLayout";

/**
 * Waiting work made physical: backlog blocks fill each station's holding
 * rail slot by slot, stacking a second layer when congestion turns severe.
 * Blocks drain visibly as interventions relieve the station.
 */

const QUEUE_NODES: NodeId[] = [...FLOW_PATH.filter((id) => id !== "revenue"), "support"];
/** Orders represented by one backlog block. */
const ORDERS_PER_MARKER = 8;

export function QueueMarkers({ maxPerNode }: { maxPerNode: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const capacity = QUEUE_NODES.length * maxPerNode;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const slot = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const cSevere = useMemo(() => new THREE.Color(PALETTE.danger), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const sim = useSimStore.getState().sim;

    let i = 0;
    for (const id of QUEUE_NODES) {
      const node = sim.nodes[id];
      const def = NODE_MAP[id];
      const count = Math.min(maxPerNode, Math.floor(node.queue / ORDERS_PER_MARKER));
      for (let k = 0; k < count; k++) {
        queueSlot(k, slot);
        dummy.position.set(
          def.position[0] + slot.x,
          def.position[1] + slot.y,
          def.position[2] + slot.z,
        );
        dummy.rotation.set(0, -queueSlotAngle(k), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Second layer = severe congestion; first layer follows station status.
        color.set(k >= SLOTS_PER_LAYER ? cSevere : STATUS_COLORS[node.status]);
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
      <boxGeometry args={[0.09, 0.1, 0.16]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
