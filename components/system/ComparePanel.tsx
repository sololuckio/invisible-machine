"use client";

import { useState } from "react";
import { UI_STRINGS } from "@/data/copy";
import { fmtHours, fmtInt, fmtMoney, fmtPct } from "@/lib/format";
import { runComparison } from "@/simulation/compare";
import type { Comparison, ComparisonMetrics, ScenarioId } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";

/**
 * The honest ledger: the same scenario simulated twice for the same number
 * of cycles — ignored versus managed by the intelligence loop. The preview
 * buttons load either ending into the live machine so the environment
 * itself shows the difference.
 */

interface Row {
  label: string;
  key: keyof ComparisonMetrics;
  format: (v: number) => string;
  /** Whether a higher value is the good direction. */
  higherIsBetter: boolean;
}

const ROWS: Row[] = [
  { label: "Orders completed", key: "completedOrders", format: fmtInt, higherIsBetter: true },
  { label: "Orders lost", key: "failedOrders", format: fmtInt, higherIsBetter: false },
  { label: "Fulfilment rate", key: "fulfilmentRate", format: fmtPct, higherIsBetter: true },
  { label: "Avg. lead time", key: "avgProcessingTime", format: fmtHours, higherIsBetter: false },
  {
    label: "Customer satisfaction",
    key: "customerSatisfaction",
    format: fmtPct,
    higherIsBetter: true,
  },
  { label: "Captured revenue", key: "capturedRevenue", format: fmtMoney, higherIsBetter: true },
  { label: "Operating cost", key: "operatingCost", format: fmtMoney, higherIsBetter: false },
  { label: "Unresolved issues", key: "unresolvedIssues", format: fmtInt, higherIsBetter: false },
  { label: "System health", key: "systemHealth", format: fmtPct, higherIsBetter: true },
];

export function ComparePanel({ scenarioId }: { scenarioId?: ScenarioId }) {
  const liveScenario = useSimStore((s) => s.sim.scenario);
  const loadPreview = useSimStore((s) => s.loadComparisonPreview);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [previewSide, setPreviewSide] = useState<"before" | "after" | null>(null);
  const scenario = scenarioId ?? liveScenario;

  return (
    <div className="panel compare-panel">
      <div className="panel-head">
        <p className="tech-label">Systems ledger — {scenario} scenario, two endings</p>
      </div>

      {!comparison ? (
        <div className="compare-idle">
          <p className="ai-hint">
            {`Both runs get identical demand and identical hours. One is left alone; the other
            gets the scan-and-apply loop three times. The ledger reports what actually happened —
            computed live, not staged.`}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setComparison(runComparison(scenario))}
          >
            {UI_STRINGS.runComparison}
          </button>
        </div>
      ) : (
        <>
          <table className="compare-table">
            <caption className="sr-only">
              Simulation results before and after intelligent intervention, {comparison.cycles}{" "}
              operational hours each
            </caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Ignored</th>
                <th scope="col">Managed</th>
                <th scope="col">
                  Shift
                  <span className="ledger-legend" aria-hidden="true">
                    {" "}
                    ▲ better
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const before = comparison.before[row.key];
                const after = comparison.after[row.key];
                const deltaPct =
                  Math.abs(before) > 0.01 ? ((after - before) / Math.abs(before)) * 100 : 0;
                const flat = Math.abs(deltaPct) < 0.5;
                const improved = row.higherIsBetter ? after >= before : after <= before;
                // The sign shows which way the number moved; the mark shows
                // whether that was a win. They disagree on every row where
                // lower is better — "orders lost, −44%" is the whole point of
                // the ledger — so the verdict cannot be left to colour alone.
                const verdict = flat ? "flat" : improved ? "good" : "bad";
                return (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.format(before)}</td>
                    <td>{row.format(after)}</td>
                    <td className={`ledger-delta delta-${verdict}`}>
                      <span className="ledger-delta-mark" aria-hidden="true">
                        {flat ? "=" : improved ? "▲" : "▼"}
                      </span>
                      <span className="ledger-delta-value">
                        {flat
                          ? "0%"
                          : `${deltaPct >= 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(0)}%`}
                      </span>
                      <span className="sr-only">
                        {flat ? " (unchanged)" : improved ? " (improved)" : " (worse)"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            className="compare-previews"
            role="group"
            aria-label="Load an ending into the live machine"
          >
            <p className="ai-hint">Load either ending into the live machine and watch:</p>
            <div className="compare-preview-buttons">
              <button
                type="button"
                className={`btn ${previewSide === "before" ? "btn-primary" : "btn-ghost"}`}
                aria-pressed={previewSide === "before"}
                onClick={() => {
                  loadPreview(scenario, "before");
                  setPreviewSide("before");
                }}
              >
                Watch the ignored system
              </button>
              <button
                type="button"
                className={`btn ${previewSide === "after" ? "btn-primary" : "btn-ghost"}`}
                aria-pressed={previewSide === "after"}
                onClick={() => {
                  loadPreview(scenario, "after");
                  setPreviewSide("after");
                }}
              >
                Watch the managed system
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
