import { FLOW_PATH, NODE_DEFS, NODE_MAP } from "./nodes";
import type {
  Controls,
  Metrics,
  NodeId,
  NodeState,
  NodeStatus,
  ScenarioId,
  SimState,
} from "./types";

/**
 * The engine models one e-commerce order pipeline as a discrete-time queueing
 * network. One cycle ≈ one operational hour, compressed. Everything is
 * deterministic: identical inputs always yield identical trajectories.
 */

export const AVERAGE_ORDER_VALUE = 48;
/** Stock % consumed per allocated order. */
const STOCK_PER_ORDER = 0.05;
/** Smoothing factor for rate/percentage metrics. */
const EMA = 0.12;

/** How strongly each node benefits from automation (fraction of capacity gained at 100%). */
const AUTOMATION_BOOST: Record<NodeId, number> = {
  acquisition: 0.1,
  checkout: 0.3,
  payment: 0.8,
  inventory: 0.2,
  fulfilment: 0.5,
  delivery: 0.4,
  support: 0.8,
  revenue: 0,
};

/** Base error rates (fraction of processed orders that fail) and how much automation suppresses them. */
const ERROR_BASE: Partial<Record<NodeId, { rate: number; autoRelief: number }>> = {
  payment: { rate: 0.05, autoRelief: 0.75 },
  fulfilment: { rate: 0.04, autoRelief: 0.6 },
  delivery: { rate: 0.025, autoRelief: 0.5 },
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic demand ripple — organic-looking, but reproducible. */
function demandRipple(tick: number): number {
  return 1 + 0.12 * Math.sin(tick * 0.9) + 0.06 * Math.sin(tick * 2.3);
}

/** Effective capacity of a node for the given controls, in orders per cycle. */
export function effectiveCapacity(
  id: NodeId,
  controls: Controls,
  tweaks: Partial<Record<NodeId, number>> = {},
): number {
  const def = NODE_MAP[id];
  const auto = controls.automation / 100;
  let mult: number;
  switch (id) {
    case "acquisition":
      mult = 1;
      break;
    case "checkout":
      mult = 0.4 + (controls.speed / 100) * 0.9;
      break;
    case "payment":
      mult = 0.35 + controls.speed / 100;
      break;
    case "inventory":
      mult = 0.5 + (controls.speed / 100) * 0.6;
      break;
    case "fulfilment":
      mult = 0.25 + controls.staff / 100;
      break;
    case "delivery":
      mult = 1;
      break;
    case "support":
      mult = controls.support / 100;
      break;
    case "revenue":
      mult = 1;
      break;
  }
  const tweak = tweaks[id] ?? 1;
  return def.baseCapacity * mult * (1 + auto * AUTOMATION_BOOST[id]) * tweak;
}

export function nodeErrorRate(id: NodeId, controls: Controls): number {
  const base = ERROR_BASE[id];
  if (!base) return 0;
  return base.rate * (1 - (controls.automation / 100) * base.autoRelief);
}

function statusFor(utilization: number, pressure: number, throughput: number): NodeStatus {
  if (pressure > 3) return "critical";
  if (pressure > 1 || utilization > 0.92) return "strained";
  if (throughput < 0.25 && utilization < 0.05) return "idle";
  return "nominal";
}

function blankNode(id: NodeId): NodeState {
  return {
    id,
    capacity: 0,
    load: 0,
    queue: 0,
    throughput: 0,
    utilization: 0,
    pressure: 0,
    errorRate: 0,
    status: "idle",
    processedTotal: 0,
  };
}

function blankMetrics(): Metrics {
  return {
    incomingOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    arrivalRate: 0,
    completionRate: 0,
    avgProcessingTime: idealProcessingTime(),
    avgQueueTime: 0,
    customerSatisfaction: 92,
    deliveryPerformance: 100,
    operatingCostRate: 0,
    operatingCost: 0,
    capturedRevenue: 0,
    potentialRevenue: 0,
    trappedRevenue: 0,
    unresolvedIssues: 0,
    systemHealth: 96,
    totalQueue: 0,
  };
}

export function idealProcessingTime(): number {
  return FLOW_PATH.reduce((sum, id) => sum + NODE_MAP[id].baseTime, 0);
}

export function createInitialState(
  scenario: ScenarioId,
  controls: Controls,
  initialStock: number,
): SimState {
  const nodes = Object.fromEntries(NODE_DEFS.map((n) => [n.id, blankNode(n.id)])) as Record<
    NodeId,
    NodeState
  >;
  return {
    tick: 0,
    scenario,
    controls: { ...controls },
    nodes,
    stock: initialStock,
    metrics: blankMetrics(),
    bottleneck: null,
    tweaks: {},
    appliedRecommendations: [],
  };
}

/**
 * Advance the simulation by `dt` cycles. Pure: returns a new state, never
 * mutates the input.
 */
export function tickSim(prev: SimState, dt = 1): SimState {
  const { controls, tweaks } = prev;
  const tick = prev.tick + dt;
  const auto = controls.automation / 100;

  const nodes = Object.fromEntries(NODE_DEFS.map((n) => [n.id, { ...prev.nodes[n.id] }])) as Record<
    NodeId,
    NodeState
  >;

  // ---- Arrivals -----------------------------------------------------------
  // demand 0–100 → 0–60 orders per cycle, with a deterministic ripple.
  const arrivals =
    (controls.demand / 100) * 60 * (controls.demand > 5 ? demandRipple(tick) : 1) * dt;
  nodes.acquisition.queue += arrivals;

  let stock = prev.stock;
  let failedThisCycle = 0;
  let abandonedThisCycle = 0;
  let newIssues = 0;
  let completedThisCycle = 0;

  // Customers are not infinitely patient: the deeper a backlog, the more
  // queued orders are cancelled each cycle. This is what "lost orders" means.
  const abandonFrom = (node: NodeState): number => {
    const rate = clamp(0.004 * node.pressure, 0, 0.06);
    const abandoned = node.queue * rate * dt;
    node.queue = Math.max(0, node.queue - abandoned);
    return abandoned;
  };

  // ---- Process the main pipeline, upstream → downstream -------------------
  for (let i = 0; i < FLOW_PATH.length; i++) {
    const id = FLOW_PATH[i];
    const node = nodes[id];
    const cap = effectiveCapacity(id, controls, tweaks) * dt;

    let processed = Math.min(node.queue, cap);
    if (id === "inventory") {
      // Allocation is also limited by physical stock; stock replenishes each
      // cycle based on the inventory control (automation improves reordering).
      const replenish = (controls.inventory / 100) * 3 * (1 + auto * 0.5) * dt;
      stock = clamp(stock + replenish, 0, 100);
      const allowedByStock = stock / STOCK_PER_ORDER;
      processed = Math.min(processed, allowedByStock);
      stock = clamp(stock - processed * STOCK_PER_ORDER, 0, 100);
    }

    const errRate = nodeErrorRate(id, controls);
    const failed = processed * errRate;
    const passed = processed - failed;

    node.queue = Math.max(0, node.queue - processed);
    node.load = i === 0 ? arrivals / dt : nodes[FLOW_PATH[i - 1]].throughput;
    node.throughput = processed / dt;
    node.capacity = cap / dt;
    node.utilization = node.capacity > 0 ? node.load / node.capacity : 0;
    node.pressure = node.capacity > 0 ? node.queue / node.capacity : 0;
    node.errorRate = errRate;
    node.processedTotal += processed;
    node.status = statusFor(node.utilization, node.pressure, node.throughput);

    failedThisCycle += failed;
    newIssues += failed * 0.9;

    const abandoned = abandonFrom(node);
    abandonedThisCycle += abandoned;
    newIssues += abandoned * 0.5;

    if (id === "revenue") {
      completedThisCycle = passed;
    } else {
      const next = FLOW_PATH[i + 1];
      nodes[next].queue += passed;
    }
  }

  // ---- Metrics ------------------------------------------------------------
  const m = { ...prev.metrics };
  const flowNodes = FLOW_PATH.map((id) => nodes[id]);
  const totalQueue = flowNodes.reduce((s, n) => s + n.queue, 0);

  m.incomingOrders += arrivals;
  m.completedOrders += completedThisCycle;
  m.arrivalRate = lerp(m.arrivalRate, arrivals / dt, EMA);
  m.completionRate = lerp(m.completionRate, completedThisCycle / dt, EMA);
  m.totalQueue = totalQueue;

  // ---- Support: failures + lateness become conversations ------------------
  const supportNode = nodes.support;
  const latePressure = Math.max(0, 100 - m.deliveryPerformance) * 0.02 * dt;
  const deflected = (newIssues + latePressure) * (1 - auto * 0.55);
  supportNode.queue += deflected;
  const supCap = effectiveCapacity("support", controls, tweaks) * dt;
  const resolved = Math.min(supportNode.queue, supCap);
  supportNode.queue = Math.max(0, supportNode.queue - resolved);
  supportNode.load = deflected / dt;
  supportNode.throughput = resolved / dt;
  supportNode.capacity = supCap / dt;
  supportNode.utilization = supportNode.capacity > 0 ? supportNode.load / supportNode.capacity : 1;
  supportNode.pressure =
    supportNode.capacity > 0 ? supportNode.queue / supportNode.capacity : supportNode.queue;
  supportNode.processedTotal += resolved;
  supportNode.status = statusFor(
    supportNode.utilization,
    supportNode.pressure,
    supportNode.throughput,
  );
  // Unanswered customers eventually give up too (churn, not lost orders).
  abandonFrom(supportNode);
  m.unresolvedIssues = supportNode.queue;
  m.failedOrders += failedThisCycle + abandonedThisCycle;

  // ---- Times (hours) ------------------------------------------------------
  const queueTime = flowNodes.reduce((s, n) => s + (n.capacity > 0 ? n.queue / n.capacity : 0), 0);
  m.avgQueueTime = lerp(m.avgQueueTime, queueTime, EMA);
  m.avgProcessingTime = idealProcessingTime() + m.avgQueueTime;

  // ---- Money --------------------------------------------------------------
  const costRate =
    40 +
    controls.staff * 1.1 +
    controls.support * 0.6 +
    controls.speed * 0.5 +
    controls.inventory * 0.35 +
    controls.automation * 0.9;
  m.operatingCostRate = costRate;
  m.operatingCost += costRate * dt;
  m.capturedRevenue += completedThisCycle * AVERAGE_ORDER_VALUE;
  m.potentialRevenue += arrivals * AVERAGE_ORDER_VALUE;
  m.trappedRevenue = totalQueue * AVERAGE_ORDER_VALUE;

  // ---- Experience ---------------------------------------------------------
  const demandVsFlow = m.arrivalRate > 0.5 ? clamp01(m.completionRate / m.arrivalRate) * 100 : 100;
  m.deliveryPerformance = lerp(m.deliveryPerformance, demandVsFlow, EMA * 0.8);

  const failRate =
    m.arrivalRate > 0.5 ? clamp01((failedThisCycle + abandonedThisCycle) / dt / m.arrivalRate) : 0;
  const satisfactionTarget =
    95 -
    clamp(m.avgQueueTime * 1.4, 0, 40) -
    clamp(m.unresolvedIssues * 0.35, 0, 25) -
    clamp(failRate * 100 * 0.6, 0, 20);
  m.customerSatisfaction = lerp(m.customerSatisfaction, clamp(satisfactionTarget, 0, 100), 0.06);

  const congestion = clamp01(totalQueue / 320);
  m.systemHealth = clamp(
    0.38 * m.customerSatisfaction +
      0.27 * m.deliveryPerformance +
      0.2 * (1 - congestion) * 100 +
      0.15 * (1 - clamp01(failRate * 6)) * 100,
    0,
    100,
  );

  // ---- Bottleneck: the node with the deepest sustained backlog ------------
  // The order pipeline is checked first: support drowning is usually a
  // symptom of pipeline failure, so it only counts as THE constraint when
  // the pipeline itself is flowing.
  let bottleneck: NodeId | null = null;
  let worst = 0;
  for (const id of FLOW_PATH) {
    const n = nodes[id];
    if (n.pressure > worst && n.pressure > 1.5 && n.queue > 8) {
      worst = n.pressure;
      bottleneck = id;
    }
  }
  if (!bottleneck && supportNode.pressure > 3 && supportNode.queue > 12) {
    bottleneck = "support";
  }

  return {
    ...prev,
    tick,
    nodes,
    stock,
    metrics: m,
    bottleneck,
  };
}

/** Run the sim forward n cycles (used by presets, comparisons and tests). */
export function runCycles(state: SimState, n: number): SimState {
  let s = state;
  for (let i = 0; i < n; i++) s = tickSim(s, 1);
  return s;
}
