import { create } from "zustand";
import { applyRecommendation } from "@/simulation/apply";
import { runComparison } from "@/simulation/compare";
import { createInitialState, runCycles, tickSim } from "@/simulation/engine";
import { analyze } from "@/simulation/recommendations";
import { DEFAULT_SCENARIO, SCENARIOS } from "@/simulation/scenarios";
import type {
  Analysis,
  Comparison,
  Controls,
  NodeId,
  Recommendation,
  ScenarioId,
  SimState,
} from "@/simulation/types";

interface SimStore {
  sim: SimState;
  running: boolean;
  /** True once the visitor has taken manual control of the dials. */
  userTouched: boolean;
  analysis: Analysis | null;
  comparison: Comparison | null;
  /** Monotonic counter bumped when a recommendation is applied (drives FX). */
  appliedPulse: number;
  /** The most recently applied recommendation (drives targeted FX). */
  lastAppliedRec: Recommendation | null;
  /**
   * True when the dials have moved since the analysis was computed, so the
   * panel can say the numbers are behind without throwing them away.
   */
  analysisStale: boolean;
  /**
   * What the machine looked like when the analysis was computed. A reading
   * goes out of date because the *machine* changed, not because a dial moved:
   * dragging a control has no consequences for many cycles, so refreshing on
   * the control change alone captures the state before anything happened.
   */
  analysisBasis: { bottleneck: NodeId | null; health: number; queue: number } | null;
  /**
   * Titles of applied advice, by id. The analysis drops advice once it has
   * been taken, so its wording is gone from state the moment it is applied —
   * this keeps enough to name it in the console's one-line history.
   */
  appliedHistory: Record<string, string>;

  tick: () => void;
  setRunning: (running: boolean) => void;
  /** Visitor-driven control change (marks the sim as user-owned). */
  setControl: (key: keyof Controls, value: number) => void;
  /** Guided-narrative control change (does not claim ownership). */
  directControls: (partial: Partial<Controls>) => void;
  loadScenario: (id: ScenarioId) => void;
  reset: () => void;
  runAnalysis: () => Analysis;
  applyRec: (rec: Recommendation) => void;
  ensureComparison: () => Comparison;
  /**
   * Load one ending of the before/after story into the live machine:
   * the scenario fast-forwarded headlessly, either ignored or managed by
   * the analysis loop, then handed over to the live clock.
   */
  loadComparisonPreview: (scenario: ScenarioId, side: "before" | "after") => void;
}

function freshState(id: ScenarioId): SimState {
  const s = SCENARIOS[id];
  return createInitialState(id, s.controls, s.initialStock);
}

export const useSimStore = create<SimStore>()((set, get) => ({
  sim: freshState(DEFAULT_SCENARIO),
  running: true,
  userTouched: false,
  analysis: null,
  comparison: null,
  appliedPulse: 0,
  lastAppliedRec: null,
  analysisStale: false,
  analysisBasis: null,
  appliedHistory: {},

  tick: () => {
    const { sim, running } = get();
    if (!running) return;
    set({ sim: tickSim(sim, 1) });
  },

  setRunning: (running) => set({ running }),

  setControl: (key, value) => {
    const { sim, analysis } = get();
    set({
      userTouched: true,
      sim: { ...sim, controls: { ...sim.controls, [key]: value } },
      // Moving a dial dates the advice. Flag it rather than clearing it —
      // wiping the panel every time a slider twitches is what made the
      // intelligence console feel like it kept resetting itself.
      analysisStale: analysis !== null,
    });
  },

  directControls: (partial) => {
    const { sim } = get();
    set({ sim: { ...sim, controls: { ...sim.controls, ...partial } } });
  },

  loadScenario: (id) =>
    set({
      sim: freshState(id),
      analysis: null,
      comparison: null,
      userTouched: false,
      analysisStale: false,
      analysisBasis: null,
      appliedHistory: {},
    }),

  reset: () => {
    const { sim } = get();
    set({
      sim: freshState(sim.scenario),
      analysis: null,
      comparison: null,
      userTouched: false,
      analysisStale: false,
      analysisBasis: null,
      appliedHistory: {},
    });
  },

  runAnalysis: () => {
    const { sim } = get();
    const analysis = analyze(sim);
    set({
      analysis,
      analysisStale: false,
      analysisBasis: {
        bottleneck: sim.bottleneck,
        health: sim.metrics.systemHealth,
        queue: sim.metrics.totalQueue,
      },
    });
    return analysis;
  },

  applyRec: (rec) => {
    const { sim, appliedPulse } = get();
    const next = applyRecommendation(sim, rec);
    set({
      sim: next,
      appliedPulse: appliedPulse + 1,
      lastAppliedRec: rec,
      appliedHistory: { ...get().appliedHistory, [rec.id]: rec.title },
      // Re-read the new state immediately instead of blanking the panel. The
      // analysis is a pure function of the simulation and already drops advice
      // that has been applied, so the remaining options simply re-rank in
      // place — acting on one no longer costs you the other two.
      analysis: analyze(next),
      analysisStale: false,
      analysisBasis: {
        bottleneck: next.bottleneck,
        health: next.metrics.systemHealth,
        queue: next.metrics.totalQueue,
      },
    });
  },

  ensureComparison: () => {
    const existing = get().comparison;
    if (existing) return existing;
    const comparison = runComparison(get().sim.scenario);
    set({ comparison });
    return comparison;
  },

  loadComparisonPreview: (scenario, side) => {
    let s = freshState(scenario);
    if (side === "before") {
      s = runCycles(s, 100);
    } else {
      s = runCycles(s, 40);
      for (let round = 0; round < 3; round++) {
        const recs = analyze(s).recommendations;
        if (recs.length > 0) s = applyRecommendation(s, recs[0]);
        s = runCycles(s, 30);
      }
    }
    set({
      sim: s,
      userTouched: true,
      analysis: null,
      analysisStale: false,
      running: true,
    });
  },
}));
