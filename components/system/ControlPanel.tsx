"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import { Slider } from "@/components/ui/Slider";
import { IconPause, IconPlay, IconReset } from "@/components/ui/icons";
import { UI_STRINGS } from "@/data/copy";
import type { Controls } from "@/simulation/types";
import { useSimStore } from "@/store/simStore";
import { ScenarioChips } from "./ScenarioChips";

/**
 * The operator console. Six dials, honest consequences.
 */

const CONTROL_DEFS: { key: keyof Controls; label: string; hint: string }[] = [
  { key: "demand", label: "Demand", hint: "Marketing pressure — how many orders arrive" },
  { key: "staff", label: "Staff capacity", hint: "Hands in fulfilment — the picking line" },
  { key: "inventory", label: "Inventory", hint: "Replenishment rate — how fast shelves refill" },
  { key: "speed", label: "Processing speed", hint: "Checkout, payment and allocation tempo" },
  { key: "support", label: "Support capacity", hint: "People answering when something breaks" },
  {
    key: "automation",
    label: "Automation level",
    hint: "Rules and intelligence across every station",
  },
];

export function ControlPanel({ compact = false }: { compact?: boolean }) {
  const controls = useSimStore(useShallow((s) => s.sim.controls));
  const setControl = useSimStore((s) => s.setControl);
  const running = useSimStore((s) => s.running);
  const setRunning = useSimStore((s) => s.setRunning);
  const reset = useSimStore((s) => s.reset);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  return (
    <div className={`panel control-panel${compact ? " is-compact" : ""}`}>
      <div className="panel-head">
        <p className="tech-label">Operator console</p>
        <div className="panel-actions">
          <button
            type="button"
            className="btn btn-icon"
            aria-pressed={!running}
            aria-label={running ? UI_STRINGS.pause : UI_STRINGS.resume}
            title={running ? UI_STRINGS.pause : UI_STRINGS.resume}
            onClick={() => setRunning(!running)}
          >
            {running ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            className={`btn ${confirmReset ? "btn-danger" : "btn-icon"}`}
            aria-label={UI_STRINGS.reset}
            title={UI_STRINGS.reset}
            onClick={() => {
              if (confirmReset) {
                reset();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
              }
            }}
          >
            {confirmReset ? "Confirm reset?" : <IconReset />}
          </button>
        </div>
      </div>
      <ScenarioChips />
      {/* All six dials, always. A disclosure hid five of them behind a tap and
          made the panel change height mid-pin — more confusing than the wall of
          controls it was meant to solve. */}
      <div className="control-grid">
        {CONTROL_DEFS.map((def) => (
          <Slider
            key={def.key}
            label={def.label}
            value={controls[def.key]}
            hint={compact ? undefined : def.hint}
            onChange={(v) => setControl(def.key, v)}
          />
        ))}
      </div>
    </div>
  );
}
