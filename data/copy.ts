/**
 * Every visitor-facing line of the narrative lives here.
 * Components render this data; they do not own copy.
 */

export const BOOT_LINES = [
  "SYSTEM OFFLINE",
  "INITIALIZING BUSINESS MODEL",
  "LOADING CUSTOMERS",
  "LOADING OPERATIONS",
  "LOADING CASH FLOW",
  "SYSTEM READY",
] as const;

export interface ChapterCopy {
  id: string;
  /** DOM id of the section — used for anchors and chapter tracking. */
  anchor: string;
  index: number;
  kicker: string;
  title: string;
  headline: string[];
  body: string[];
}

export const CHAPTERS: ChapterCopy[] = [
  {
    id: "surface",
    anchor: "ch-surface",
    index: 1,
    kicker: "CH.01 — THE SURFACE",
    title: "The Surface",
    headline: ["A business looks simple", "from the outside."],
    body: [
      "A product. A customer. A transaction.",
      "Until you see everything happening underneath.",
    ],
  },
  {
    id: "order",
    anchor: "ch-order",
    index: 2,
    kicker: "CH.02 — ONE ORDER ENTERS",
    title: "One Order Enters",
    headline: ["It begins with", "a single decision."],
    body: [
      "Someone clicks “Buy.”",
      "One glowing order drops through the surface — and eight hidden systems wake up to carry it.",
    ],
  },
  {
    id: "pressure",
    anchor: "ch-pressure",
    index: 3,
    kicker: "CH.03 — THE SYSTEM UNDER PRESSURE",
    title: "Under Pressure",
    headline: ["One order is easy.", "Growth is where the", "system reveals itself."],
    body: [
      "Turn the dials. Raise demand, cut staff, drain the shelves — the machine will answer honestly.",
    ],
  },
  {
    id: "bottleneck",
    anchor: "ch-bottleneck",
    index: 4,
    kicker: "CH.04 — BOTTLENECK",
    title: "Bottleneck",
    headline: ["Every system has", "a constraint."],
    body: [
      "Growth does not break a business everywhere. It breaks at the narrowest point.",
      "Select any station to inspect its queue, capacity and the damage flowing downstream.",
    ],
  },
  {
    id: "intelligence",
    anchor: "ch-intelligence",
    index: 5,
    kicker: "CH.05 — ACTIVATE INTELLIGENCE",
    title: "Activate Intelligence",
    headline: ["Automation makes tasks faster.", "Intelligence changes", "the system itself."],
    body: [
      "Run the scan. The machine reads its own state — queues, stock, satisfaction, error rates — and proposes the highest-leverage intervention.",
    ],
  },
  {
    id: "compare",
    anchor: "ch-compare",
    index: 6,
    kicker: "CH.06 — BEFORE & AFTER",
    title: "Before & After",
    headline: ["The machine did not", "become simpler.", "It became visible."],
    body: [
      "The same business, the same demand, the same number of hours — run twice. Once ignored, once understood.",
    ],
  },
  {
    id: "creator",
    anchor: "ch-creator",
    index: 7,
    kicker: "CH.07 — THE CREATOR",
    title: "The Creator",
    headline: [
      "I build digital systems by",
      "understanding what happens",
      "beneath the interface.",
    ],
    body: [
      "The website is only the visible layer. Underneath it are decisions, processes, data, infrastructure, users, constraints — and opportunities for automation.",
      "Everything you just interfered with is how I think about every project.",
    ],
  },
  {
    id: "cta",
    anchor: "ch-cta",
    index: 8,
    kicker: "CH.08 — TRANSMISSION",
    title: "Transmission",
    headline: ["What is happening", "underneath your business?"],
    body: ["Let’s make the invisible visible."],
  },
];

export const SIGNATURE_LINES = {
  automation: ["The best automation does not remove people.", "It removes friction."],
} as const;

/** Structured, screen-reader-friendly overview of the whole experience. */
export const SYSTEM_OVERVIEW_TEXT = [
  "The Invisible Machine is an interactive simulation of a modern e-commerce business, visualised as a machine descending beneath a calm storefront surface.",
  "Orders flow through eight connected stations: customer acquisition, checkout, payment, inventory, fulfilment, delivery, customer support, and revenue reporting.",
  "You control demand, staff capacity, inventory replenishment, processing speed, support capacity and automation level. The simulation responds continuously: queues form in front of undersized stations, stock runs out, customers abandon orders, satisfaction and revenue fall.",
  "The system identifies its own bottleneck — the station with the deepest sustained backlog — and a deterministic analysis engine recommends interventions based on the live state, such as adding fulfilment capacity, increasing safety stock, automating payment verification, or slowing acquisition.",
  "Applying a recommendation changes the running system and the machine visibly recovers. A before/after comparison runs the same scenario with and without these interventions and reports completed orders, processing time, fulfilment rate, satisfaction, cost, revenue and system health.",
] as const;

/**
 * Short labels for the scenario preset chips. The full names live with the
 * presets in `simulation/scenarios.ts`; these are the compact forms a chip can
 * actually carry, and they stay here because no copy belongs in a component.
 */
export const SCENARIO_SHORT: Record<"balanced" | "viral" | "breakdown", string> = {
  balanced: "Balanced",
  viral: "Viral spike",
  breakdown: "Breakdown",
};

export const UI_STRINGS = {
  skipToContent: "Skip to content",
  skipIntro: "Skip intro",
  enterMachine: "Enter the machine",
  scrollHint: "Scroll to descend",
  activateIntelligence: "Activate Intelligence",
  scanning: "Scanning system state…",
  applyRecommendation: "Apply recommendation",
  reAnalyse: "Re-analyse",
  /**
   * Shown when every intervention has been taken. Moving a dial makes advice
   * eligible again — the operator has changed the system it was taken against
   * — so pointing at the dials is honest, not a dead instruction.
   */
  recommendationsExhausted:
    "Every intervention the engine can see has been applied. Move the dials and it will have something new to say — or “Explore the system again” at the end of the journey resets the whole system without losing your place.",
  stateMoved: "state has moved",
  applied: "Applied",
  runComparison: "Run the comparison",
  exploreAgain: "Explore the system again",
  viewProjects: "View projects",
  contactMe: "Contact me",
  enterLab: "Enter the System Lab",
  exitLab: "Exit lab",
  soundOn: "Sound on",
  soundOff: "Sound off",
  settings: "Display settings",
  restart: "Restart experience",
  reset: "Reset simulation",
  pause: "Pause simulation",
  resume: "Resume simulation",
  diagramView: "Diagram view",
  machineView: "3D view",
} as const;
