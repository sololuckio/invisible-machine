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
  /**
   * The one station the story is pointing at right now — the locked
   * constraint, or the station the hero order is being handled by. Everything
   * else steps back a little so the emphasis is unambiguous.
   */
  focusNode: NodeId | null;
  /** Station currently handling the hero order (Chapter 2 only). */
  heroNode: NodeId | null;
  /** performance.now() when the constraint locked, else 0. */
  lockAt: number;
  /** performance.now() when a recommendation was last applied, else 0. */
  appliedAt: number;
} = {
  popNode: null,
  popAt: 0,
  scanY: null,
  focusNode: null,
  heroNode: null,
  lockAt: 0,
  appliedAt: 0,
};
