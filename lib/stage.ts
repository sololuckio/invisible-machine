/**
 * The stage director's vocabulary.
 *
 * One place decides what beat the experience is currently playing, how much
 * energy the machine should have, and whether the moment belongs to the story
 * (cinematic) or to the visitor (control). Every other layer — camera, order
 * traffic, station mechanisms, chrome, sound — reads from here instead of
 * inventing its own idea of pacing, which is what keeps the whole site moving
 * with a single rhythm instead of one constant hum.
 *
 * `computeStage` is pure so the beat map can be reasoned about and tested;
 * `stageState` is the mutable snapshot the frame loops read without causing
 * React re-renders (same pattern as `scrollState`).
 */

export type StageBeat =
  /* Chapter 1 — the surface opening, staged */
  | "stillness"
  | "instability"
  | "ignition"
  | "release"
  | "descent"
  /* Chapter 2 */
  | "hero"
  /* Chapter 3 */
  | "pressure"
  /* Chapter 4 — the bottleneck forming, staged */
  | "rising"
  | "compression"
  | "lock"
  | "inspect"
  /* Chapter 5 */
  | "prescan"
  | "scan"
  | "restructure"
  /* Chapters 6–8 */
  | "managed"
  | "reflect"
  | "closure"
  /* Free exploration */
  | "lab";

export interface StageInput {
  /** Continuous chapter position (1.00 … 8.999). */
  chapterFloat: number;
  /** 0..1 progress through Chapter 1 — authority for the surface stages. */
  surface: number;
  scanning: boolean;
  scanComplete: boolean;
  /** True for a short window after a recommendation is applied. */
  restructuring: boolean;
  labOpen: boolean;
  reducedMotion: boolean;
  /** Chapter whose console the visitor has taken hold of, if any. */
  engagedChapter: number | null;
}

export interface StageSnapshot {
  beat: StageBeat;
  /** 0..1 — how much the machine should be moving during this beat. */
  energy: number;
  /** True while the story is being told and instrumentation should recede. */
  cinematic: boolean;
}

/**
 * Energy is a visual tempo only — it never reaches the simulation engine, so
 * a calm beat looks calm without making the numbers dishonest.
 */
const BEATS: Record<StageBeat, { energy: number; cinematic: boolean }> = {
  stillness: { energy: 0.08, cinematic: true },
  instability: { energy: 0.14, cinematic: true },
  ignition: { energy: 0.32, cinematic: true },
  release: { energy: 0.48, cinematic: true },
  descent: { energy: 0.38, cinematic: true },
  hero: { energy: 0.34, cinematic: true },
  pressure: { energy: 0.62, cinematic: false },
  rising: { energy: 0.78, cinematic: true },
  compression: { energy: 0.96, cinematic: true },
  /** The constraint lock: motion compresses and the machine holds still. */
  lock: { energy: 0.16, cinematic: true },
  inspect: { energy: 0.55, cinematic: false },
  prescan: { energy: 0.24, cinematic: false },
  scan: { energy: 0.4, cinematic: true },
  restructure: { energy: 0.82, cinematic: true },
  managed: { energy: 0.52, cinematic: false },
  reflect: { energy: 0.4, cinematic: false },
  closure: { energy: 0.24, cinematic: true },
  lab: { energy: 0.66, cinematic: false },
};

/** Chapter-1 stage boundaries, expressed in surface progress. */
export const SURFACE_STAGES = {
  instability: 0.09,
  ignition: 0.25,
  release: 0.41,
  settled: 0.87,
} as const;

/** Chapter-4 escalation boundaries, expressed as a fraction of the chapter. */
export const PRESSURE_STAGES = {
  rising: 0.06,
  compression: 0.34,
  lock: 0.62,
  inspect: 0.76,
} as const;

function beatFor(input: StageInput): StageBeat {
  const { chapterFloat: cf } = input;

  if (cf < 2) {
    const s = input.surface;
    if (s < SURFACE_STAGES.instability) return "stillness";
    if (s < SURFACE_STAGES.ignition) return "instability";
    if (s < SURFACE_STAGES.release) return "ignition";
    if (s < SURFACE_STAGES.settled) return "release";
    return "descent";
  }
  if (cf < 3) return "hero";
  if (cf < 4) return "pressure";
  if (cf < 5) {
    const f = cf - 4;
    if (f < PRESSURE_STAGES.rising) return "pressure";
    if (f < PRESSURE_STAGES.compression) return "rising";
    if (f < PRESSURE_STAGES.lock) return "compression";
    if (f < PRESSURE_STAGES.inspect) return "lock";
    return "inspect";
  }
  if (cf < 6) {
    if (input.scanning) return "scan";
    if (input.scanComplete) return "inspect";
    return "prescan";
  }
  if (cf < 7) return "managed";
  if (cf < 7.5) return "reflect";
  return "closure";
}

/**
 * Resolve the current beat. Precedence matters: the visitor always outranks
 * the story — taking hold of a console, or opening the Lab, ends cinematic
 * mode immediately rather than fading the controls out from under them.
 */
export function computeStage(input: StageInput): StageSnapshot {
  if (input.labOpen) return { ...BEATS.lab, beat: "lab" };

  const beat = input.restructuring ? "restructure" : beatFor(input);
  const preset = BEATS[beat];

  // Reduced motion keeps the beat structure (so pacing and sound still read)
  // but never hides instrumentation and never runs at full tempo.
  if (input.reducedMotion) {
    return { beat, energy: Math.min(preset.energy, 0.4), cinematic: false };
  }

  // Once a console has been touched in this chapter, that chapter stays in
  // control mode — the visitor is working, not watching.
  const engaged =
    input.engagedChapter !== null && input.engagedChapter === Math.floor(input.chapterFloat);

  return { beat, energy: preset.energy, cinematic: preset.cinematic && !engaged };
}

/** How long a restructuring reads as a cinematic payoff (ms). */
export const RESTRUCTURE_MS = 2800;

/**
 * Live snapshot for the frame loops. `energy` here is damped towards the
 * beat's target so tempo changes glide instead of stepping.
 */
export const stageState: StageSnapshot & { energyTarget: number } = {
  beat: "stillness",
  energy: 0.08,
  energyTarget: 0.08,
  cinematic: true,
};
