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
  if (replayBoot) {
    writeSession(STORAGE_KEYS.bootSeen, "0");
    useUIStore.setState({ bootDone: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  } else {
    const reduced = useUIStore.getState().reducedMotion;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }
}

export function scrollToAnchor(anchor: string): void {
  const el = document.getElementById(anchor);
  if (!el) return;
  const reduced = useUIStore.getState().reducedMotion;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
