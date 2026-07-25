"use client";

import { NodeInspector } from "@/components/system/NodeInspector";
import { ScenarioChips } from "@/components/system/ScenarioChips";
import { CHAPTERS } from "@/data/copy";
import { NODE_MAP } from "@/simulation/nodes";
import { useSimStore } from "@/store/simStore";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[3];

export function Chapter04Bottleneck() {
  const bottleneck = useSimStore((s) => s.sim.bottleneck);

  return (
    <ChapterSection ch={ch} heightClass="min-h-[230vh]">
      <div className="chapter-layout is-console">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} />
          <p className="bottleneck-callout" role="status">
            {bottleneck ? (
              <>
                Right now the constraint is{" "}
                <strong>
                  {NODE_MAP[bottleneck].name} ({NODE_MAP[bottleneck].tag})
                </strong>
                . The congestion behind it is not a metaphor — it is the simulation.
              </>
            ) : (
              <>
                No constraint at the moment — the machine is keeping up. Push demand harder and
                watch one form.
              </>
            )}
          </p>
          {!bottleneck && (
            <div className="bottleneck-empty-actions">
              <ScenarioChips label="Load a preset that breaks" />
            </div>
          )}
        </div>
        <div className="chapter-console">
          <NodeInspector />
        </div>
      </div>
    </ChapterSection>
  );
}
