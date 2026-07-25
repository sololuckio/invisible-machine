import { clamp } from "./engine";
import type { Controls, NodeId, Recommendation, SimState } from "./types";

/**
 * Whether a recommendation can still move the system.
 *
 * Advice used to be consumed permanently by id: take it once and it was gone
 * for the session. That produced a dead end — a breakdown could sit at 12%
 * stock with fulfilment critical while the console announced there was
 * nothing left to try, even though staff, inventory and speed all had room
 * left in them.
 *
 * Whether advice is worth repeating is a question about the levers, not about
 * history. Raising inventory a second time is a real intervention; raising it
 * when it is already at 100 is not. So exhaustion now means "no lever left to
 * pull", which is both honest and self-limiting.
 */
export function canStillHelp(state: SimState, rec: Recommendation): boolean {
  const controls = rec.effect.controls;
  if (controls) {
    for (const [key, value] of Object.entries(controls)) {
      if (value === undefined) continue;
      if (clamp(value, 0, 100) !== state.controls[key as keyof Controls]) return true;
    }
  }
  if ((rec.effect.stockBoost ?? 0) > 0 && state.stock < 100) return true;
  if (rec.effect.tweaks) {
    for (const [id, mult] of Object.entries(rec.effect.tweaks)) {
      const current = state.tweaks[id as NodeId] ?? 1;
      if (clamp(current * (mult ?? 1), 0.5, 2) !== current) return true;
    }
  }
  return false;
}

/**
 * Apply a recommendation's effect to a simulation state. Pure — returns the
 * adjusted state; the engine then reacts naturally over subsequent cycles.
 */
export function applyRecommendation(state: SimState, rec: Recommendation): SimState {
  if (!canStillHelp(state, rec)) return state;

  const controls = { ...state.controls, ...rec.effect.controls };
  for (const key of Object.keys(controls) as (keyof typeof controls)[]) {
    controls[key] = clamp(controls[key], 0, 100);
  }

  const tweaks = { ...state.tweaks };
  if (rec.effect.tweaks) {
    for (const [id, mult] of Object.entries(rec.effect.tweaks)) {
      const nodeId = id as keyof typeof tweaks;
      // Multipliers stack multiplicatively but are capped to stay believable.
      tweaks[nodeId] = clamp((tweaks[nodeId] ?? 1) * (mult ?? 1), 0.5, 2);
    }
  }

  return {
    ...state,
    controls,
    tweaks,
    stock: clamp(state.stock + (rec.effect.stockBoost ?? 0), 0, 100),
    appliedRecommendations: state.appliedRecommendations.includes(rec.id)
      ? state.appliedRecommendations
      : [...state.appliedRecommendations, rec.id],
  };
}
