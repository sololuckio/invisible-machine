"use client";

import { useShallow } from "zustand/shallow";
import { fmtHours, fmtInt, fmtMult, fmtPct, fmtRate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/palette";
import { NODE_DEFS, NODE_MAP } from "@/simulation/nodes";
import { analyze } from "@/simulation/recommendations";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Inspect any station: live capacity, load, queue, timing and what its
 * trouble does downstream — plus the intervention the analysis engine
 * would recommend for it. Selection works from here (keyboard/touch)
 * or by clicking stations in the 3D machine.
 */

export function NodeInspector() {
  const selected = useUIStore((s) => s.selectedNode);
  const selectNode = useUIStore((s) => s.selectNode);
  const sim = useSimStore((s) => s.sim);

  const node = selected ? sim.nodes[selected] : null;
  const def = selected ? NODE_MAP[selected] : null;

  const liveStatuses = useSimStore(
    useShallow((s) => Object.fromEntries(NODE_DEFS.map((d) => [d.id, s.sim.nodes[d.id].status]))),
  );

  const recommendation =
    selected && node
      ? (analyze(sim).recommendations.find((r) => r.targetNode === selected)?.title ??
        (node.pressure > 0.5 ? "Watch closely — backlog is forming." : "No intervention required."))
      : null;

  return (
    <div className="panel inspector">
      <div className="panel-head">
        <p className="tech-label">Station inspector</p>
        {selected && (
          <button type="button" className="btn btn-ghost" onClick={() => selectNode(null)}>
            Clear
          </button>
        )}
      </div>

      <div className="inspector-chips" role="group" aria-label="Select a station">
        {NODE_DEFS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`chip status-${liveStatuses[d.id]}${selected === d.id ? " is-active" : ""}`}
            aria-pressed={selected === d.id}
            onClick={() => selectNode(selected === d.id ? null : d.id)}
          >
            <span className="chip-dot" aria-hidden="true" />
            {d.name}
          </button>
        ))}
      </div>

      {node && def ? (
        <div className="inspector-detail">
          <div className="inspector-title">
            <span className="tech-label">{def.tag}</span>
            <h4>{def.name}</h4>
            <p className={`status-badge status-${node.status}`}>{STATUS_LABELS[node.status]}</p>
          </div>
          <p className="inspector-desc">{def.description}</p>

          <dl className="inspector-grid">
            <div>
              <dt>Capacity</dt>
              <dd>{fmtRate(node.capacity)}</dd>
            </div>
            <div>
              <dt>Demand on station</dt>
              <dd>{fmtRate(node.load)}</dd>
            </div>
            <div>
              <dt>Utilisation</dt>
              <dd>{fmtMult(node.utilization)}</dd>
            </div>
            <div>
              <dt>Queue</dt>
              <dd>{fmtInt(node.queue)} orders</dd>
            </div>
            <div>
              <dt>Time at station</dt>
              <dd>
                {fmtHours(def.baseTime + (node.capacity > 0 ? node.queue / node.capacity : 0))}
              </dd>
            </div>
            <div>
              <dt>Error rate</dt>
              <dd>{fmtPct(node.errorRate * 100)}</dd>
            </div>
          </dl>

          {def.downstream.length > 0 && (
            <div className="inspector-downstream">
              <p className="tech-label">Downstream impact</p>
              <ul>
                {def.downstream.map((id) => (
                  <li key={id} className={`status-text-${liveStatuses[id]}`}>
                    {NODE_MAP[id].name} — {STATUS_LABELS[liveStatuses[id]]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="inspector-rec">
            <p className="tech-label">Recommended intervention</p>
            <p>{recommendation}</p>
          </div>
        </div>
      ) : (
        <p className="inspector-empty">
          Select a station — here or directly on the machine — to open its internals.
        </p>
      )}
    </div>
  );
}
