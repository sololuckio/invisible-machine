/**
 * The facility around the machine.
 *
 * The eight stations are the subject; this module builds the building they
 * stand in. Everything here is secondary set dressing whose only jobs are
 * **scale** (a 2 m door tells the eye how big a station is), **depth** (layers
 * between the camera and the dark), and **credibility** (a real plant has
 * catwalks, cable trays, cooling and access hatches, and they are placed where
 * maintenance would actually need them).
 *
 * One world unit is one metre. Every dimension below is chosen against that:
 * doors are 2.05 m, handrails 1.05 m, ladder rungs 0.32 m apart, deck plates
 * 1.4 m wide. That is the whole trick — the machine looks enormous because the
 * handrail next to it is exactly hand-height.
 *
 * The layout is pure and deterministic (a small integer hash, never
 * `Math.random`), so the plant is identical on every load and in every test,
 * and it is generated once at module scope rather than per frame.
 */

/** A single instanced part: position, Y-rotation and non-uniform scale. */
export interface Placement {
  pos: [number, number, number];
  /** Rotation as [x, y, z] Euler radians. */
  rot: [number, number, number];
  scale: [number, number, number];
}

/**
 * Parts are grouped by the material that draws them, so the entire plant costs
 * one draw call per group no matter how many parts land in it.
 */
export interface FacilityLayout {
  /** Heavy structure: deck plates, beams, brackets, housings, distant blocks. */
  frame: Placement[];
  /** Recessed dark faces: door leaves, louvres, wall plates, cable trays. */
  plate: Placement[];
  /** Round stock: handrails, stanchions, ladder rungs, conduit, pipework. */
  tube: Placement[];
  /** Self-lit points: inspection lamps, door lights, distant windows. */
  lamp: Placement[];
  /** Painted service markings: edge stripes, hazard bands. */
  marking: Placement[];
}

export const SHAFT_R = 8.6;
export const SHAFT_TOP = 0.4;
export const SHAFT_BOTTOM = -21.8;

/** Human-scale constants — the reason the machine reads as big. */
const DOOR_H = 2.05;
const DOOR_W = 0.92;
const RAIL_H = 1.05;
const RUNG_GAP = 0.32;
const DECK_W = 1.4;

/** Working levels: a 5 m floor pitch, the way a real plant is stacked. */
export const LEVELS = [-1.6, -6.6, -11.6, -16.6, -21.0];

/**
 * Angular sectors that carry walkways.
 *
 * All heavy structure lives in the **rear half** of the shaft. The camera
 * spends the entire journey on the +Z side, so anything built there would sit
 * between the visitor and the machine — which is how an environment stops
 * supporting a subject and starts competing with it. Built behind instead, the
 * same structure becomes what it should be: depth the machine is read against.
 */
const WALK_SECTORS = [3.42, Math.PI * 1.5, 5.98];

/** Service risers and plant rooms — rear half only, for the same reason. */
const SERVICE_ANGLES = [3.62, 4.36, 5.24];

/**
 * Flank access doors: no walkway, just a doorway and its light on the side
 * walls. They cost nothing, block nothing, and put a 2 m human reference at
 * the edge of frame in the chapters that are framed from the side.
 */
const FLANK_DOORS = [0.17, 2.97];

/** Deterministic 0..1 hash — variety without randomness. */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const TAU = Math.PI * 2;

/** Place a part on the shaft wall: local +X points outward, +Z runs tangential. */
function onWall(
  a: number,
  y: number,
  radius: number,
  scale: [number, number, number],
  tilt = 0,
): Placement {
  return {
    pos: [Math.cos(a) * radius, y, Math.sin(a) * radius],
    rot: [tilt, -a, 0],
    scale,
  };
}

/** Lay a run of segments along an arc, tangentially. */
function arc(
  centre: number,
  span: number,
  y: number,
  radius: number,
  segLen: number,
  scale: (i: number) => [number, number, number],
  out: Placement[],
  tilt = 0,
): void {
  const count = Math.max(1, Math.round((radius * span) / segLen));
  for (let i = 0; i < count; i++) {
    const a = centre - span / 2 + ((i + 0.5) / count) * span;
    out.push(onWall(a, y, radius, scale(i), tilt));
  }
}

