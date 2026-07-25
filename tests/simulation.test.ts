import { describe, expect, it } from "vitest";
import { applyRecommendation } from "@/simulation/apply";
import { runComparison } from "@/simulation/compare";
import {
  createInitialState,
  effectiveCapacity,
  idealProcessingTime,
  runCycles,
  tickSim,
} from "@/simulation/engine";
import { FLOW_PATH, NODE_DEFS, NODE_MAP } from "@/simulation/nodes";
import { analyze } from "@/simulation/recommendations";
import { DEFAULT_SCENARIO, SCENARIOS } from "@/simulation/scenarios";
import type { ScenarioId, SimState } from "@/simulation/types";

function boot(id: ScenarioId, cycles = 0): SimState {
  const s = SCENARIOS[id];
  const state = createInitialState(id, s.controls, s.initialStock);
  return cycles > 0 ? runCycles(state, cycles) : state;
}

describe("engine fundamentals", () => {
  it("is deterministic: identical inputs produce identical trajectories", () => {
    const a = boot("viral", 90);
    const b = boot("viral", 90);
    expect(a).toEqual(b);
  });

  it("does not mutate the previous state", () => {
    const s0 = boot("balanced");
    const frozen = JSON.parse(JSON.stringify(s0));
    tickSim(s0, 1);
    expect(s0).toEqual(frozen);
  });

  it("conserves orders: completed + failed + queued ≈ incoming", () => {
    const s = boot("viral", 150);
    const m = s.metrics;
    const accounted = m.completedOrders + m.failedOrders + m.totalQueue;
    expect(accounted).toBeGreaterThan(m.incomingOrders * 0.97);
    expect(accounted).toBeLessThan(m.incomingOrders * 1.03);
  });

  it("keeps every metric finite and in range over a long run", () => {
    const s = boot("breakdown", 400);
    const m = s.metrics;
    for (const v of Object.values(m)) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(m.customerSatisfaction).toBeGreaterThanOrEqual(0);
    expect(m.customerSatisfaction).toBeLessThanOrEqual(100);
    expect(m.systemHealth).toBeGreaterThanOrEqual(0);
    expect(m.systemHealth).toBeLessThanOrEqual(100);
    expect(s.stock).toBeGreaterThanOrEqual(0);
    expect(s.stock).toBeLessThanOrEqual(100);
  });

  it("derives processing time as ideal time plus queue time", () => {
    const s = boot("balanced", 60);
    expect(s.metrics.avgProcessingTime).toBeCloseTo(
      idealProcessingTime() + s.metrics.avgQueueTime,
      6,
    );
  });

  it("automation raises effective capacity where it should", () => {
    const base = SCENARIOS.balanced.controls;
    const automated = { ...base, automation: 100 };
    expect(effectiveCapacity("payment", automated)).toBeGreaterThan(
      effectiveCapacity("payment", base) * 1.4,
    );
    // Revenue is a ledger, not a process — automation must not change it.
    expect(effectiveCapacity("revenue", automated)).toBe(effectiveCapacity("revenue", base));
  });
});

describe("node graph integrity", () => {
  it("upstream/downstream links are symmetric", () => {
    for (const def of NODE_DEFS) {
      for (const down of def.downstream) {
        expect(NODE_MAP[down].upstream).toContain(def.id);
      }
      for (const up of def.upstream) {
        expect(NODE_MAP[up].downstream).toContain(def.id);
      }
    }
  });

  it("the flow path is a connected chain", () => {
    for (let i = 0; i < FLOW_PATH.length - 1; i++) {
      expect(NODE_MAP[FLOW_PATH[i]].downstream).toContain(FLOW_PATH[i + 1]);
    }
  });
});

describe("scenario dynamics", () => {
  it("balanced business stays healthy with no bottleneck", () => {
    const s = boot("balanced", 150);
    expect(s.bottleneck).toBeNull();
    expect(s.metrics.systemHealth).toBeGreaterThan(72);
    expect(s.metrics.customerSatisfaction).toBeGreaterThan(70);
  });

  it("viral spike breaks at fulfilment, the narrowest chamber", () => {
    const s = boot("viral", 120);
    expect(s.bottleneck).toBe("fulfilment");
    expect(s.nodes.fulfilment.status).toBe("critical");
    expect(s.metrics.systemHealth).toBeLessThan(60);
    expect(s.metrics.trappedRevenue).toBeGreaterThan(0);
  });

  it("operational breakdown starves at inventory, a different constraint", () => {
    const s = boot("breakdown", 120);
    expect(s.bottleneck).toBe("inventory");
    expect(s.stock).toBeLessThan(10);
    expect(s.metrics.customerSatisfaction).toBeLessThan(60);
  });

  it("congestion propagates upstream from the constraint", () => {
    const s = boot("viral", 120);
    // Fulfilment's queue dwarfs everything downstream of it.
    expect(s.nodes.fulfilment.queue).toBeGreaterThan(s.nodes.delivery.queue * 3);
    // Support inherits the pain of poor delivery performance.
    expect(s.metrics.unresolvedIssues).toBeGreaterThan(
      boot("balanced", 120).metrics.unresolvedIssues,
    );
  });

  it("reset produces a clean state", () => {
    const dirty = boot("viral", 200);
    expect(dirty.metrics.totalQueue).toBeGreaterThan(100);
    const fresh = createInitialState(
      DEFAULT_SCENARIO,
      SCENARIOS[DEFAULT_SCENARIO].controls,
      SCENARIOS[DEFAULT_SCENARIO].initialStock,
    );
    expect(fresh.tick).toBe(0);
    expect(fresh.metrics.totalQueue).toBe(0);
    expect(fresh.metrics.completedOrders).toBe(0);
    expect(fresh.bottleneck).toBeNull();
  });
});

