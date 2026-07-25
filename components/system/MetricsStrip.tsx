"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { fmtHours, fmtInt, fmtMoney, fmtPct, fmtRate } from "@/lib/format";
import { damp } from "@/lib/motion";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * The machine's vital signs. Values are rounded in the selector so the
 * strip only re-renders when a displayed digit actually changes; between
 * those changes a single frame loop eases each figure toward its new value
 * and writes it straight to the DOM. Numbers travel instead of jumping, at
 * no React cost. Reduced motion snaps them.
 */

type Tone = "ok" | "warn" | "danger" | "neutral";

/** How many leading cells are the headline trio rendered as large tiles. */
const PRIMARY = 3;

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

  // Order matters: the first three are the headline trio and are rendered as
  // large tiles. Eleven equal-weight numbers is a data dump — these three are
  // the ones that answer "is the machine in trouble, and what is it costing?".
  const cells: {
    label: string;
    value: number;
    format: (n: number) => string;
    tone: Tone;
    title: string;
  }[] = [
    {
      label: "System health",
      value: m.health,
      format: fmtPct,
      tone: toneFor(m.health, 75, 50),
      title: "Composite of satisfaction, delivery performance, congestion and errors",
    },
    {
      label: "Trapped revenue",
      value: m.trapped,
      format: fmtMoney,
      tone: m.trapped > 12000 ? "danger" : m.trapped > 4500 ? "warn" : "ok",
      title: "Value stuck as work-in-progress",
    },
    {
      label: "In queues",
      value: m.queue,
      format: fmtInt,
      tone: m.queue > 250 ? "danger" : m.queue > 90 ? "warn" : "ok",
      title: "Orders waiting somewhere in the machine",
    },
    {
      label: "Satisfaction",
      value: m.satisfaction,
      format: fmtPct,
      tone: toneFor(m.satisfaction, 75, 55),
      title: "How customers are experiencing the machine right now",
    },
    {
      label: "Orders in",
      value: m.arrival,
      format: fmtRate,
      tone: "neutral",
      title: "Arrival rate",
    },
    {
      label: "Orders out",
      value: m.completion,
      format: fmtRate,
      tone:
        m.completion >= m.arrival * 0.9
          ? "ok"
          : m.completion >= m.arrival * 0.6
            ? "warn"
            : "danger",
      title: "Completion rate — should keep up with arrivals",
    },
    {
      label: "Order lead time",
      value: m.processing,
      format: fmtHours,
      tone: m.processing > 60 ? "danger" : m.processing > 38 ? "warn" : "ok",
      title: "Click to doorstep at current congestion",
    },
    {
      label: "Captured revenue",
      value: m.revenue,
      format: fmtMoney,
      tone: "neutral",
      title: "Orders that survived the whole journey",
    },
    {
      label: "Operating cost",
      value: m.costRate,
      format: (n: number) => `${fmtMoney(n)}/h`,
      tone: "neutral",
      title: "Burn rate of the current configuration",
    },
    {
      label: "Open issues",
      value: m.issues,
      format: fmtInt,
      tone: m.issues > 60 ? "danger" : m.issues > 18 ? "warn" : "ok",
      title: "Unresolved support conversations",
    },
    {
      label: "Stock level",
      value: m.stock,
      format: fmtPct,
      tone: toneFor(m.stock, 45, 20),
      title: "Inventory on the shelves",
    },
  ];

  // One frame loop eases every figure toward its target and writes the text
  // directly; it idles to a few comparisons per frame once everything settles.
  const ddRefs = useRef<(HTMLElement | null)[]>([]);
  const shown = useRef<number[]>(cells.map((c) => c.value));
  const live = useRef(cells);
  live.current = cells;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const reduced = useUIStore.getState().reducedMotion;
      const k = damp(9, delta);
      for (let i = 0; i < live.current.length; i++) {
        const target = live.current[i].value;
        const current = shown.current[i] ?? target;
        const next =
          reduced || Math.abs(target - current) < 0.01 ? target : current + (target - current) * k;
        if (next === current) continue;
        shown.current[i] = next;
        const el = ddRefs.current[i];
        if (el) el.textContent = live.current[i].format(next);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cell = (c: (typeof cells)[number], i: number) => (
    <div key={c.label} className={`metric-cell tone-${c.tone}`} title={c.title}>
      <dt>{c.label}</dt>
      <dd
        ref={(el) => {
          ddRefs.current[i] = el;
        }}
      >
        {c.format(shown.current[i] ?? c.value)}
      </dd>
    </div>
  );

  return (
    <dl className="metrics-strip" aria-label="Live system metrics">
      <div className="metrics-primary">{cells.slice(0, PRIMARY).map((c, i) => cell(c, i))}</div>
      <div className="metrics-secondary">
        {cells.slice(PRIMARY).map((c, i) => cell(c, i + PRIMARY))}
      </div>
    </dl>
  );
}
