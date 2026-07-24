import type { NodeDef, NodeId } from "./types";

/**
 * The eight stations of the machine.
 *
 * 3D layout: a descending S-curve — the journey literally goes beneath the
 * surface (y = 0). Support hangs off to the side as a service bay; revenue
 * sits at the bottom of the shaft.
 */
export const NODE_DEFS: readonly NodeDef[] = [
  {
    id: "acquisition",
    name: "Customer Acquisition",
    tag: "ACQ-01",
    type: "flow",
    description:
      "Attention becomes intent. Campaigns, search and word of mouth deliver visitors to the storefront.",
    baseCapacity: 180,
    baseTime: 0.5,
    position: [-4.6, -2.4, 0.6],
    diagram: { x: 12, y: 14 },
    upstream: [],
    downstream: ["checkout"],
  },
  {
    id: "checkout",
    name: "Checkout",
    tag: "CHK-02",
    type: "flow",
    description:
      "Intent becomes commitment. Carts, forms and the moment a visitor decides to trust the machine.",
    baseCapacity: 80,
    baseTime: 0.2,
    position: [-2.2, -5.2, -1.4],
    diagram: { x: 34, y: 24 },
    upstream: ["acquisition"],
    downstream: ["payment"],
  },
  {
    id: "payment",
    name: "Payment",
    tag: "PAY-03",
    type: "flow",
    description:
      "Money moves. Authorisation, fraud checks and verification — the machine's most automatable gate.",
    baseCapacity: 60,
    baseTime: 0.8,
    position: [0.8, -8.0, 1.2],
    diagram: { x: 56, y: 34 },
    upstream: ["checkout"],
    downstream: ["inventory", "support"],
  },
  {
    id: "inventory",
    name: "Inventory",
    tag: "INV-04",
    type: "stock",
    description:
      "Promise meets physics. Every order must find a real unit on a real shelf — or wait for one.",
    baseCapacity: 70,
    baseTime: 2,
    position: [3.4, -10.8, -1.0],
    diagram: { x: 76, y: 46 },
    upstream: ["payment"],
    downstream: ["fulfilment"],
  },
  {
    id: "fulfilment",
    name: "Fulfilment",
    tag: "FUL-05",
    type: "flow",
    description:
      "The narrowest chamber. Picking, packing, labelling — human hands at machine tempo.",
    baseCapacity: 34,
    baseTime: 6,
    position: [1.0, -13.8, 1.6],
    diagram: { x: 58, y: 60 },
    upstream: ["inventory"],
    downstream: ["delivery", "support"],
  },
  {
    id: "delivery",
    name: "Delivery",
    tag: "DLV-06",
    type: "flow",
    description:
      "The order leaves the building and the business loses direct control. Carriers, routes, doorsteps.",
    baseCapacity: 36,
    baseTime: 18,
    position: [-2.0, -16.6, -0.8],
    diagram: { x: 34, y: 72 },
    upstream: ["fulfilment"],
    downstream: ["revenue", "support"],
  },
  {
    id: "support",
    name: "Customer Support",
    tag: "SUP-07",
    type: "service",
    description:
      "The pressure-relief valve. Every failure elsewhere in the machine arrives here as a conversation.",
    baseCapacity: 6,
    baseTime: 1,
    position: [5.8, -15.2, 2.4],
    diagram: { x: 88, y: 72 },
    upstream: ["payment", "fulfilment", "delivery"],
    downstream: [],
  },
  {
    id: "revenue",
    name: "Revenue & Reporting",
    tag: "REV-08",
    type: "sink",
    description:
      "The ledger at the bottom of the shaft. Only orders that survive the whole journey are counted.",
    baseCapacity: 999,
    baseTime: 0.5,
    position: [0.4, -19.6, 0.4],
    diagram: { x: 50, y: 88 },
    upstream: ["delivery"],
    downstream: [],
  },
] as const;

export const NODE_MAP: Record<NodeId, NodeDef> = Object.fromEntries(
  NODE_DEFS.map((n) => [n.id, n]),
) as Record<NodeId, NodeDef>;

/** The main order path, in processing sequence (excludes support). */
export const FLOW_PATH: readonly NodeId[] = [
  "acquisition",
  "checkout",
  "payment",
  "inventory",
  "fulfilment",
  "delivery",
  "revenue",
] as const;

export const NODE_IDS: readonly NodeId[] = NODE_DEFS.map((n) => n.id);
