"use client";

import { SCENARIO_LIST } from "@/simulation/scenarios";
import { useSimStore } from "@/store/simStore";

/**
 * Three prepared realities for the machine. Switching is instant —
 * no reload, no ceremony.
 */
export function ScenarioSelector() {
  const active = useSimStore((s) => s.sim.scenario);
  const loadScenario = useSimStore((s) => s.loadScenario);

  return (
    <div className="panel scenario-panel">
      <div className="panel-head">
        <p className="tech-label">Scenario</p>
      </div>
      <div className="scenario-options" role="group" aria-label="Simulation scenario">
        {SCENARIO_LIST.map((sc) => (
          <button
            key={sc.id}
            type="button"
            className={`scenario-option${active === sc.id ? " is-active" : ""}`}
            aria-pressed={active === sc.id}
            onClick={() => loadScenario(sc.id)}
          >
            <span className="scenario-name">{sc.name}</span>
            <span className="scenario-tagline">{sc.tagline}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
