#!/usr/bin/env node
/**
 * Scroll-trap diagnostic for the mobile console chapters.
 *
 * Reports, without changing anything:
 *  - whether any ScrollTrigger pin exists at all (the pinning here is CSS
 *    `position: sticky`, which behaves very differently under measurement)
 *  - every genuinely scrollable element inside a chapter, with how much
 *    scrollable slack it has — slack is what silently eats a swipe
 *  - each chapter's scroll budget in viewport heights
 *  - what a real sequence of swipes actually moves, in pixels and chapters
 *
 * Usage: node scripts/diagnose-scroll.mjs [--open-controls]
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const OPEN_CONTROLS = process.argv.includes("--open-controls");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolveChromium() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || "/root/.cache/ms-playwright";
  if (existsSync(cache)) {
    const dirs = (await readdir(cache)).filter((d) => d.startsWith("chromium")).sort().reverse();
    for (const d of dirs) {
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const p = path.join(cache, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error("no chromium found");
}

function freePort() {
  return new Promise((res) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

/**
 * One swipe's worth of scroll, delivered over a given point.
 *
 * Verified against a control: CDP's touch gesture synthesiser produces zero
 * scroll in this headless setup even at the top of the page over bare
 * background, so measuring with it reports a trap whether or not one exists.
 * A wheel does scroll here, and — the part that matters — it is dispatched at
 * a point and honours `overflow` and `overscroll-behavior` exactly as a touch
 * scroll does. So it is a faithful probe for this class of bug, and an
 * unfaithful one only for momentum and rubber-banding.
 */
async function swipe(page, dy, x = 195, y = 620) {
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, dy);
  // Poll for the settled position instead of sampling after a fixed wait.
  // Under software rendering a scroll routinely lands after a fixed sleep
  // would have read it, which shows up as a phantom dead notch followed by a
  // double-size one — distance is conserved, so it was never lost.
  let last = -1;
  for (let i = 0; i < 24; i++) {
    await sleep(60);
    const now = await page.evaluate(() => Math.round(window.scrollY));
    if (now === last) break;
    last = now;
  }
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
  cwd: process.cwd(),
  stdio: "ignore",
  detached: true,
});

