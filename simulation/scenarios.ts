import type { Scenario, ScenarioId } from "./types";

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  balanced: {
    id: "balanced",
    name: "Balanced Business",
    tagline: "Healthy demand, adequate capacity",
    description:
      "A well-run shop on an ordinary day. Orders flow, queues stay short, and nothing is on fire — yet.",
    controls: {
      demand: 40,
      staff: 60,
      inventory: 70,
      speed: 60,
      support: 60,
      automation: 20,
    },
    initialStock: 80,
  },
  viral: {
    id: "viral",
    name: "Viral Demand Spike",
    tagline: "The post took off. The warehouse did not.",
    description:
      "Demand quadruples overnight. The funnel is wide, but the back of the machine was sized for a quieter life.",
    controls: {
      demand: 92,
      staff: 60,
      inventory: 70,
      speed: 60,
      support: 60,
      automation: 20,
    },
    initialStock: 80,
  },
  breakdown: {
    id: "breakdown",
    name: "Operational Breakdown",
    tagline: "Understaffed, understocked, overwhelmed",
    description:
      "Moderate demand meets a hollowed-out operation: thin staffing, empty shelves, and a skeleton support desk.",
    controls: {
      demand: 70,
      staff: 25,
      inventory: 15,
      speed: 40,
      support: 20,
      automation: 0,
    },
    initialStock: 30,
  },
};

export const SCENARIO_LIST: readonly Scenario[] = [
  SCENARIOS.balanced,
  SCENARIOS.viral,
  SCENARIOS.breakdown,
];

export const DEFAULT_SCENARIO: ScenarioId = "balanced";
