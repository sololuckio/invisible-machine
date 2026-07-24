"use client";

import { AIPanel } from "@/components/system/AIPanel";
import { CHAPTERS } from "@/data/copy";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[4];

export function Chapter05Intelligence() {
  return (
    <ChapterSection ch={ch} heightClass="min-h-[210vh]">
      <div className="chapter-layout is-console">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} />
        </div>
        <div className="chapter-console">
          <AIPanel />
        </div>
      </div>
    </ChapterSection>
  );
}
