import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";
import { STORAGE_KEYS, writeSession } from "./storage";

/**
 * Shared journey actions used by the nav, settings and the final chapter.
 */

/** Back to the top and a clean simulation; `replayBoot` re-runs Chapter 0. */
export function restartExperience(replayBoot: boolean): void {
  useSimStore.getState().loadScenario("balanced");
  useUIStore.getState().selectNode(null);
  useUIStore.getState().resetScan();
  useUIStore.getState().setLabOpen(false);
  // "auto" is not instant here: the page sets `scroll-behavior: smooth`, which
  // wins over it. A full restart must land at the top immediately — and a
  // visitor who asked for reduced motion must never be taken on a long ride.
  if (replayBoot) {
    writeSession(STORAGE_KEYS.bootSeen, "0");
    useUIStore.setState({ bootDone: false });
    window.scrollTo({ top: 0, behavior: "instant" });
  } else {
    const reduced = useUIStore.getState().reducedMotion;
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  }
}

export function scrollToAnchor(anchor: string): void {
  const el = document.getElementById(anchor);
  if (!el) return;
  const reduced = useUIStore.getState().reducedMotion;
  el.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
}
