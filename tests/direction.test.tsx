// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChapterHeading } from "@/components/chapters/ChapterShell";
import { HERO_STOPS, heroAt } from "@/components/experience/curves";
import { CHAPTERS } from "@/data/copy";
import { CONTACT_LINKS, NAV_ITEMS, SITE } from "@/data/site";
import { PROJECTS } from "@/data/projects";
import { soundEngine } from "@/lib/audio";
import { computeStage, type StageInput } from "@/lib/stage";
import { useUIStore } from "@/store/uiStore";

const BASE: StageInput = {
  chapterFloat: 1,
  surface: 0,
  scanning: false,
  scanComplete: false,
  restructuring: false,
  labOpen: false,
  reducedMotion: false,
  engagedChapter: null,
};

const at = (over: Partial<StageInput>) => computeStage({ ...BASE, ...over });

afterEach(cleanup);

describe("stage direction", () => {
  it("stages the surface opening through its beats", () => {
    expect(at({ surface: 0.02 }).beat).toBe("stillness");
    expect(at({ surface: 0.15 }).beat).toBe("instability");
    expect(at({ surface: 0.3 }).beat).toBe("ignition");
    expect(at({ surface: 0.6 }).beat).toBe("release");
    expect(at({ surface: 0.95 }).beat).toBe("descent");
  });

  it("escalates chapter four instead of switching to a warning", () => {
    expect(at({ chapterFloat: 4.02, surface: 1 }).beat).toBe("pressure");
    expect(at({ chapterFloat: 4.2, surface: 1 }).beat).toBe("rising");
    expect(at({ chapterFloat: 4.45, surface: 1 }).beat).toBe("compression");
    expect(at({ chapterFloat: 4.68, surface: 1 }).beat).toBe("lock");
    expect(at({ chapterFloat: 4.9, surface: 1 }).beat).toBe("inspect");
  });

  it("gives the lock beat the lowest energy of the pressure sequence", () => {
    const rising = at({ chapterFloat: 4.2, surface: 1 }).energy;
    const compression = at({ chapterFloat: 4.45, surface: 1 }).energy;
    const lock = at({ chapterFloat: 4.68, surface: 1 }).energy;
    expect(compression).toBeGreaterThan(rising);
    expect(lock).toBeLessThan(rising);
  });

  it("hands the intelligence chapter between story and controls", () => {
    expect(at({ chapterFloat: 5.2, surface: 1 }).beat).toBe("prescan");
    expect(at({ chapterFloat: 5.2, surface: 1, scanning: true }).cinematic).toBe(true);
    expect(at({ chapterFloat: 5.2, surface: 1, scanComplete: true }).cinematic).toBe(false);
  });

  it("treats an applied recommendation as its own payoff beat", () => {
    expect(at({ chapterFloat: 5.5, surface: 1, restructuring: true }).beat).toBe("restructure");
  });

  it("mirrors the opening with a closure beat", () => {
    expect(at({ chapterFloat: 8.2, surface: 1 }).beat).toBe("closure");
    expect(at({ chapterFloat: 8.2, surface: 1 }).cinematic).toBe(true);
  });

  it("keeps the visitor above the story", () => {
    // Working a console ends cinematic mode for that chapter…
    expect(at({ chapterFloat: 4.45, surface: 1, engagedChapter: 4 }).cinematic).toBe(false);
    // …but not for a chapter they have moved on from.
    expect(at({ chapterFloat: 4.45, surface: 1, engagedChapter: 3 }).cinematic).toBe(true);
    // The Lab is always control mode.
    expect(at({ chapterFloat: 4.45, surface: 1, labOpen: true }).cinematic).toBe(false);
    expect(at({ chapterFloat: 4.45, surface: 1, labOpen: true }).beat).toBe("lab");
  });

  it("never hides instrumentation or runs hot under reduced motion", () => {
    for (const cf of [1.2, 2.4, 4.45, 5.5, 8.2]) {
      const stage = computeStage({ ...BASE, chapterFloat: cf, surface: 0.3, reducedMotion: true });
      expect(stage.cinematic).toBe(false);
      expect(stage.energy).toBeLessThanOrEqual(0.4);
    }
  });
});