describe("recommendation engine", () => {
  it("is deterministic for a given state", () => {
    const s = boot("viral", 100);
    const a = analyze(s);
    const b = analyze(s);
    expect(a).toEqual(b);
  });

  it("targets the fulfilment constraint under a viral spike", () => {
    const a = analyze(boot("viral", 100));
    expect(a.bottleneck).toBe("fulfilment");
    expect(a.recommendations[0].id).toBe("add-fulfilment-capacity");
    expect(a.recommendations[0].evidence).toMatch(/\d/);
  });

  it("targets stock during an operational breakdown — different state, different advice", () => {
    const a = analyze(boot("breakdown", 100));
    expect(a.recommendations[0].id).toBe("increase-safety-stock");
  });

  it("gives calm-state advice when nothing is on fire", () => {
    const a = analyze(boot("balanced", 120));
    expect(a.recommendations[0].id).toBe("raise-automation-baseline");
  });

  it("runs out rather than re-offering advice already taken", () => {
    // Regression: a fallback used to re-offer the entire list once everything
    // had been applied, so the console showed Apply buttons that could not
    // change anything — clicking them forever did nothing at all.
    let s = createInitialState("viral", SCENARIOS.viral.controls, SCENARIOS.viral.initialStock);
    s = runCycles(s, 100);
    for (let i = 0; i < 12; i++) {
      const { recommendations } = analyze(s);
      for (const rec of recommendations) {
        expect(
          s.appliedRecommendations,
          `re-offered "${rec.id}" after it was applied`,
        ).not.toContain(rec.id);
      }
      if (recommendations.length === 0) break;
      s = applyRecommendation(s, recommendations[0]);
      s = runCycles(s, 5);
    }
    // Everything the engine can see for this state has now been taken.
    const exhausted = analyze(s);
    for (const rec of exhausted.recommendations) {
      expect(s.appliedRecommendations).not.toContain(rec.id);
    }
  });

  it("does not repeat advice that has already been applied", () => {
    let s = boot("viral", 100);
    const first = analyze(s).recommendations[0];
    s = applyRecommendation(s, first);
    s = runCycles(s, 30);
    const next = analyze(s);
    expect(next.recommendations.map((r) => r.id)).not.toContain(first.id);
  });

  it("applying a recommendation changes the system and helps it recover", () => {
    let managed = boot("viral", 100);
    let ignored = boot("viral", 100);
    for (let round = 0; round < 3; round++) {
      const recs = analyze(managed).recommendations;
      if (recs.length > 0) managed = applyRecommendation(managed, recs[0]);
      managed = runCycles(managed, 40);
      ignored = runCycles(ignored, 40);
    }
    expect(managed.metrics.systemHealth).toBeGreaterThan(ignored.metrics.systemHealth);
    expect(managed.metrics.totalQueue).toBeLessThan(ignored.metrics.totalQueue);
  });

  it("clamps controls and never applies the same recommendation twice", () => {
    let s = boot("viral", 100);
    const rec = analyze(s).recommendations[0];
    s = applyRecommendation(s, rec);
    const once = s;
    s = applyRecommendation(s, rec);
    expect(s).toBe(once);
    for (const v of Object.values(s.controls)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("before/after comparison", () => {
  it("the optimised run beats the unmanaged run on a stressed scenario", () => {
    const c = runComparison("viral");
    expect(c.after.customerSatisfaction).toBeGreaterThan(c.before.customerSatisfaction);
    expect(c.after.systemHealth).toBeGreaterThan(c.before.systemHealth);
    expect(c.after.completedOrders).toBeGreaterThan(c.before.completedOrders * 0.95);
    expect(c.after.fulfilmentRate).toBeGreaterThan(c.before.fulfilmentRate);
  });

  it("is deterministic", () => {
    expect(runComparison("breakdown")).toEqual(runComparison("breakdown"));
  });

  it("reports sane percentages", () => {
    for (const id of ["balanced", "viral", "breakdown"] as const) {
      const c = runComparison(id);
      for (const side of [c.before, c.after]) {
        expect(side.fulfilmentRate).toBeGreaterThanOrEqual(0);
        expect(side.fulfilmentRate).toBeLessThanOrEqual(100);
        expect(side.customerSatisfaction).toBeGreaterThanOrEqual(0);
        expect(side.customerSatisfaction).toBeLessThanOrEqual(100);
      }
    }
  });
});
