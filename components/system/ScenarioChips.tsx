"use client";

import { SCENARIO_LIST } from "@/simulation/scenarios";
import { SCENARIO_SHORT } from "@/data/copy";
import { useSimStore } from "@/store/simStore";

/**
 * The three engine presets as one-tap chips.
 *
 * The sliders remain the real instrument — these are only a way in, for the
 * visitor who does not yet know which of six dials to move to make something
 * interesting happen. Selecting a chip loads the whole preset (its six control
 * values *and* its starting stock), because that is what makes each scenario
 * behave the way its name promises: the breakdown preset only starves at
 * inventory if the shelves start low.
 */
export function ScenarioChips({ label = "Preset" }: { label?: string }) {
  const active = useSimStore((s) => s.sim.scenario);
  const loadScenario = useSimStore((s) => s.loadScenario);

  return (
    <div className="scenario-chips">
      <p className="tech-label scenario-chips-label">{label}</p>
      <div className="scenario-chips-row" role="group" aria-label="Scenario preset">
        {SCENARIO_LIST.map((sc) => (
          <button
            key={sc.id}
            type="button"
            className={`scenario-chip${active === sc.id ? " is-active" : ""}`}
            aria-pressed={active === sc.id}
            title={sc.tagline}
            onClick={() => loadScenario(sc.id)}
          >
            {SCENARIO_SHORT[sc.id]}
          </button>
        ))}
      </div>
    </div>
  );
}
