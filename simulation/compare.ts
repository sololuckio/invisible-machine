import { applyRecommendation } from "./apply";
import { createInitialState, runCycles } from "./engine";
import { analyze } from "./recommendations";
import { SCENARIOS } from "./scenarios";
import type { Comparison, ComparisonMetrics, ScenarioId, SimState } from "./types";

const WARMUP = 40;
const INTERVENTION_ROUNDS = 3;
const ROUND_LENGTH = 30;
const TOTAL = WARMUP + INTERVENTION_ROUNDS * ROUND_LENGTH + 10; // 140 cycles

function extract(state: SimState): ComparisonMetrics {
  const m = state.metrics;
  return {
    completedOrders: m.completedOrders,
    failedOrders: m.failedOrders,
    avgProcessingTime: m.avgProcessingTime,
    fulfilmentRate: m.incomingOrders > 0 ? (m.completedOrders / m.incomingOrders) * 100 : 100,
    customerSatisfaction: m.customerSatisfaction,
    operatingCost: m.operatingCost,
    capturedRevenue: m.capturedRevenue,
    unresolvedIssues: m.unresolvedIssues,
    systemHealth: m.systemHealth,
  };
}

/**
 * Headless before/after: the same scenario run twice for the same number of
 * cycles — once untouched, once with the AI loop (scan → apply best
 * recommendation → let the system respond) run three times.
 * Fully deterministic, so the comparison is honest and repeatable.
 */
export function runComparison(scenarioId: ScenarioId): Comparison {
  const scenario = SCENARIOS[scenarioId];

  let before = createInitialState(scenarioId, scenario.controls, scenario.initialStock);
  before = runCycles(before, TOTAL);

  let after = createInitialState(scenarioId, scenario.controls, scenario.initialStock);
  after = runCycles(after, WARMUP);
  for (let round = 0; round < INTERVENTION_ROUNDS; round++) {
    const analysis = analyze(after);
    if (analysis.recommendations.length > 0) {
      after = applyRecommendation(after, analysis.recommendations[0]);
    }
    after = runCycles(after, ROUND_LENGTH);
  }
  after = runCycles(after, TOTAL - WARMUP - INTERVENTION_ROUNDS * ROUND_LENGTH);

  return { before: extract(before), after: extract(after), cycles: TOTAL };
}
