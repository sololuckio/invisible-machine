import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrast is a property of the design tokens, so it is asserted against the
 * tokens themselves rather than against rendered components. If a token drifts
 * darker — or someone reaches for a structural colour to letter something —
 * this fails before it reaches a screen.
 *
 * WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text (>=24px, or >=18.66px
 * bold) and for meaningful non-text elements.
 */

const CSS = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

function token(name: string): string {
  const m = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --color-${name} not found in globals.css`);
  return m[1];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every surface text is actually set on. */
const BACKGROUNDS = ["bg", "panel", "panel-solid"] as const;

describe("text token contrast", () => {
  it("computes known ratios correctly", () => {
    // Sanity-check the implementation against values anyone can verify.
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  // Tokens used for running text, labels and values.
  const NORMAL_TEXT = [
    "ink",
    "dim",
    "faint",
    "signal",
    "signal-muted",
    "warn",
    "danger",
    "success",
    "hero",
  ];

  for (const name of NORMAL_TEXT) {
    it(`--color-${name} meets AA for normal text on every surface`, () => {
      for (const bg of BACKGROUNDS) {
        const ratio = contrast(token(name), token(bg));
        expect(
          ratio,
          `--color-${name} on --color-${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("keeps a readable hierarchy: ink brighter than dim, dim than faint", () => {
    const on = (n: string) => contrast(token(n), token("bg"));
    expect(on("ink")).toBeGreaterThan(on("dim"));
    expect(on("dim")).toBeGreaterThan(on("faint"));
  });

  it("does not letter anything with a structural token", () => {
    // --color-structure and --color-signal-deep are borders, rails and trim.
    // Both sit near 1.3:1 and 2:1 and have been mistaken for text colours
    // before; this records that they are not eligible.
    for (const name of ["structure", "structure-faint", "signal-deep"]) {
      expect(contrast(token(name), token("bg"))).toBeLessThan(4.5);
    }
    expect(CSS).not.toMatch(/\.stage-tag\s*\{[^}]*color:\s*var\(--color-structure\)/);
    expect(CSS).not.toMatch(/\.stage-item\.is-passed\s\.stage-tag\s*\{[^}]*signal-deep/);
  });

  it("never dims label text below AA with an opacity instead of a token", () => {
    // The failures this suite was written for were all opacity-on-text: a
    // compliant token multiplied down to 2.7:1. Labels dim by switching token.
    const offenders = [".node-label-tag", ".node-label-key", ".stage-item", ".cs-fine"];
    for (const sel of offenders) {
      const block = CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`));
      expect(block, `${sel} rule not found`).toBeTruthy();
      expect(block?.[1] ?? "", `${sel} dims text with opacity`).not.toMatch(/opacity:\s*0\.[0-8]/);
    }
  });
});
