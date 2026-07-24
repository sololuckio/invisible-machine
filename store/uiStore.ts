import { create } from "zustand";
import { soundEngine } from "@/lib/audio";
import type { Quality } from "@/lib/quality";
import { STORAGE_KEYS, writeSession } from "@/lib/storage";
import type { NodeId } from "@/simulation/types";

export type ScanStatus = "idle" | "scanning" | "complete";
export type ViewMode = "3d" | "diagram";

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
  setViewMode: (v: ViewMode) => void;

  /** False once WebGL is missing or the 3D layer crashed — diagram takes over. */
  webglOk: boolean;
  setWebglOk: (ok: boolean) => void;

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
  setViewMode: (viewMode) => {
    writeSession(STORAGE_KEYS.view, viewMode);
    set({ viewMode });
  },

  webglOk: true,
  setWebglOk: (webglOk) => set({ webglOk }),

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