describe("hero order timeline", () => {
  it("finds every station along the journey, in order", () => {
    expect(HERO_STOPS).toHaveLength(7);
    for (let i = 1; i < HERO_STOPS.length; i++) {
      expect(HERO_STOPS[i]).toBeGreaterThan(HERO_STOPS[i - 1]);
    }
  });

  it("never moves backwards as scroll advances", () => {
    let previous = -1;
    for (let x = 0; x <= 1; x += 0.005) {
      const u = heroAt(x).u;
      expect(u).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = u;
    }
  });

  it("stops to be processed at stations and accelerates between them", () => {
    const dwells: number[] = [];
    let travelled = false;
    for (let x = 0; x <= 1; x += 0.002) {
      const f = heroAt(x);
      if (f.stop >= 0) {
        expect(f.speed).toBe(0);
        if (!dwells.includes(f.stop)) dwells.push(f.stop);
      } else if (f.speed > 0.9) {
        travelled = true;
      }
    }
    // Every station handles it, and it really does get up to speed in between.
    expect(dwells).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(travelled).toBe(true);
  });

  it("is a pure function of scroll, so scrubbing back is identical", () => {
    const forward = [0.13, 0.37, 0.62, 0.88].map((x) => heroAt(x).u);
    const backward = [0.88, 0.62, 0.37, 0.13].map((x) => heroAt(x).u).reverse();
    expect(forward).toEqual(backward);
  });
});

describe("sound", () => {
  it("is off until the visitor asks for it", () => {
    expect(useUIStore.getState().soundOn).toBe(false);
    expect(soundEngine.isEnabled).toBe(false);
  });

  it("survives an environment with no Web Audio at all", () => {
    // jsdom has no AudioContext: every call must degrade, never throw.
    expect(() => soundEngine.enable()).not.toThrow();
    expect(soundEngine.isEnabled).toBe(false);
    expect(() => {
      soundEngine.setAmbient(0.5);
      soundEngine.setTension(0.4);
      soundEngine.seamIgnite();
      soundEngine.constraintLock();
      soundEngine.scan();
      soundEngine.finalResonance();
      soundEngine.suspend();
      soundEngine.resume();
      soundEngine.disable();
      soundEngine.destroy();
    }).not.toThrow();
    expect(soundEngine.isEnabled).toBe(false);
  });
});

describe("narrative text integrity", () => {
  beforeEach(() => {
    useUIStore.setState({ reducedMotion: false });
  });

  it("renders each headline as one readable sentence", () => {
    render(<ChapterHeading ch={CHAPTERS[0]} as="h1" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("A business looks simple from the outside.");
    // No line boundary may fuse two words together.
    expect(heading.textContent).not.toMatch(/[a-z][A-Z]/);
    expect(heading.textContent).not.toMatch(/[a-z]\.[A-Z]/);
  });

  it("keeps every chapter headline free of joined words", () => {
    for (const ch of CHAPTERS) {
      const joined = ch.headline.join(" ");
      expect(joined).not.toMatch(/[a-z][A-Z]/);
    }
  });
});

describe("case study", () => {
  it("describes the recommendation system accurately", async () => {
    const { default: CaseStudy } = await import("@/app/case-study/page");
    const { container } = render(<CaseStudy />);
    const text = container.textContent ?? "";
    expect(text).toContain(
      "deterministic operational decision engine that analyzes live simulation state and ranks interventions",
    );
    // No claim of a remote model doing the analysis.
    expect(text).not.toMatch(/\b(GPT|OpenAI|LLM|large language model)\b/i);
    expect(text).toContain("John C.");
  });
});

describe("portfolio identity", () => {
  it("stays John C.", () => {
    expect(SITE.author.name).toBe("John C.");
  });

  it("offers only real destinations", () => {
    const hrefs = [
      ...CONTACT_LINKS.map((l) => l.href),
      ...NAV_ITEMS.map((n) => n.href),
      ...PROJECTS.map((p) => p.url ?? ""),
    ].filter(Boolean);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).not.toBe("#");
      expect(href.trim()).not.toBe("");
      expect(href).not.toMatch(/linkedin/i);
      expect(href).not.toMatch(/example\.com/i);
    }
    expect(CONTACT_LINKS.some((l) => l.href === "https://github.com/sololuckio")).toBe(true);
    expect(CONTACT_LINKS.some((l) => l.href === "mailto:jtcandra@gmail.com")).toBe(true);
    expect(NAV_ITEMS.some((n) => n.href === "/case-study")).toBe(true);
  });
});
