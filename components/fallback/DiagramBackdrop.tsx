"use client";

import { SystemDiagram } from "./SystemDiagram";

/**
 * Fixed 2D backdrop used instead of the 3D canvas — WebGL missing, the 3D
 * layer crashed, or the visitor chose the diagram view. The diagram is
 * interactive in the foreground panels; the backdrop copy stays subtle.
 */
export function DiagramBackdrop() {
  return (
    <div className="fixed inset-0 z-0 diagram-backdrop" aria-hidden="true">
      <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center p-6 opacity-70 lg:ml-auto lg:mr-[6vw]">
        <SystemDiagram interactive={false} />
      </div>
    </div>
  );
}
