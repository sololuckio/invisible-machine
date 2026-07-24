import type { NodeId } from "@/simulation/types";

/**
 * Tiny mutable channel for one-shot visual effects, read by the frame loop
 * without React re-renders (same pattern as scrollState).
 */
export const fxBus: {
  /** Node that should "pop" after a recommendation lands, and when it landed. */
  popNode: NodeId | null;
  popAt: number;
  /** Y position of the AI scan plane while sweeping, else null. */
  scanY: number | null;
} = {
  popNode: null,
  popAt: 0,
  scanY: null,
};