function buildWalkways(L: FacilityLayout): void {
  for (let li = 0; li < LEVELS.length - 1; li++) {
    const y = LEVELS[li];
    for (let si = 0; si < WALK_SECTORS.length; si++) {
      const centre = WALK_SECTORS[si];
      // Levels alternate reach so the plant never looks stamped out.
      const span = 0.62 + hash01(li * 7 + si) * 0.5;
      const deckR = SHAFT_R - DECK_W / 2 - 0.15;

      // Deck plates.
      arc(centre, span, y, deckR, 1.2, () => [DECK_W, 0.09, 1.2], L.frame);
      // Toe board along the inner edge — a real grating has one.
      arc(
        centre,
        span,
        y + 0.11,
        deckR - DECK_W / 2 + 0.04,
        1.2,
        () => [0.05, 0.14, 1.2],
        L.plate,
      );
      // Painted edge stripe: the single strongest "this is a workplace" cue.
      arc(centre, span, y + 0.055, deckR - DECK_W / 2 + 0.14, 0.62, () => [0.16, 0.02, 0.44], L.marking);

      // Handrail: top rail, mid rail, stanchions at 1.15 m centres.
      arc(centre, span, y + RAIL_H, deckR - DECK_W / 2, 1.2, () => [0.045, 0.045, 1.24], L.tube);
      arc(
        centre,
        span,
        y + RAIL_H * 0.55,
        deckR - DECK_W / 2,
        1.2,
        () => [0.032, 0.032, 1.24],
        L.tube,
      );
      const posts = Math.max(2, Math.round((deckR * span) / 1.15));
      for (let p = 0; p <= posts; p++) {
        const a = centre - span / 2 + (p / posts) * span;
        L.tube.push(onWall(a, y + RAIL_H / 2, deckR - DECK_W / 2, [0.05, RAIL_H, 0.05]));
      }

      // Deck support brackets tying back to the wall.
      const braces = Math.max(2, Math.round((deckR * span) / 2.1));
      for (let b = 0; b <= braces; b++) {
        const a = centre - span / 2 + (b / braces) * span;
        L.frame.push(onWall(a, y - 0.42, SHAFT_R - 0.5, [1.0, 0.09, 0.14], 0.62));
      }

      // Inspection lamp under the deck: light where a technician would need it.
      L.lamp.push(onWall(centre + span * 0.28, y - 0.16, deckR, [0.13, 0.05, 0.3]));
      L.lamp.push(onWall(centre - span * 0.3, y - 0.16, deckR, [0.13, 0.05, 0.3]));
    }
  }
}

function buildAccess(L: FacilityLayout): void {
  for (let li = 0; li < LEVELS.length - 1; li++) {
    const y = LEVELS[li];
    for (let si = 0; si < WALK_SECTORS.length; si++) {
      const a = WALK_SECTORS[si] + (hash01(li * 13 + si) - 0.5) * 0.34;
      const wall = SHAFT_R + 0.02;

      // Recessed door surround, leaf, and the hardware that sells it.
      L.frame.push(onWall(a, y + DOOR_H / 2, wall, [0.16, DOOR_H + 0.3, DOOR_W + 0.28]));
      L.plate.push(onWall(a, y + DOOR_H / 2, wall - 0.09, [0.08, DOOR_H, DOOR_W]));
      // Vision panel at eye height (1.55 m) — nobody builds a blind door.
      L.plate.push(onWall(a, y + 1.55, wall - 0.14, [0.05, 0.34, 0.4]));
      // Lever handle, on the correct side of the leaf.
      L.tube.push(onWall(a, y + 1.02, wall - 0.16, [0.06, 0.06, 0.26]));
      // Over-door status light.
      L.lamp.push(onWall(a, y + DOOR_H + 0.28, wall - 0.12, [0.07, 0.07, 0.2]));

      // Ladder to the level below, offset clear of the doorway.
      if (li < LEVELS.length - 2) {
        const la = a + 0.4;
        const top = y;
        const bottom = LEVELS[li + 1] + 0.2;
        const height = top - bottom;
        const mid = (top + bottom) / 2;
        for (const off of [-0.24, 0.24]) {
          L.tube.push({
            pos: [
              Math.cos(la) * (SHAFT_R - 0.5) - Math.sin(la) * off,
              mid,
              Math.sin(la) * (SHAFT_R - 0.5) + Math.cos(la) * off,
            ],
            rot: [0, -la, 0],
            scale: [0.05, height, 0.05],
          });
        }
        const rungs = Math.floor(height / RUNG_GAP);
        for (let r = 1; r < rungs; r++) {
          L.tube.push(
            onWall(la, bottom + r * RUNG_GAP, SHAFT_R - 0.5, [0.035, 0.035, 0.48]),
          );
        }
        // Back hoop — fall protection, and it reads instantly as a ladder.
        for (let r = 2; r < rungs - 1; r += 3) {
          L.frame.push(onWall(la, bottom + r * RUNG_GAP, SHAFT_R - 0.34, [0.34, 0.04, 0.04]));
        }
      }
    }
  }
}

