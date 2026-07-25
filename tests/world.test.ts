import { describe, expect, it } from "vitest";
import { FACILITY, FACILITY_CORE, LEVELS, SHAFT_BOTTOM, SHAFT_R, hash01 } from "@/lib/facility";
import { travelDwell } from "@/lib/motion";
import { QUALITY_PROFILES } from "@/lib/quality";

/**
 * The plant is generated rather than modelled, so these lock down the two
 * properties that make it work as an environment: it is identical on every
 * load, and it stays out of the camera's half of the shaft.
 */
describe("facility layout", () => {
  const all = [
    ...FACILITY.frame,
    ...FACILITY.plate,
    ...FACILITY.tube,
    ...FACILITY.lamp,
    ...FACILITY.marking,
  ];

  it("builds a substantial plant", () => {
    expect(all.length).toBeGreaterThan(400);
  });

  it("is deterministic — the same hash for the same index, every time", () => {
    expect(hash01(7)).toBe(hash01(7));
    expect(hash01(7)).not.toBe(hash01(8));
    for (const v of [0, 1, 42, 1000]) {
      expect(hash01(v)).toBeGreaterThanOrEqual(0);
      expect(hash01(v)).toBeLessThan(1);
    }
  });

  it("keeps structure inside the shaft out of the camera's half", () => {
    // Anything close enough to occlude must be behind the machine. Parts far
    // enough out are distant plant and are fogged past recognition.
    const near = all.filter((p) => Math.hypot(p.pos[0], p.pos[2]) < SHAFT_R + 1.5);
    expect(near.length).toBeGreaterThan(300);
    const inFront = near.filter((p) => p.pos[2] > 2.4);
    expect(inFront).toHaveLength(0);
  });

  it("never places distant plant in front of the machine", () => {
    const far = all.filter((p) => Math.hypot(p.pos[0], p.pos[2]) > SHAFT_R + 1.5);
    expect(far.length).toBeGreaterThan(20);
    for (const p of far) {
      const a = Math.atan2(p.pos[2], p.pos[0]);
      expect(Math.sin(a)).toBeLessThanOrEqual(0.31);
    }
  });

  it("stays within the shaft's vertical extent", () => {
    for (const p of all) {
      expect(p.pos[1]).toBeGreaterThan(SHAFT_BOTTOM - 22);
      expect(p.pos[1]).toBeLessThan(12);
    }
  });

  it("carries human-scale parts, which is what gives the machine its size", () => {
    // Door leaves are a shade over two metres; handrails just over one.
    const doorish = all.filter((p) => Math.abs(p.scale[1] - 2.05) < 0.01);
    expect(doorish.length).toBeGreaterThanOrEqual(LEVELS.length);
    const railish = FACILITY.tube.filter((p) => Math.abs(p.scale[1] - 1.05) < 0.01);
    expect(railish.length).toBeGreaterThan(10);
  });

  it("reduces to a smaller plant, not a broken one", () => {
    expect(FACILITY_CORE.frame.length).toBeLessThan(FACILITY.frame.length);
    expect(FACILITY_CORE.tube.length).toBeLessThan(FACILITY.tube.length);
    // Lamps survive intact: they are what reads as occupancy on a small screen.
    expect(FACILITY_CORE.lamp).toHaveLength(FACILITY.lamp.length);
    for (const key of ["frame", "plate", "tube", "lamp", "marking"] as const) {
      expect(FACILITY_CORE[key].length).toBeGreaterThan(0);
    }
  });
});

describe("mechanism motion", () => {
  it("dwells at both ends of the stroke", () => {
    expect(travelDwell(0)).toBe(0);
    expect(travelDwell(0.45)).toBe(1);
    expect(travelDwell(0.5)).toBe(1);
    expect(travelDwell(0.98)).toBe(0);
  });

  it("accelerates away and decelerates into the stop", () => {
    // Mid-stroke covers more ground per step than either end — that difference
    // is the whole reason this exists instead of a linear ramp.
    const early = travelDwell(0.04) - travelDwell(0.02);
    const middle = travelDwell(0.18) - travelDwell(0.16);
    const late = travelDwell(0.32) - travelDwell(0.3);
    expect(middle).toBeGreaterThan(early * 1.5);
    expect(middle).toBeGreaterThan(late * 1.5);
  });

  it("repeats cleanly, so a free-running phase never jumps", () => {
    for (const t of [0.13, 0.37, 0.62, 0.81]) {
      expect(travelDwell(t + 5)).toBeCloseTo(travelDwell(t), 10);
    }
  });

  it("stays within travel bounds for any phase", () => {
    for (let i = 0; i < 200; i++) {
      const v = travelDwell(i * 0.017);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("quality tiers", () => {
  it("still builds a plant on the reduced tier", () => {
    // Mobile and weak devices get less detail — never an empty void.
    expect(QUALITY_PROFILES.reduced.environment).toBe("core");
    expect(QUALITY_PROFILES.high.environment).toBe("full");
    expect(QUALITY_PROFILES.balanced.environment).toBe("full");
  });

  it("drops atmospheric dust before it drops structure", () => {
    expect(QUALITY_PROFILES.reduced.motes).toBe(0);
    expect(QUALITY_PROFILES.balanced.motes).toBeLessThan(QUALITY_PROFILES.high.motes);
  });
});