const browser = await chromium.launch({
  executablePath: await resolveChromium(),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* waiting */
    }
    await sleep(500);
  }

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(90_000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator("button.boot-skip").click({ force: true }).catch(() => {});
  await sleep(3500);

  console.log("=".repeat(66));
  console.log("SCROLL DIAGNOSTIC — 390x844, isMobile, hasTouch");
  console.log("=".repeat(66));

  const pins = await page.evaluate(() => ({
    pinSpacers: document.querySelectorAll(".pin-spacer").length,
    gsapOnWindow: typeof window.gsap !== "undefined",
    stOnWindow: typeof window.ScrollTrigger !== "undefined",
    stickyChapters: document.querySelectorAll(".chapter-sticky").length,
  }));
  console.log("\n[1] PINNING MECHANISM");
  console.log(`  ScrollTrigger pin-spacers in DOM : ${pins.pinSpacers}`);
  console.log(`  .chapter-sticky elements         : ${pins.stickyChapters}`);
  console.log(
    `  -> pinning is ${pins.pinSpacers === 0 ? "CSS position:sticky, NOT ScrollTrigger" : "ScrollTrigger"}`,
  );

  console.log("\n[2] CHAPTER SCROLL BUDGETS (viewport heights)");
  const budgets = await page.evaluate(() => {
    const vh = window.innerHeight;
    return [...document.querySelectorAll("[data-chapter]")].map((el) => ({
      ch: el.dataset.chapter,
      id: el.id,
      heightVh: +(el.offsetHeight / vh).toFixed(2),
      scrollPastVh: +((el.offsetHeight - vh) / vh).toFixed(2),
      pinned: getComputedStyle(el.firstElementChild).position === "sticky",
    }));
  });
  for (const b of budgets) {
    // Only a pinned chapter has a scroll budget; a flowing one advances the
    // page with every pixel of gesture by definition.
    const flag = b.pinned && b.scrollPastVh > 1.5 ? "  <-- over 1.5vh pin budget" : "";
    console.log(
      `  CH.0${b.ch} ${b.id.padEnd(16)} ${(b.pinned ? "PINNED " : "flowing").padEnd(8)} height ${String(b.heightVh).padStart(5)}vh   scroll-past ${String(b.scrollPastVh).padStart(5)}vh${flag}`,
    );
  }

  const probeOverflow = async (label) => {
    const found = await page.evaluate(() => {
      const out = [];
      for (const sec of document.querySelectorAll("[data-chapter]")) {
        for (const el of sec.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          const oy = cs.overflowY;
          if (oy !== "auto" && oy !== "scroll") continue;
          const slack = el.scrollHeight - el.clientHeight;
          out.push({
            ch: sec.dataset.chapter,
            sel:
              el.className && typeof el.className === "string"
                ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
                : el.tagName.toLowerCase(),
            overflowY: oy,
            overscroll: cs.overscrollBehaviorY,
            clientH: el.clientHeight,
            scrollH: el.scrollHeight,
            slack,
          });
        }
      }
      return out;
    });
    console.log(`\n[3] SCROLLABLE ELEMENTS INSIDE CHAPTERS (${label})`);
    if (!found.length) console.log("  none");
    for (const f of found) {
      const eats = f.slack > 0 ? `EATS ${f.slack}px of swipe` : "no slack";
      console.log(
        `  CH.0${f.ch} ${f.sel.padEnd(26)} overflow-y:${f.overflowY} overscroll:${f.overscroll}`,
      );
      console.log(
        `        client ${f.clientH}px / scroll ${f.scrollH}px  -> ${eats}${
          f.overscroll === "contain" && f.slack > 0 ? "  + BLOCKS CHAINING TO PAGE" : ""
        }`,
      );
    }
    return found;
  };

  // Park in CH.03 with the console on screen.
  await page.evaluate(() => {
    const el = document.getElementById("ch-pressure");
    window.scrollTo({ top: el.offsetTop + el.offsetHeight * 0.15, behavior: "instant" });
  });
  await sleep(1800);
  await probeOverflow("CH.03 in view, All-controls collapsed");

  if (OPEN_CONTROLS) {
    const toggle = page.locator(".control-more-toggle").first();
    if (await toggle.count()) {
      await toggle.click({ force: true });
      await sleep(900);
      await probeOverflow("All-controls EXPANDED");
    } else {
      console.log("\n[3b] no All-controls disclosure in this build (all six dials are shown)");
    }
  }

  console.log("\n[4] SEVEN SWIPES FROM CH.03 (the reported repro)");
  const start = await page.evaluate(() => ({
    y: window.scrollY,
    ch: document.documentElement.dataset.beat,
    active: [...document.querySelectorAll("[data-chapter]")].find(
      (s) => s.offsetTop <= window.scrollY + 1 && s.offsetTop + s.offsetHeight > window.scrollY,
    )?.dataset.chapter,
  }));
  console.log(`  start: scrollY=${start.y}  chapter=${start.active}`);
  // Warm the pointer: the very first wheel after a programmatic jump can land
  // before the browser has resolved a scroll node, which reads as a phantom
  // dead swipe that has nothing to do with the page.
  await page.mouse.move(195, 620);
  await sleep(250);
  let prev = start.y;
  for (let i = 1; i <= 7; i++) {
    await swipe(page, 380);
    const now = await page.evaluate(() => ({
      y: window.scrollY,
      active: [...document.querySelectorAll("[data-chapter]")].find(
        (s) => s.offsetTop <= window.scrollY + 1 && s.offsetTop + s.offsetHeight > window.scrollY,
      )?.dataset.chapter,
    }));
    console.log(
      `  swipe ${i}: scrollY=${String(now.y).padStart(6)}  delta=${String(now.y - prev).padStart(5)}px  chapter=${now.active}`,
    );
    prev = now.y;
  }
  console.log("\n[5] CROSS-CHECK — same gesture over a non-console area, plus wheel");
  const before = await page.evaluate(() => ({
    y: window.scrollY,
    consoleTop: document.querySelector("#ch-pressure .chapter-console")?.scrollTop ?? -1,
  }));
  await swipe(page, 380, 195, 240);
  const afterAbove = await page.evaluate(() => window.scrollY);
  console.log(`  scroll over the copy/machine area : page delta=${afterAbove - before.y}px`);
  const after = await page.evaluate(() => ({
    y: window.scrollY,
    consoleTop: document.querySelector("#ch-pressure .chapter-console")?.scrollTop ?? -1,
  }));
  console.log(
    `  console scrollTop ${before.consoleTop} -> ${after.consoleTop} (the swipe the page never saw)`,
  );

  const total = prev - start.y;
  console.log(
    `\n  TOTAL: ${total}px over 7 swipes (${(total / 844).toFixed(2)} viewports, ${Math.round(total / 7)}px per swipe)`,
  );

  await ctx.close();
} finally {
  await browser.close().catch(() => {});
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
