"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { PALETTE } from "@/lib/palette";
import { scrollState } from "@/lib/scrollState";
import { useSimStore } from "@/store/simStore";
import { BYPASS_SEGMENT, FLOW_SEGMENTS, SUPPORT_SEGMENTS, type Segment } from "./curves";

/**
 * The luminous conveyors between stations. Dashes travel at the real
 * throughput of the source station, and a lane glows warm when the station
 * it feeds is congested — flow you can read at a glance.
 */

function LaneLine({
  segment,
  base,
  width,
  opacity,
  speedScale,
  watchTarget,
}: {
  segment: Segment;
  base: string;
  width: number;
  opacity: number;
  speedScale: number;
  watchTarget: boolean;
}) {
  const ref = useRef<Line2>(null);
  const points = useMemo(() => segment.curve.getPoints(30), [segment]);
  const baseColor = useMemo(() => new THREE.Color(base), [base]);
  const warnColor = useMemo(() => new THREE.Color(PALETTE.warn), []);
  const dangerColor = useMemo(() => new THREE.Color(PALETTE.danger), []);
  const current = useMemo(() => new THREE.Color(base), [base]);

  useFrame((_, delta) => {
    const mat = ref.current?.material;
    if (!mat) return;
    const sim = useSimStore.getState().sim;
    const from = sim.nodes[segment.from];
    const to = sim.nodes[segment.to];

    // Dash speed = live throughput of the feeding station.
    const flow = THREE.MathUtils.clamp(from.throughput / 40, 0, 1.6);
    mat.dashOffset -= delta * (0.12 + flow * 1.1) * speedScale;

    // Congestion at the receiving station warms the lane.
    if (watchTarget) {
      const target =
        to.status === "critical" ? dangerColor : to.status === "strained" ? warnColor : baseColor;
      current.lerp(target, Math.min(1, delta * 2.5));
      mat.color.copy(current);
    }
  });

  return (
    <Line
      ref={ref}
      points={points}
      color={base}
      lineWidth={width}
      transparent
      opacity={opacity}
      dashed
      dashSize={0.22}
      gapSize={0.16}
    />
  );
}

export function Pathways() {
  const bypassActive = useSimStore((s) =>
    s.sim.appliedRecommendations.includes("alternate-express-route"),
  );
  const supportGroup = useRef<THREE.Group>(null);

  useFrame(() => {
    // Issue conduits fade in once the visitor is deep enough to care.
    if (supportGroup.current) {
      const vis = THREE.MathUtils.clamp(scrollState.chapterFloat - 2.4, 0, 1);
      supportGroup.current.visible = vis > 0.02;
    }
  });

  return (
    <group>
      {FLOW_SEGMENTS.map((seg) => (
        <LaneLine
          key={`${seg.from}-${seg.to}`}
          segment={seg}
          base={PALETTE.signalDeep}
          width={1.6}
          opacity={0.85}
          speedScale={1}
          watchTarget
        />
      ))}
      <group ref={supportGroup}>
        {SUPPORT_SEGMENTS.map((seg) => (
          <LaneLine
            key={`${seg.from}-${seg.to}`}
            segment={seg}
            base={PALETTE.structure}
            width={1}
            opacity={0.4}
            speedScale={0.5}
            watchTarget={false}
          />
        ))}
      </group>
      {bypassActive && (
        <LaneLine
          segment={BYPASS_SEGMENT}
          base={PALETTE.success}
          width={1.4}
          opacity={0.8}
          speedScale={1.4}
          watchTarget={false}
        />
      )}
    </group>
  );
}
