"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNATURE_LINES, UI_STRINGS } from "@/data/copy";
import { fmtMoney, fmtPct } from "@/lib/format";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { IconPulse } from "@/components/ui/icons";

/** Must match ScanEffects' sweep so sight and state agree. */
const SCAN_MS = 2600;
const SCAN_MS_REDUCED = 500;
/** How long the machine is left to visibly answer each intervention. */
const STEP_MS = 2300;
const STEP_MS_REDUCED = 400;
/** Stop once the machine is genuinely well, rather than pulling every lever. */
const HEALTHY_ENOUGH = 88;
/** Backstop so a pathological state can never loop forever. */
const MAX_STEPS = 16;

interface Step {
  title: string;
  node: string;
}

/**
 * The intelligence console.
 *
 * One click, then it works and you watch. It scans, takes the highest-leverage
 * intervention it can find, gives the machine time to answer, reads the result
 * and decides again — until the system is well or it runs out of levers.
 *
 * It used to need a click per intervention, which quietly inverted the
 * chapter's own claim: a visitor clicking Apply fifteen times to drag a broken
 * system back to health *is* the intelligence, and the machine is just a form.
 * Watching it diagnose, act, and re-read its own result is the thing worth
 * showing.
 *
 * Every step is real. Each one re-reads live simulation state through the same
 * deterministic engine — nothing is scripted, sequenced in advance or played
 * back, and each decision comes from what the machine looks like at that
 * moment rather than from a plan drawn up before any of it happened.
 */
export function AIPanel() {
  const scanStatus = useUIStore((s) => s.scanStatus);
  const startScan = useUIStore((s) => s.startScan);
  const completeScan = useUIStore((s) => s.completeScan);
  const resetScan = useUIStore((s) => s.resetScan);
  const analysis = useSimStore((s) => s.analysis);
  const health = useSimStore((s) => s.sim.metrics.systemHealth);
  const trapped = useSimStore((s) => s.sim.metrics.trappedRevenue);

  const [working, setWorking] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [before, setBefore] = useState<{ health: number; trapped: number } | null>(null);
  const [done, setDone] = useState(false);

  const cancelled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(
    () => () => {
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(setTimeout(resolve, ms));
    });

  // Anything that clears the analysis — changing scenario, resetting the sim —
  // leaves scanStatus saying "complete" with nothing to show, which rendered a
  // panel with no way back into it.
  const orphaned = scanStatus === "complete" && !analysis && !working;
  useEffect(() => {
    if (!orphaned) return;
    resetScan();
    setDone(false);
    setSteps([]);
  }, [orphaned, resetScan]);

  const run = useCallback(async () => {
    cancelled.current = false;
    clearTimers();

    const store = useSimStore.getState();
    const reduced = useUIStore.getState().reducedMotion;
    // A paused machine cannot answer an intervention, so there would be
    // nothing to watch. Take it off pause rather than silently doing nothing.
    if (!store.running) store.setRunning(true);

    setWorking(true);
    setDone(false);
    setSteps([]);
    setBefore({
      health: store.sim.metrics.systemHealth,
      trapped: store.sim.metrics.trappedRevenue,
    });

    startScan();
    await wait(reduced ? SCAN_MS_REDUCED : SCAN_MS);
    if (cancelled.current) {
      setWorking(false);
      return;
    }
    useSimStore.getState().runAnalysis();
    completeScan();

    for (let i = 0; i < MAX_STEPS; i++) {
      if (cancelled.current) break;
      const state = useSimStore.getState();
      const next = state.runAnalysis().recommendations[0];
      if (!next) break;
      if (state.sim.metrics.systemHealth >= HEALTHY_ENOUGH) break;

      setSteps((prev) => [...prev, { title: next.title, node: NODE_MAP[next.targetNode].tag }]);
      state.applyRec(next);
      await wait(reduced ? STEP_MS_REDUCED : STEP_MS);
    }

    if (!cancelled.current) {
      useSimStore.getState().runAnalysis();
      setDone(true);
    }
    setWorking(false);
  }, [startScan, completeScan]);

  const stop = () => {
    cancelled.current = true;
    clearTimers();
    setWorking(false);
    setDone(true);
  };

  const showIdle = (scanStatus === "idle" || orphaned) && !working;

  return (
    <div className="panel ai-panel" aria-live="off">
      <div className="panel-head">
        <p className="tech-label">Intelligence layer</p>
        {working && (
          <button type="button" className="btn btn-ghost" onClick={stop}>
            {UI_STRINGS.stopIntelligence}
          </button>
        )}
      </div>

      {showIdle && (
        <div className="ai-idle">
          <p className="ai-hint">
            One click. The intelligence reads the live state — queues, stock, error rates,
            satisfaction — takes the highest-leverage intervention it can find, waits for the
            machine to answer, then reads it again and decides afresh. Nothing here is scripted.
          </p>
          <button type="button" className="btn btn-primary ai-activate" onClick={run}>
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

      {scanStatus === "complete" && analysis && !showIdle && (
        <div className="ai-results">
          <p className="ai-narrative">{analysis.narrative}</p>

          {(working || steps.length > 0) && (
            <ol className="ai-steps" aria-label="Interventions taken">
              {steps.map((step, i) => (
                <li key={`${step.title}-${i}`} className="ai-step">
                  <span className="ai-step-mark" aria-hidden="true">
                    ✓
                  </span>
                  <span className="ai-step-body">
                    <span className="tech-label">{step.node}</span>
                    {step.title}
                  </span>
                </li>
              ))}
              {working && (
                <li className="ai-step is-thinking" role="status">
                  <span className="ai-step-mark" aria-hidden="true" />
                  <span className="ai-step-body">{UI_STRINGS.intelligenceWorking}…</span>
                </li>
              )}
            </ol>
          )}

          {done && before && (
            <div className="ai-outcome">
              <p className="tech-label">Result</p>
              <dl className="ai-outcome-grid">
                <div>
                  <dt>System health</dt>
                  <dd>
                    {fmtPct(Math.round(before.health))} <span aria-hidden="true">→</span>{" "}
                    <strong>{fmtPct(Math.round(health))}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Trapped revenue</dt>
                  <dd>
                    {fmtMoney(before.trapped)} <span aria-hidden="true">→</span>{" "}
                    <strong>{fmtMoney(trapped)}</strong>
                  </dd>
                </div>
              </dl>
              <button type="button" className="btn btn-ghost" onClick={run}>
                {UI_STRINGS.runIntelligenceAgain}
              </button>
            </div>
          )}

          <p className="ai-signature">
            {SIGNATURE_LINES.automation[0]} <em>{SIGNATURE_LINES.automation[1]}</em>
          </p>
        </div>
      )}
    </div>
  );
}
