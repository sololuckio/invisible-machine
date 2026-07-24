/**
 * Scroll position shared with the render loop without triggering React
 * re-renders: the DOM tracker writes here at scroll speed and the 3D frame
 * loop reads at frame speed.
 */

export interface ScrollSnapshot {
  /** Continuous chapter position, e.g. 3.42 = 42% through Chapter 3. */
  chapterFloat: number;
  /** Whole-page progress 0..1. */
  progress: number;
  /** 0..1 within Chapter 1 — drives the surface split. */
  surface: number;
  /** 0..1 within Chapter 2 — drives the hero order's descent. */
  order: number;
}

export const scrollState: ScrollSnapshot = {
  chapterFloat: 1,
  progress: 0,
  surface: 0,
  order: 0,
};
