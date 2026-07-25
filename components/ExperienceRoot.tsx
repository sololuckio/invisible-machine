"use client";

import { ScrollTracker } from "@/components/chapters/ScrollTracker";
import { ExperienceCanvas } from "@/components/experience/ExperienceCanvas";
import { LabOverlay } from "@/components/system/LabOverlay";
import { BootOverlay } from "@/components/ui/BootOverlay";
import { Nav } from "@/components/ui/Nav";
import { SrStatus } from "@/components/ui/SrStatus";
import { useChapterDirector } from "@/hooks/useChapterDirector";
import { useEnvironmentSetup } from "@/hooks/useEnvironmentSetup";
import { useSimulationLoop } from "@/hooks/useSimulationLoop";
import { useSoundDirector } from "@/hooks/useSoundDirector";
import { useStageDirector } from "@/hooks/useStageDirector";

/**
 * Mounts the experience's runtime: environment probes, the simulation clock,
 * the guided-narrative director, the sound layer, and every fixed layer
 * (canvas, nav, boot, lab, live announcements).
 */
export function ExperienceRoot() {
  useEnvironmentSetup();
  useSimulationLoop();
  useStageDirector();
  useChapterDirector();
  useSoundDirector();

  return (
    <>
      <ExperienceCanvas />
      <ScrollTracker />
      <Nav />
      <BootOverlay />
      <LabOverlay />
      <SrStatus />
    </>
  );
}
