"use client";

import { ComparePanel } from "@/components/system/ComparePanel";
import { CHAPTERS } from "@/data/copy";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[5];

export function Chapter06Compare() {
  return (
    <ChapterSection ch={ch} heightClass="min-h-[210vh]">
      <div className="chapter-layout is-console">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} />
        </div>
        <div className="chapter-console">
          {/* The guided journey compares the stressed scenario the visitor
              just lived through, whatever the live machine is doing now. */}
          <ComparePanel scenarioId="viral" />
        </div>
      </div>
    </ChapterSection>
  );
}
