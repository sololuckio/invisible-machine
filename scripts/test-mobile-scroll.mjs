#!/usr/bin/env node
/**
 * Regression test: the mobile console must never trap scroll again.
 *
 * The bug this guards was a `.chapter-console` carrying `overflow-y: auto`
 * plus `overscroll-behavior: contain`. Once a thumb landed on it the page
 * froze completely — measured at exactly zero pixels across seven gestures,
 * with the panel's own scrollTop pinned at its maximum.
 *
 * Two assertions, because either alone can pass while the experience is
 * broken: that scrolling from chapter 3 actually arrives in chapter 4, and
 * that no element inside any chapter is a scroll container on a phone at all.
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
const SWIPE_PX = 400;

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

  // 1 — nothing inside a chapter may hold its own scroll on a phone.
  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll("[data-chapter] *")]
      .filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowY))
      .map((el) => (typeof el.className === "string" ? el.className : el.tagName)),
  );
  check(
    "no internal scroll container inside any chapter",
    scrollers.length === 0,
    scrollers.length ? scrollers.join(", ") : "none",
  );

  // 2 — with the disclosure expanded, which is when the trap was worst.
  await page.evaluate(() => {
    const el = document.getElementById("ch-pressure");
    window.scrollTo({ top: el.offsetTop, behavior: "instant" });
  });
  await settled(page);
  await page.locator(".control-more-toggle").first().click({ force: true }).catch(() => {});
  await sleep(700);
  const scrollersOpen = await page.evaluate(() =>
    [...document.querySelectorAll("[data-chapter] *")].filter((el) =>
      ["auto", "scroll"].includes(getComputedStyle(el).overflowY),
    ).length,
  );
  check("still none with All-controls expanded", scrollersOpen === 0, `${scrollersOpen} found`);

  // 3 — the headline assertion: three swipes from CH.03 arrive in CH.04.
  // Collapse the disclosure first. Now that the chapter flows rather than
  // pinning, expanded controls genuinely make the section taller — that is
  // correct behaviour, not a trap, and it would otherwise move the goalposts.
  await page.locator(".control-more.is-open .control-more-toggle").first().click({ force: true }).catch(() => {});
  await sleep(500);
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
