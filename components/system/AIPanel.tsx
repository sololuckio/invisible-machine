"use client";

import { useEffect, useRef } from "react";
import { SIGNATURE_LINES, UI_STRINGS } from "@/data/copy";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { IconPulse } from "@/components/ui/icons";

/** Must match ScanEffects' sweep so sight and state agree. */
const SCAN_MS = 2600;
const SCAN_MS_REDUCED = 500;

/**
 * The intelligence console. One button starts a real analysis of the live
 * simulation; the recommendations shown are the engine's, not scripted.
 */
export function AIPanel() {
  const scanStatus = useUIStore((s) => s.scanStatus);
  const startScan = useUIStore((s) => s.startScan);
  const completeScan = useUIStore((s) => s.completeScan);
  const resetScan = useUIStore((s) => s.resetScan);
  const analysis = useSimStore((s) => s.analysis);
  const applied = useSimStore((s) => s.sim.appliedRecommendations);
  const applyRec = useSimStore((s) => s.applyRec);
  const lastApplied = useSimStore((s) => s.lastAppliedRec);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const activate = () => {
    if (scanStatus === "scanning") return;
    startScan();
    const reduced = useUIStore.getState().reducedMotion;
    timer.current = setTimeout(
      () => {
        useSimStore.getState().runAnalysis();
        completeScan();
      },
      reduced ? SCAN_MS_REDUCED : SCAN_MS,
    );
  };

  return (
    <div className="panel ai-panel" aria-live="off">
      <div className="panel-head">
        <p className="tech-label">Intelligence layer</p>
        {scanStatus === "complete" && (
          <button type="button" className="btn btn-ghost" onClick={resetScan}>
            Re-scan
          </button>
        )}
      </div>

      {scanStatus === "idle" && (
        <div className="ai-idle">
          <p className="ai-hint">
            The scan reads the live state — queues, stock, error rates, satisfaction — and proposes
            the intervention with the most leverage. Nothing here is scripted.
          </p>
          <button type="button" className="btn btn-primary ai-activate" onClick={activate}>
            <IconPulse /> {UI_STRINGS.activateIntelligence}
          </button>
          {lastApplied && (
            <p className="ai-applied-note">
              Last applied: <strong>{lastApplied.title}</strong> — watch{" "}
              {NODE_MAP[lastApplied.targetNode].name.toLowerCase()} respond, then scan again.
            </p>
          )}
        </div>
      )}

      {scanStatus === "scanning" && (
        <div className="ai-scanning" role="status">
          <div className="ai-scanline" aria-hidden="true" />
          <p>{UI_STRINGS.scanning}</p>
        </div>
      )}

      {scanStatus === "complete" && analysis && (
        <div className="ai-results">
          <p className="ai-narrative">{analysis.narrative}</p>
          <ol className="ai-recs">
            {analysis.recommendations.map((rec, i) => {
              const isApplied = applied.includes(rec.id);
              return (
                <li key={rec.id} className={`ai-rec${i === 0 ? " is-primary" : ""}`}>
                  <div className="ai-rec-head">
                    <span className="tech-label">
                      {i === 0 ? "PRIMARY" : `OPTION ${i + 1}`} · {NODE_MAP[rec.targetNode].tag}
                    </span>
                    <h4>{rec.title}</h4>
                  </div>
                  <p className="ai-rec-evidence">{rec.evidence}</p>
                  <p className="ai-rec-detail">{rec.detail}</p>
                  <button
                    type="button"
                    className={`btn ${isApplied ? "btn-ghost" : "btn-primary"}`}
                    disabled={isApplied}
                    onClick={() => {
                      // Applying changes the state, so the console returns to
                      // idle: watch the machine react, then scan again.
                      applyRec(rec);
                      resetScan();
                    }}
                  >
                    {isApplied ? UI_STRINGS.applied : UI_STRINGS.applyRecommendation}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="ai-signature">
            {SIGNATURE_LINES.automation[0]} <em>{SIGNATURE_LINES.automation[1]}</em>
          </p>
        </div>
      )}
    </div>
  );
}
