"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { DiagramBackdrop } from "@/components/fallback/DiagramBackdrop";
import { useUIStore } from "@/store/uiStore";

const SceneRoot = dynamic(() => import("./SceneRoot"), {
  ssr: false,
  loading: () => null,
});

/**
 * Catches any 3D-layer crash (shader failure, driver quirks) and demotes the
 * experience to the 2D diagram instead of a blank page.
 */
class CanvasErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    if (process.env.NODE_ENV !== "production") {
      console.error("[invisible-machine] 3D layer crashed, falling back to diagram:", error);
    }
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The fixed backdrop of the whole experience: the 3D machine when WebGL is
 * available and wanted, otherwise the live 2D system diagram. Capability,
 * chosen view and runtime failure are independent — the canvas can unmount
 * and return any number of times.
 */
export function ExperienceCanvas() {
  const webglCapability = useUIStore((s) => s.webglCapability);
  const viewMode = useUIStore((s) => s.viewMode);
  const sceneEpoch = useUIStore((s) => s.sceneEpoch);
  const reportSceneFailure = useUIStore((s) => s.reportSceneFailure);

  if (webglCapability === "unavailable" || viewMode === "diagram") {
    return <DiagramBackdrop />;
  }

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <CanvasErrorBoundary key={sceneEpoch} onError={reportSceneFailure}>
        <SceneRoot />
      </CanvasErrorBoundary>
    </div>
  );
}
