"use client";

import { ControlPanel } from "@/components/system/ControlPanel";
import { MetricsStrip } from "@/components/system/MetricsStrip";
import { CHAPTERS } from "@/data/copy";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[2];

export function Chapter03Pressure() {
  return (
    <ChapterSection ch={ch} heightClass="min-h-[230vh]">
      <div className="chapter-layout is-console">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} />
        </div>
        <div className="chapter-console">
          <MetricsStrip />
          <ControlPanel />
        </div>
      </div>
    </ChapterSection>
  );
}
