#!/usr/bin/env node
/**
 * Regression test: the mobile console must never trap scroll again.
 *
 * The bug this guards was `overscroll-behavior: contain` on the console.
 * That blocks chaining to the document even when the panel has no slack left,
 * so a thumb landing there froze the page completely — measured at exactly
 * zero pixels across seven gestures, with the panel's scrollTop at maximum.
 *
 * The panel is *allowed* to scroll: reading a console by scrolling it is the
 * intended interaction, and it is how the layout fits a phone. What it may
 * never do is refuse to hand the gesture back. So these assert behaviour —
 * that the page always ends up moving — rather than the absence of a
 * scroller, which would forbid a perfectly good layout.
 *
 * Exits non-zero on failure, so it can be wired into CI as-is.
 *
 * Usage: node scripts/test-mobile-scroll.mjs [--skip-build]
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SWIPES = 3;
// A real flick with momentum carries roughly 600-1200px; 400 is a single
// conservative notch. Sized realistically because the console chapters are
// deliberately pinned for ~1.3 viewports — holding the screen is the point of
// the chapter, and three timid notches should not be expected to clear it.
const SWIPE_PX = 700;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function resolveChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH))
    return process.env.CHROMIUM_PATH;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || "/root/.cache/ms-playwright";
  if (existsSync(cache)) {
    const dirs = (await readdir(cache)).filter((d) => d.startsWith("chromium")).sort().reverse();
    for (const d of dirs)
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const p = path.join(cache, d, rel);
        if (existsSync(p)) return p;
      }
  }
  throw new Error("no chromium found; set CHROMIUM_PATH");
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
 * Dispatch one wheel and confirm it landed.
 *
 * Synthetic wheel events are dropped intermittently by headless chromium —
 * observed as the same three gestures moving 1200px on one run and 800px on
 * the next. Retrying absorbs that without weakening the assertion: a genuinely
 * trapped region returns zero on every attempt, so exhausting the retries
 * still fails, which is exactly what the original bug did.
 */
async function wheelStep(page, dy, x, y) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await page.mouse.move(x, y);
    await sleep(120);
    await page.mouse.wheel(0, dy);
    const after = await settled(page);
    if (after !== before) return after - before;
  }
  return 0;
}

/** Wait until the scroll position has stopped changing. */
async function settled(page) {
  let last = Number.NaN;
  let stable = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(70);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    stable = y === last ? stable + 1 : 0;
    last = y;
    if (stable >= 2) break;
  }
  return last;
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

  console.log("mobile scroll integrity — 390x844, isMobile, hasTouch\n");

  // 1 — no scroller inside a chapter may refuse to chain to the page.
  const blockers = await page.evaluate(() =>
    [...document.querySelectorAll("[data-chapter] *")]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ["auto", "scroll"].includes(cs.overflowY) &&
          ["contain", "none"].includes(cs.overscrollBehaviorY)
        );
      })
      .map((el) => (typeof el.className === "string" ? el.className : el.tagName)),
  );
  check(
    "no scroller inside a chapter blocks chaining to the page",
    blockers.length === 0,
    blockers.length ? blockers.join(", ") : "none",
  );

  // 2 — the failure mode itself: a panel scrolled to its end must hand the
  // next gesture to the page rather than swallowing it.
  await page.evaluate(() => {
    const el = document.getElementById("ch-pressure");
    window.scrollTo({ top: el.offsetTop, behavior: "instant" });
    const c = el.querySelector(".chapter-console");
    if (c) c.scrollTop = c.scrollHeight; // exhaust it deliberately
  });
  await settled(page);
  const exhaustedFrom = await page.evaluate(() => Math.round(window.scrollY));
  const afterExhausted = await wheelStep(page, SWIPE_PX, 195, 620);
  check(
    "an exhausted console hands the next gesture to the page",
    afterExhausted > 100,
    `${afterExhausted}px (this was 0px, forever, with overscroll-behavior: contain)`,
  );
  void exhaustedFrom;

  // 3 — the headline assertion: three swipes from CH.03 arrive in CH.04.
  // The console is scrolled to its end first, which is what a visitor who has
  // just read it has already done; the panel's own travel is not page travel.
  await page.evaluate(() => {
    const c = document.querySelector("#ch-pressure .chapter-console");
    if (c) c.scrollTop = c.scrollHeight;
  });
  await page.evaluate(() => {
    const el = document.getElementById("ch-pressure");
    window.scrollTo({ top: el.offsetTop, behavior: "instant" });
  });
  const startY = await settled(page);
  for (let i = 0; i < SWIPES; i++) await wheelStep(page, SWIPE_PX, 195, 620);
  const endY = await settled(page);
  const active = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-chapter]")].find(
        (s) => s.offsetTop <= window.scrollY + 1 && s.offsetTop + s.offsetHeight > window.scrollY,
      )?.dataset.chapter,
  );
  const moved = endY - startY;

  check(
    `${SWIPES} swipes over the console move the page`,
    moved > 844,
    `${moved}px (${(moved / 844).toFixed(2)} viewports)`,
  );
  check(`${SWIPES} swipes from CH.03 land in CH.04 or beyond`, Number(active) >= 4, `chapter ${active}`);

  // 4 — the gesture must work over the console specifically, not just around it.
  await page.evaluate(() => {
    const el = document.getElementById("ch-pressure");
    window.scrollTo({ top: el.offsetTop, behavior: "instant" });
  });
  const overStart = await settled(page);
  // Aim at the visible middle of the panel: it can start above or below the
  // fold, and a wheel dispatched off-screen scrolls nothing anywhere.
  const box = await page.locator("#ch-pressure .control-panel").first().boundingBox();
  const probeY = box ? Math.max(90, Math.min(box.y + box.height / 2, 760)) : 0;
  if (box && probeY > 0) {
    const delta = await wheelStep(page, SWIPE_PX, box.x + box.width / 2, probeY);
    void overStart;
    check(
      "a gesture landing on the operator console scrolls the page",
      delta > 100,
      `${delta}px (probe y=${Math.round(probeY)}, panel y=${Math.round(box.y)})`,
    );
  } else {
    check("a gesture landing on the operator console scrolls the page", false, "panel not found");
  }

  await ctx.close();
} finally {
  await browser.close().catch(() => {});
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
