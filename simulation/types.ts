/**
 * Core simulation types for The Invisible Machine.
 * The engine is pure and deterministic — no Date, no Math.random —
 * so the same inputs always produce the same system behaviour.
 */

export type NodeId =
  | "acquisition"
  | "checkout"
  | "payment"
  | "inventory"
  | "fulfilment"
  | "delivery"
  | "support"
  | "revenue";

export type NodeType = "flow" | "stock" | "service" | "sink";

export type NodeStatus = "idle" | "nominal" | "strained" | "critical";

export interface NodeDef {
  id: NodeId;
  name: string;
  /** Short technical label rendered in the 3D scene and diagram. */
  tag: string;
  type: NodeType;
  description: string;
  /** Orders (or issues) the node can process per cycle at 100% configuration. */
  baseCapacity: number;
  /** Ideal time an order spends here, in cycles (1 cycle ≈ 1 operational hour). */
  baseTime: number;
  /** World position of the node in the 3D machine. */
  position: [number, number, number];
  /** Position in the 2D fallback diagram (viewBox 0..100 × 0..100). */
  diagram: { x: number; y: number };
  upstream: NodeId[];
  downstream: NodeId[];
}

/** Visitor-facing controls. All values 0–100. */
export interface Controls {
  demand: number;
  staff: number;
  inventory: number;
  speed: number;
  support: number;
  automation: number;
}

export interface NodeState {
  id: NodeId;
  /** Effective capacity this cycle (orders / cycle) after controls + automation + tweaks. */
  capacity: number;
  /** Orders that arrived at the node this cycle. */
  load: number;
  /** Orders waiting in front of the node. */
  queue: number;
  /** Orders actually processed this cycle. */
  throughput: number;
  /** load-vs-capacity, 0..n (can exceed 1 under pressure). */
  utilization: number;
  /** queue / capacity — how many cycles of backlog are stacked up. */
  pressure: number;
  errorRate: number;
  status: NodeStatus;
  processedTotal: number;
}

export interface Metrics {
  incomingOrders: number;
  completedOrders: number;
  failedOrders: number;
  /** Orders per cycle, smoothed. */
  arrivalRate: number;
  completionRate: number;
  /** Hours from click to doorstep at current congestion. */
  avgProcessingTime: number;
  /** Hours orders spend waiting in queues. */
  avgQueueTime: number;
  /** 0–100 */
  customerSatisfaction: number;
  /** 0–100 — completed vs demanded, smoothed. */
  deliveryPerformance: number;
  /** $ per cycle. */
  operatingCostRate: number;
  operatingCost: number;
  capturedRevenue: number;
  potentialRevenue: number;
  /** $ locked in queues as work-in-progress. */
  trappedRevenue: number;
  unresolvedIssues: number;
  /** 0–100 composite. */
  systemHealth: number;
  /** Total orders currently queued across the machine. */
  totalQueue: number;
}

export type ScenarioId = "balanced" | "viral" | "breakdown";

export interface Scenario {
  id: ScenarioId;
  name: string;
  tagline: string;
  description: string;
  controls: Controls;
  /** Starting stock level 0–100. */
  initialStock: number;
}

export interface SimState {
  tick: number;
  scenario: ScenarioId;
  controls: Controls;
  nodes: Record<NodeId, NodeState>;
  /** Inventory stock level 0–100 (%). */
  stock: number;
  metrics: Metrics;
  /** Node with the highest sustained pressure, if any. */
  bottleneck: NodeId | null;
  /** Capacity multipliers granted by applied recommendations. */
  tweaks: Partial<Record<NodeId, number>>;
  appliedRecommendations: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  /** What the intervention does, in plain language. */
  detail: string;
  /** Why the engine chose it — references live numbers. */
  evidence: string;
  targetNode: NodeId;
  /** Higher = more urgent. Used to rank and pick the primary recommendation. */
  score: number;
  effect: {
    controls?: Partial<Controls>;
    tweaks?: Partial<Record<NodeId, number>>;
    stockBoost?: number;
  };
}

export interface Analysis {
  /** One-paragraph reading of the current system state. */
  narrative: string;
  bottleneck: NodeId | null;
  recommendations: Recommendation[];
}

export interface ComparisonMetrics {
  completedOrders: number;
  failedOrders: number;
  avgProcessingTime: number;
  fulfilmentRate: number;
  customerSatisfaction: number;
  operatingCost: number;
  capturedRevenue: number;
  unresolvedIssues: number;
  systemHealth: number;
}

export interface Comparison {
  before: ComparisonMetrics;
  after: ComparisonMetrics;
  /** Cycles simulated for each side. */
  cycles: number;
}