function buildServices(L: FacilityLayout): void {
  // Cable trays and conduit descending the full shaft on service angles.
  const runs = SERVICE_ANGLES;
  for (let ri = 0; ri < runs.length; ri++) {
    const a = runs[ri];
    const r = SHAFT_R - 0.34;
    const height = SHAFT_TOP - SHAFT_BOTTOM;
    const mid = (SHAFT_TOP + SHAFT_BOTTOM) / 2;
    // Tray back-plate.
    L.plate.push(onWall(a, mid, r + 0.12, [0.06, height, 0.56]));
    // The bundle itself — different gauges, the way real runs look.
    for (let c = 0; c < 4; c++) {
      const off = (c - 1.5) * 0.13;
      const gauge = 0.05 + hash01(ri * 5 + c) * 0.05;
      L.tube.push({
        pos: [Math.cos(a) * r - Math.sin(a) * off, mid, Math.sin(a) * r + Math.cos(a) * off],
        rot: [0, -a, 0],
        scale: [gauge, height, gauge],
      });
    }
    // Clamps every 1.9 m.
    const clamps = Math.floor(height / 1.9);
    for (let c = 1; c < clamps; c++) {
      L.frame.push(onWall(a, SHAFT_BOTTOM + c * 1.9, r, [0.1, 0.07, 0.62]));
    }
  }

  // Cooling / ventilation units, hung between levels where plant rooms sit.
  const vents: [number, number][] = [
    [3.62, -4.1],
    [4.36, -9.1],
    [5.24, -14.1],
    [3.98, -18.6],
    [4.86, -6.4],
  ];
  for (let vi = 0; vi < vents.length; vi++) {
    const [a, y] = vents[vi];
    const r = SHAFT_R - 0.5;
    L.frame.push(onWall(a, y, r, [0.5, 1.15, 1.5]));
    // Louvre bank.
    for (let s = 0; s < 5; s++) {
      L.plate.push(onWall(a, y - 0.4 + s * 0.2, r - 0.27, [0.06, 0.12, 1.32], 0.32));
    }
    // Duct rising out of the unit.
    L.tube.push(onWall(a, y + 1.35, r, [0.38, 1.7, 0.38]));
    L.lamp.push(onWall(a, y + 0.66, r - 0.28, [0.05, 0.05, 0.14]));
  }

  // Flank doorways: scale reference at the edge of frame, nothing in the way.
  for (let di = 0; di < FLANK_DOORS.length; di++) {
    const a = FLANK_DOORS[di];
    for (const y of [-3.4, -13.2]) {
      const wall = SHAFT_R + 0.02;
      L.frame.push(onWall(a, y + DOOR_H / 2, wall, [0.16, DOOR_H + 0.3, DOOR_W + 0.28]));
      L.plate.push(onWall(a, y + DOOR_H / 2, wall - 0.09, [0.08, DOOR_H, DOOR_W]));
      L.plate.push(onWall(a, y + 1.55, wall - 0.14, [0.05, 0.34, 0.4]));
      L.tube.push(onWall(a, y + 1.02, wall - 0.16, [0.06, 0.06, 0.26]));
      L.lamp.push(onWall(a, y + DOOR_H + 0.28, wall - 0.12, [0.07, 0.07, 0.2]));
    }
  }
}

/**
 * The plant continues past the shaft. These blocks are never approached and
 * never lit directly — fog does the work, and they exist so the shaft reads as
 * one cell of something much larger.
 */
function buildDistantPlant(L: FacilityLayout): void {
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + hash01(i) * 0.22;
    // Behind the machine only, and never close enough to read as an object.
    if (Math.sin(a) > 0.3) continue;
    const r = 18 + hash01(i * 3) * 11;
    const h = 5 + hash01(i * 7) * 13;
    const y = -3 - hash01(i * 11) * 15;
    const w = 2.4 + hash01(i * 13) * 5.5;
    L.frame.push(onWall(a, y, r, [w, h, w * (0.6 + hash01(i * 17) * 0.9)]));
    // A few lit openings — occupancy, at a distance.
    const windows = 1 + Math.floor(hash01(i * 19) * 3);
    for (let w2 = 0; w2 < windows; w2++) {
      L.lamp.push(
        onWall(
          a + (hash01(i * 23 + w2) - 0.5) * 0.16,
          y + (hash01(i * 29 + w2) - 0.5) * h * 0.7,
          r - 1.2,
          [0.1, 0.34, 0.5],
        ),
      );
    }
  }
}

/** Build the whole plant once, at module load. */
function buildFacility(): FacilityLayout {
  const L: FacilityLayout = { frame: [], plate: [], tube: [], lamp: [], marking: [] };
  buildWalkways(L);
  buildAccess(L);
  buildServices(L);
  buildDistantPlant(L);
  return L;
}

export const FACILITY = buildFacility();

/**
 * The reduced tier keeps the parts that carry scale and depth — decks, rails,
 * doors, lamps — and drops the fine service detail that only reads on a big
 * screen. It is a smaller plant, not a broken one.
 */
export const FACILITY_CORE: FacilityLayout = {
  frame: FACILITY.frame.filter((_, i) => i % 2 === 0),
  plate: FACILITY.plate.filter((_, i) => i % 3 === 0),
  tube: FACILITY.tube.filter((_, i) => i % 3 === 0),
  lamp: FACILITY.lamp,
  marking: FACILITY.marking.filter((_, i) => i % 2 === 0),
};
