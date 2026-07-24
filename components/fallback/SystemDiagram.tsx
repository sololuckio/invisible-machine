"use client";

import { useMemo } from "react";
import { fmtInt } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/palette";
import { FLOW_PATH, NODE_DEFS, NODE_MAP } from "@/simulation/nodes";
import type { NodeId } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The machine as a live 2D schematic — the primary view when WebGL is
 * unavailable, and an accessible alternative any visitor can switch to.
 * Same simulation, same bottlenecks, same story; keyboard-selectable nodes.
 */

function edgePath(from: NodeId, to: NodeId, bow: number): string {
  const a = NODE_MAP[from].diagram;
  const b = NODE_MAP[to].diagram;
  const mx = (a.x + b.x) / 2 + bow;
  const my = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

export function SystemDiagram({ interactive = true }: { interactive?: boolean }) {
  const sim = useSimStore((s) => s.sim);
  const selected = useUIStore((s) => s.selectedNode);
  const selectNode = useUIStore((s) => s.selectNode);

  const edges = useMemo(() => {
    const flow = FLOW_PATH.slice(0, -1).map((id, i) => ({
      key: `f-${id}`,
      d: edgePath(id, FLOW_PATH[i + 1], i % 2 === 0 ? 7 : -7),
      support: false,
    }));
    const support = (["payment", "fulfilment", "delivery"] as NodeId[]).map((id) => ({
      key: `s-${id}`,
      d: edgePath(id, "support", 6),
      support: true,
    }));
    return [...flow, ...support];
  }, []);

  return (
    <svg
      viewBox="0 0 100 100"
      className="system-diagram"
      role="group"
      aria-label="Live schematic of the business system. Stations are listed with their queues and status."
    >
      {edges.map((e) => (
        <path
          key={e.key}
          d={e.d}
          fill="none"
          stroke={e.support ? "var(--color-structure)" : "var(--color-signal-deep)"}
          strokeWidth={e.support ? 0.28 : 0.5}
          strokeDasharray="1.6 1.2"
          className="diagram-flow"
          opacity={e.support ? 0.5 : 0.9}
        />
      ))}

      {NODE_DEFS.map((def) => {
        const node = sim.nodes[def.id];
        const { x, y } = def.diagram;
        const color = STATUS_COLORS[node.status];
        const isBottleneck = sim.bottleneck === def.id;
        const isSelected = selected === def.id;
        const util = Math.min(node.utilization, 1);
        const r = 4.4;
        const circumference = 2 * Math.PI * (r + 1.6);
        return (
          <g
            key={def.id}
            transform={`translate(${x} ${y})`}
            className={interactive ? "diagram-node" : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${def.name}: status ${STATUS_LABELS[node.status]}, queue ${fmtInt(node.queue)} orders`}
            aria-pressed={interactive ? isSelected : undefined}
            onClick={interactive ? () => selectNode(def.id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectNode(def.id);
                    }
                  }
                : undefined
            }
          >
            {isBottleneck && (
              <circle
                r={r + 3.2}
                fill="none"
                stroke={color}
                strokeWidth={0.4}
                className="diagram-pulse"
              />
            )}
            {isSelected && (
              <circle
                r={r + 2.6}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth={0.3}
                strokeDasharray="1 1"
              />
            )}
            <circle r={r} fill="var(--color-panel)" stroke={color} strokeWidth={0.6} />
            {/* Utilisation arc around the node */}
            <circle
              r={r + 1.6}
              fill="none"
              stroke={color}
              strokeWidth={0.5}
              strokeDasharray={`${util * circumference} ${circumference}`}
              transform="rotate(-90)"
              opacity={0.9}
            />
            {def.id === "inventory" && (
              <rect
                x={r + 2.4}
                y={-r + 2 * r * (1 - sim.stock / 100)}
                width={1.1}
                height={(2 * r * sim.stock) / 100}
                fill={
                  sim.stock < 20
                    ? "var(--color-danger)"
                    : sim.stock < 45
                      ? "var(--color-warn)"
                      : "var(--color-signal)"
                }
              />
            )}
            <text y={-r - 2.2} textAnchor="middle" className="diagram-tag">
              {def.tag}
            </text>
            <text y={r + 3.6} textAnchor="middle" className="diagram-name">
              {def.name}
            </text>
            <text y={r + 6.4} textAnchor="middle" className="diagram-queue" fill={color}>
              {node.queue >= 1 ? `Q ${fmtInt(node.queue)}` : "CLEAR"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
