"use client";

import { useShallow } from "zustand/shallow";
import { fmtHours, fmtInt, fmtMoney, fmtPct, fmtRate } from "@/lib/format";
import { useSimStore } from "@/store/simStore";

/**
 * The machine's vital signs. Values are rounded in the selector so the
 * strip only re-renders when a displayed digit actually changes.
 */

type Tone = "ok" | "warn" | "danger" | "neutral";

function toneFor(value: number, warnBelow: number, dangerBelow: number): Tone {
  if (value < dangerBelow) return "danger";
  if (value < warnBelow) return "warn";
  return "ok";
}

export function MetricsStrip() {
  const m = useSimStore(
    useShallow((s) => ({
      health: Math.round(s.sim.metrics.systemHealth),
      satisfaction: Math.round(s.sim.metrics.customerSatisfaction),
      arrival: Math.round(s.sim.metrics.arrivalRate),
      completion: Math.round(s.sim.metrics.completionRate),
      queue: Math.round(s.sim.metrics.totalQueue),
      trapped: Math.round(s.sim.metrics.trappedRevenue / 100) * 100,
      revenue: Math.round(s.sim.metrics.capturedRevenue / 100) * 100,
      costRate: Math.round(s.sim.metrics.operatingCostRate),
      processing: Math.round(s.sim.metrics.avgProcessingTime * 2) / 2,
      issues: Math.round(s.sim.metrics.unresolvedIssues),
      stock: Math.round(s.sim.stock),
    })),
  );

  const cells: { label: string; value: string; tone: Tone; title: string }[] = [
    {
      label: "System health",
      value: fmtPct(m.health),
      tone: toneFor(m.health, 75, 50),
      title: "Composite of satisfaction, delivery performance, congestion and errors",
    },
    {
      label: "Satisfaction",
      value: fmtPct(m.satisfaction),
      tone: toneFor(m.satisfaction, 75, 55),
      title: "How customers are experiencing the machine right now",
    },
    {
      label: "Orders in",
      value: fmtRate(m.arrival),
      tone: "neutral",
      title: "Arrival rate",
    },
    {
      label: "Orders out",
      value: fmtRate(m.completion),
      tone:
        m.completion >= m.arrival * 0.9
          ? "ok"
          : m.completion >= m.arrival * 0.6
            ? "warn"
            : "danger",
      title: "Completion rate — should keep up with arrivals",
    },
    {
      label: "In queues",
      value: fmtInt(m.queue),
      tone: m.queue > 250 ? "danger" : m.queue > 90 ? "warn" : "ok",
      title: "Orders waiting somewhere in the machine",
    },
    {
      label: "Order lead time",
      value: fmtHours(m.processing),
      tone: m.processing > 60 ? "danger" : m.processing > 38 ? "warn" : "ok",
      title: "Click to doorstep at current congestion",
    },
    {
      label: "Trapped revenue",
      value: fmtMoney(m.trapped),
      tone: m.trapped > 12000 ? "danger" : m.trapped > 4500 ? "warn" : "ok",
      title: "Value stuck as work-in-progress",
    },
    {
      label: "Captured revenue",
      value: fmtMoney(m.revenue),
      tone: "neutral",
      title: "Orders that survived the whole journey",
    },
    {
      label: "Operating cost",
      value: `${fmtMoney(m.costRate)}/h`,
      tone: "neutral",
      title: "Burn rate of the current configuration",
    },
    {
      label: "Open issues",
      value: fmtInt(m.issues),
      tone: m.issues > 60 ? "danger" : m.issues > 18 ? "warn" : "ok",
      title: "Unresolved support conversations",
    },
    {
      label: "Stock level",
      value: fmtPct(m.stock),
      tone: toneFor(m.stock, 45, 20),
      title: "Inventory on the shelves",
    },
  ];

  return (
    <dl className="metrics-strip" aria-label="Live system metrics">
      {cells.map((c) => (
        <div key={c.label} className={`metric-cell tone-${c.tone}`} title={c.title}>
          <dt>{c.label}</dt>
          <dd>{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
