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
 * Later analyses are quick. The long sweep is a reveal, and a reveal is only
 * a reveal once — charging it again on every use turns the console's own
 * cinematography into a toll.
 */
const RESCAN_MS = 520;

/**
 * The intelligence console. One button starts a real analysis of the live
 * simulation; the recommendations shown are the engine's, not scripted.
 *
 * Applying advice does **not** close the panel. The analysis is a pure
 * function of simulation state and already drops advice that has been taken,
 * so acting on one recommendation re-ranks the rest in place instead of
 * emptying the console and making the visitor start the whole cycle again.
 * Taken advice collapses into a single line above the list, which keeps the
 * panel the same height on a phone no matter how much has been applied.
 */
export function AIPanel() {
  const scanStatus = useUIStore((s) => s.scanStatus);
  const startScan = useUIStore((s) => s.startScan);
  const completeScan = useUIStore((s) => s.completeScan);
  const analysis = useSimStore((s) => s.analysis);
  const applyRec = useSimStore((s) => s.applyRec);
  const stale = useSimStore((s) => s.analysisStale);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const analyse = (first: boolean) => {
    if (scanStatus === "scanning") return;
    startScan();
    const reduced = useUIStore.getState().reducedMotion;
    const wait = reduced ? SCAN_MS_REDUCED : first ? SCAN_MS : RESCAN_MS;
    timer.current = setTimeout(() => {
      useSimStore.getState().runAnalysis();
      completeScan();
    }, wait);
  };

  return (
    <div className="panel ai-panel" aria-live="off">
      <div className="panel-head">
        <p className="tech-label">Intelligence layer</p>
      </div>

      {scanStatus === "idle" && (
        <div className="ai-idle">
          <p className="ai-hint">
            The scan reads the live state — queues, stock, error rates, satisfaction — and proposes
            the intervention with the most leverage. Nothing here is scripted.
          </p>
          <button
            type="button"
            className="btn btn-primary ai-activate"
            onClick={() => analyse(true)}
          >
            <IconPulse /> {UI_STRINGS.activateIntelligence}
          </button>
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

          <AppliedSummary />

          {analysis.recommendations.length > 0 ? (
            <ol className="ai-recs">
              {analysis.recommendations.map((rec, i) => (
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
                    className="btn btn-primary"
                    onClick={() => applyRec(rec)}
                  >
                    {UI_STRINGS.applyRecommendation}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ai-hint ai-exhausted">
              Every intervention the engine can see has been applied. Watch the machine settle, or
              push the dials somewhere new and analyse again.
            </p>
          )}

          {/* One action, one place. It only asks to be pressed once the state
              it was computed from has actually moved. */}
          <div className="ai-refresh">
            <button
              type="button"
              className={`btn ${stale ? "btn-primary" : "btn-ghost"}`}
              onClick={() => analyse(false)}
            >
              {UI_STRINGS.reAnalyse}
            </button>
            {stale && (
              <span className="ai-stale" role="status">
                {UI_STRINGS.stateMoved}
              </span>
            )}
          </div>

          <p className="ai-signature">
            {SIGNATURE_LINES.automation[0]} <em>{SIGNATURE_LINES.automation[1]}</em>
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Advice already taken, as one line. Kept out of the recommendation list so
 * the panel stays the same height however much has been applied — the
 * consequences are the before/after ledger's job, not this console's.
 */
function AppliedSummary() {
  const applied = useSimStore((s) => s.sim.appliedRecommendations);
  const history = useSimStore((s) => s.appliedHistory);
  if (applied.length === 0) return null;
  const names = applied.map((id) => history[id] ?? id);
  return (
    <p className="ai-applied-summary">
      <span className="ai-applied-check" aria-hidden="true">
        ✓
      </span>
      <span>
        <span className="ai-applied-label">Applied</span> {names.join(" · ")}
      </span>
    </p>
  );
}
