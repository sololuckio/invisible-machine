import { clamp } from "./engine";
import type { Recommendation, SimState } from "./types";

/**
 * Apply a recommendation's effect to a simulation state. Pure — returns the
 * adjusted state; the engine then reacts naturally over subsequent cycles.
 */
export function applyRecommendation(state: SimState, rec: Recommendation): SimState {
  if (state.appliedRecommendations.includes(rec.id)) return state;

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
    appliedRecommendations: [...state.appliedRecommendations, rec.id],
  };
}
