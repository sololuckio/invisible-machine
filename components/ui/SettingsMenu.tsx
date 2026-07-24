"use client";

import { useEffect, useRef, useState } from "react";
import { UI_STRINGS } from "@/data/copy";
import { restartExperience } from "@/lib/experience";
import { detectQuality, type Quality } from "@/lib/quality";
import { useUIStore } from "@/store/uiStore";
import { IconGear } from "./icons";

const QUALITY_OPTIONS: { id: Quality; label: string; note: string }[] = [
  { id: "high", label: "High", note: "Full detail, 2× resolution" },
  { id: "balanced", label: "Balanced", note: "Default for most devices" },
  { id: "reduced", label: "Reduced", note: "Light on GPU and battery" },
];

/**
 * The performance/settings console: rendering quality, 3D vs diagram view,
 * and a full experience restart. Popover, keyboard-dismissable.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const quality = useUIStore((s) => s.quality);
  const qualitySource = useUIStore((s) => s.qualitySource);
  const setQuality = useUIStore((s) => s.setQuality);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const webglOk = useUIStore((s) => s.webglOk);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="settings-root" ref={rootRef}>
      <button
        type="button"
        className="btn btn-icon"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={UI_STRINGS.settings}
        title={UI_STRINGS.settings}
        onClick={() => setOpen((v) => !v)}
      >
        <IconGear />
      </button>

      {open && (
        <div className="settings-panel panel" role="group" aria-label={UI_STRINGS.settings}>
          <p className="tech-label">Render quality</p>
          <div className="settings-options">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`settings-option${quality === opt.id ? " is-active" : ""}`}
                aria-pressed={quality === opt.id}
                onClick={() => setQuality(opt.id, "user")}
              >
                <span>
                  {opt.label}
                  {quality === opt.id && qualitySource === "auto" ? " · auto" : ""}
                </span>
                <span className="settings-note">{opt.note}</span>
              </button>
            ))}
            <button
              type="button"
              className="settings-option"
              onClick={() => setQuality(detectQuality(), "auto")}
            >
              <span>Auto-detect</span>
              <span className="settings-note">Let the machine decide</span>
            </button>
          </div>

          <p className="tech-label">View</p>
          <div className="settings-options">
            <button
              type="button"
              className={`settings-option${viewMode === "3d" ? " is-active" : ""}`}
              aria-pressed={viewMode === "3d"}
              disabled={!webglOk}
              onClick={() => setViewMode("3d")}
            >
              <span>{UI_STRINGS.machineView}</span>
              <span className="settings-note">
                {webglOk ? "Full cinematic machine" : "WebGL unavailable on this device"}
              </span>
            </button>
            <button
              type="button"
              className={`settings-option${viewMode === "diagram" ? " is-active" : ""}`}
              aria-pressed={viewMode === "diagram"}
              onClick={() => setViewMode("diagram")}
            >
              <span>{UI_STRINGS.diagramView}</span>
              <span className="settings-note">Live 2D schematic, same simulation</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost settings-restart"
            onClick={() => {
              setOpen(false);
              restartExperience(true);
            }}
          >
            {UI_STRINGS.restart}
          </button>
        </div>
      )}
    </div>
  );
}
