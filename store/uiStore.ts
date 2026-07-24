import { create } from "zustand";
import { soundEngine } from "@/lib/audio";
import type { Quality } from "@/lib/quality";
import { STORAGE_KEYS, writeSession } from "@/lib/storage";
import type { NodeId } from "@/simulation/types";

export type ScanStatus = "idle" | "scanning" | "complete";
export type ViewMode = "3d" | "diagram";
/** What the device can do — never derived from what is currently mounted. */
export type WebglCapability = "unknown" | "available" | "unavailable";
/** Why the current view mode is what it is. */
export type ViewModeSource = "auto" | "user" | "error";
/** Lifecycle of the live 3D scene (independent of capability). */
export type SceneStatus = "idle" | "ready" | "failed";

interface UIStore {
  bootDone: boolean;
  finishBoot: () => void;

  /** 1..8 — index of the chapter currently in view. */
  activeChapter: number;
  setActiveChapter: (n: number) => void;

  /** True once the surface split has begun — the machine below is unveiled. */
  surfaceOpen: boolean;
  setSurfaceOpen: (open: boolean) => void;

  selectedNode: NodeId | null;
  selectNode: (id: NodeId | null) => void;

  labOpen: boolean;
  setLabOpen: (open: boolean) => void;

  soundOn: boolean;
  toggleSound: () => void;

  quality: Quality;
  qualitySource: "auto" | "user";
  setQuality: (q: Quality, source: "auto" | "user") => void;

  viewMode: ViewMode;
  viewModeSource: ViewModeSource;
  /** Only a "user" source persists the preference. */
  setViewMode: (v: ViewMode, source?: ViewModeSource) => void;

  /**
   * Device WebGL capability, set by the environment probe and confirmed by a
   * successful scene start. Choosing the diagram view or unmounting the canvas
   * never touches this.
   */
  webglCapability: WebglCapability;
  setWebglCapability: (c: WebglCapability) => void;

  /** Runtime state of the 3D scene; a crash here is not device incompatibility. */
  sceneStatus: SceneStatus;
  /** Bumped on retry so the error boundary and canvas remount fresh. */
  sceneEpoch: number;
  /** Called when the R3F canvas has created its renderer successfully. */
  markSceneReady: () => void;
  /** Genuine runtime failure (crash or unexpected context loss while mounted). */
  reportSceneFailure: () => void;
  /** Deliberate retry after a runtime failure — one fresh mount per call. */
  retry3D: () => void;

  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;

  scanStatus: ScanStatus;
  /** performance.now() when the scan started — drives the sweep animation. */
  scanStartedAt: number;
  startScan: () => void;
  completeScan: () => void;
  resetScan: () => void;

  compareSide: "before" | "after";
  setCompareSide: (side: "before" | "after") => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  bootDone: false,
  finishBoot: () => set({ bootDone: true }),

  activeChapter: 1,
  setActiveChapter: (n) => set({ activeChapter: n }),

  surfaceOpen: false,
  setSurfaceOpen: (surfaceOpen) => set({ surfaceOpen }),

  selectedNode: null,
  selectNode: (id) => set({ selectedNode: id }),

  labOpen: false,
  setLabOpen: (open) => set({ labOpen: open }),

  soundOn: false,
  toggleSound: () =>
    set((s) => {
      const next = !s.soundOn;
      if (next) soundEngine.enable();
      else soundEngine.disable();
      writeSession(STORAGE_KEYS.sound, next ? "1" : "0");
      return { soundOn: next };
    }),

  quality: "balanced",
  qualitySource: "auto",
  setQuality: (quality, source) => {
    if (source === "user") writeSession(STORAGE_KEYS.quality, quality);
    set({ quality, qualitySource: source });
  },

  viewMode: "3d",
  viewModeSource: "auto",
  setViewMode: (viewMode, source = "user") => {
    if (source === "user") writeSession(STORAGE_KEYS.view, viewMode);
    set({ viewMode, viewModeSource: source });
  },

  webglCapability: "unknown",
  setWebglCapability: (webglCapability) => set({ webglCapability }),

  sceneStatus: "idle",
  sceneEpoch: 0,
  markSceneReady: () => set({ sceneStatus: "ready", webglCapability: "available" }),
  reportSceneFailure: () =>
    set({ sceneStatus: "failed", viewMode: "diagram", viewModeSource: "error" }),
  retry3D: () =>
    set((s) => {
      if (s.webglCapability === "unavailable") return s;
      return {
        ...s,
        sceneStatus: "idle",
        sceneEpoch: s.sceneEpoch + 1,
        viewMode: "3d",
        viewModeSource: "user",
      };
    }),

  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  scanStatus: "idle",
  scanStartedAt: 0,
  startScan: () =>
    set({
      scanStatus: "scanning",
      scanStartedAt: typeof performance !== "undefined" ? performance.now() : 0,
    }),
  completeScan: () => set({ scanStatus: "complete" }),
  resetScan: () => set({ scanStatus: "idle" }),

  compareSide: "before",
  setCompareSide: (compareSide) => set({ compareSide }),
}));
