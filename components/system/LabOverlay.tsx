"use client";

import { useEffect, useRef } from "react";
import { IconClose } from "@/components/ui/icons";
import { UI_STRINGS } from "@/data/copy";
import { SCENARIOS } from "@/simulation/scenarios";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { AIPanel } from "./AIPanel";
import { ComparePanel } from "./ComparePanel";
import { ControlPanel } from "./ControlPanel";
import { MetricsStrip } from "./MetricsStrip";
import { NodeInspector } from "./NodeInspector";
import { ScenarioSelector } from "./ScenarioSelector";

/**
 * The System Lab: free exploration after (or instead of) the guided story.
 * The live machine stays visible between the console columns on desktop;
 * on mobile the lab is a scrollable console with the machine glowing
 * through the seams.
 */
export function LabOverlay() {
  const labOpen = useUIStore((s) => s.labOpen);
  const setLabOpen = useUIStore((s) => s.setLabOpen);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!labOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Modal: the page narrative and nav chrome step aside (CSS keys off this)
    // so only the machine and the lab consoles remain.
    document.documentElement.dataset.lab = "open";
    closeRef.current?.focus({ preventScroll: true });

    // The guided narrative stages demand for story beats; free exploration
    // starts from the scenario's honest baseline — unless the visitor has
    // already taken the dials.
    const simStore = useSimStore.getState();
    if (!simStore.userTouched) {
      simStore.directControls({
        demand: SCENARIOS[simStore.sim.scenario].controls.demand,
      });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLabOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.lab;
      document.removeEventListener("keydown", onKey);
      document.getElementById("lab-trigger")?.focus({ preventScroll: true });
    };
  }, [labOpen, setLabOpen]);

  if (!labOpen) return null;

  return (
    <div className="lab-overlay" role="dialog" aria-modal="true" aria-label="System Lab">
      <header className="lab-head">
        <div>
          <p className="tech-label">Free exploration</p>
          <h2>System Lab</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="btn btn-ghost"
          onClick={() => setLabOpen(false)}
        >
          <IconClose /> {UI_STRINGS.exitLab}
        </button>
      </header>

      <div className="lab-columns">
        <div className="lab-col">
          <ScenarioSelector />
          <ControlPanel compact />
        </div>
        <div className="lab-spacer" aria-hidden="true" />
        <div className="lab-col">
          <MetricsStrip />
          <NodeInspector />
          <AIPanel />
          <ComparePanel />
        </div>
      </div>
    </div>
  );
}
