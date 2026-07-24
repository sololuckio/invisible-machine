/**
 * The machine's disciplined colour system. One electric signal colour for
 * flow, one warm colour for warnings, one red for failure — everything else
 * stays near-neutral so attention lands where the system needs it.
 */

export const PALETTE = {
  bg: "#08090b",
  panel: "#0e1014",
  structure: "#252a31",
  structureFaint: "#161a1f",
  steel: "#14171c",
  text: "#e8eaed",
  dim: "#9ba1a6",
  signal: "#6ee7ff",
  signalDeep: "#1d4b5c",
  warn: "#ffb454",
  danger: "#ff5d5d",
  success: "#7fe0b2",
  hero: "#ffe9c4",
} as const;

import type { NodeStatus } from "@/simulation/types";

export const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: "#3a4048",
  nominal: PALETTE.signal,
  strained: PALETTE.warn,
  critical: PALETTE.danger,
};

export const STATUS_LABELS: Record<NodeStatus, string> = {
  idle: "Idle",
  nominal: "Nominal",
  strained: "Strained",
  critical: "Critical",
};
