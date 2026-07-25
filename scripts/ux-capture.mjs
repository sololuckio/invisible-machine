#!/usr/bin/env node
/**
 * UX capture pass — screenshots only, no assertions and no fixes.
 *
 * Builds the app, serves the production build on a free port, drives it with
 * Playwright chromium and writes a numbered JPEG sequence to ./ux-review/,
 * plus an INDEX.txt describing every frame.
 *
 *   node scripts/ux-capture.mjs              # build, serve, capture
 *   node scripts/ux-capture.mjs --skip-build # reuse an existing .next
 *
 * Notes for anyone re-running this:
 *  - Scrolling MUST use behavior "instant". The page sets `scroll-behavior:
 *    smooth`, so a default programmatic scroll is still animating when the
 *    frame is sampled and you capture the wrong chapter.
 *  - This box renders WebGL through SwiftShader (software), so everything is
 *    far slower than real hardware and CSS transitions land late. Waits here
 *    are deliberately generous; poll for state rather than trusting a sleep.
 *  - Controls that appear in a chapter console also exist inside the System
 *    Lab overlay, so every interaction is scoped to its chapter's section id.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Output directory; override with UX_OUT to capture an after-pass alongside. */
const OUT = path.join(ROOT, process.env.UX_OUT || "ux-review");
const SKIP_BUILD = process.argv.includes("--skip-build");

/** Software-GL flags: without these there is no WebGL on a headless box. */
const GL_ON = [
  "--no-sandbox",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];
/** The opposite: what a visitor with no WebGL at all sees. */
const GL_OFF = ["--no-sandbox", "--disable-webgl", "--disable-webgl2"];

const CHAPTERS = [
  ["ch-surface", "CH.01 — The surface"],
  ["ch-order", "CH.02 — One order enters"],
  ["ch-pressure", "CH.03 — The system under pressure"],
  ["ch-bottleneck", "CH.04 — Bottleneck"],
  ["ch-intelligence", "CH.05 — Activate intelligence"],
  ["ch-compare", "CH.06 — Before & after"],
  ["ch-creator", "CH.07 — The creator"],
  ["ch-cta", "CH.08 — Transmission"],
];

const index = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(file, what, note) {
  index.push({ file, what, note });
  console.log(`  ${file.padEnd(34)} ${what}${note ? `  [${note}]` : ""}`);
}

function skipped(n, slug, what, why) {
  const file = `${String(n).padStart(2, "0")}-${slug} (NOT CAPTURED)`;
  index.push({ file, what, note: `SKIPPED: ${why}` });
  console.log(`  ${file.padEnd(34)} ${what}  [SKIPPED: ${why}]`);
}

/** Capture the viewport as a numbered JPEG and log what it shows. */
async function shot(page, n, slug, what, note) {
  const file = `${String(n).padStart(2, "0")}-${slug}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 70 });
  record(file, what, note);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`server did not answer at ${url}`);
}

/** Prefer an explicit path, then any cached Playwright chromium, then system Chrome. */
async function resolveChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
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
  for (const p of ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "No chromium found. Set CHROMIUM_PATH, or run: npx playwright install chromium",
  );
}

/** Jump straight to a scroll position — never let CSS smooth-scroll animate it. */
async function scrollTo(page, anchor, fraction = 0) {
  await page.evaluate(
    ([id, f]) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`no #${id}`);
      const top = el.offsetTop + (el.offsetHeight - window.innerHeight) * f;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    },
    [anchor, fraction],
  );
}

async function settle(page, ms = 2500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(ms);
}

/** The intro is skippable and remembered; dismiss it so content is visible. */
async function dismissBoot(page) {
  const skip = page.locator("button.boot-skip");
  try {
    await skip.waitFor({ state: "visible", timeout: 12_000 });
    await skip.click({ force: true });
  } catch {
    /* already past the intro */
  }
  await page.waitForSelector(".boot-overlay", { state: "detached", timeout: 20_000 }).catch(() => {});
}

/**
 * Drive a React-controlled range input the way a user would: set the value
 * through the native setter, then fire `input` so React's onChange runs.
 * `fill()` does not work on type=range.
 */
async function setSlider(page, sectionId, label, value) {
  const input = page.locator(`#${sectionId} input[type="range"]`).filter({
    has: page.locator("xpath=.."),
  });
  const handle = await page.evaluateHandle(
    ([sid, lbl]) => {
      const scope = document.getElementById(sid);
      const el = [...scope.querySelectorAll("label")].find(
        (l) => l.textContent.trim().toLowerCase() === lbl.toLowerCase(),
      );
      return el ? document.getElementById(el.htmlFor) : null;
    },
    [sectionId, label],
  );
  const el = handle.asElement();
  if (!el) throw new Error(`slider "${label}" not found in #${sectionId}`);
  await page.evaluate(
    ([node, v]) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(node, String(v));
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [el, value],
  );
  void input;
}

async function desktopPass(browser, base) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(90_000);

  // 01 — what a visitor actually sees first, before the 3D bundle arrives.
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await shot(page, 1, "first-paint", "/ at DOMContentLoaded, before three.js loads");

  await dismissBoot(page);
  await settle(page, 3000);

  // 02–09 — each chapter in turn.
  for (let i = 0; i < CHAPTERS.length; i++) {
    const [anchor, title] = CHAPTERS[i];
    await scrollTo(page, anchor);
    await settle(page);
    await shot(page, i + 2, anchor.replace("ch-", "chapter-"), title);
  }

  // 10 — stress the system from the real console, then let it run.
  try {
    await scrollTo(page, "ch-pressure", 0.35);
    await settle(page, 1500);
    await setSlider(page, "ch-pressure", "Demand", 90);
    await setSlider(page, "ch-pressure", "Staff capacity", 30);
    await sleep(10_000);
    await shot(page, 10, "stress-demand90-staff30", "CH.03 console + machine after 10s at demand 90 / staff 30");
  } catch (err) {
    skipped(10, "stress-demand90-staff30", "CH.03 stressed console", err.message);
  }

  // 11 — open the inspector on whichever station the engine actually flagged.
  try {
    await scrollTo(page, "ch-bottleneck", 0.5);
    await settle(page, 2000);
    const name = await page
      .locator("#ch-bottleneck .bottleneck-callout strong")
      .first()
      .textContent()
      .catch(() => null);
    const station = (name || "").replace(/\s*\(.*\)\s*$/, "").trim();
    if (station) {
      await page.locator(`#ch-bottleneck .chip`, { hasText: station }).first().click({ force: true });
    } else {
      await page.locator("#ch-bottleneck .chip.status-critical, #ch-bottleneck .chip.status-strained").first().click({ force: true });
    }
    await settle(page, 2000);
    await shot(page, 11, "bottleneck-inspector", "CH.04 inspector open on the flagged station", station || "no constraint named");
  } catch (err) {
    skipped(11, "bottleneck-inspector", "CH.04 inspector on flagged station", err.message);
  }

  // 12 — run the intelligence scan and wait for the recommendation.
  try {
    await scrollTo(page, "ch-intelligence", 0.3);
    await settle(page, 1500);
    await page
      .locator('#ch-intelligence button', { hasText: "Activate Intelligence" })
      .first()
      .click({ force: true });
    await page
      .locator("#ch-intelligence", { hasText: "Apply recommendation" })
      .first()
      .waitFor({ timeout: 30_000 });
    await settle(page, 1500);
    await shot(page, 12, "intelligence-scan-result", "CH.05 scan complete, ranked recommendations shown");
  } catch (err) {
    skipped(12, "intelligence-scan-result", "CH.05 scan result", err.message);
  }

  // 13 — the before/after ledger.
  try {
    await scrollTo(page, "ch-compare", 0.3);
    await settle(page, 1500);
    await page
      .locator("#ch-compare button", { hasText: "Run the comparison" })
      .first()
      .click({ force: true });
    await sleep(6000);
    await settle(page, 2000);
    await shot(page, 13, "before-after-ledger", "CH.06 comparison ledger populated");
  } catch (err) {
    skipped(13, "before-after-ledger", "CH.06 comparison ledger", err.message);
  }

  await ctx.close();
}

async function noWebglPass(base, exe) {
  const browser = await chromium.launch({ executablePath: exe, args: GL_OFF });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(90_000);
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await scrollTo(page, "ch-pressure", 0.35);
    await settle(page, 3000);
    const isDiagram = await page.locator("svg.system-diagram, .diagram-backdrop svg").count();
    await shot(
      page,
      14,
      "no-webgl-diagram",
      "CH.03 with WebGL disabled — 2D SVG fallback",
      isDiagram ? "SVG diagram present" : "no diagram svg matched",
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
}

async function mobilePass(browser, base) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(90_000);

  await page.goto(base, { waitUntil: "domcontentloaded" });
  await dismissBoot(page);
  await settle(page, 3000);
  await shot(page, 15, "mobile-hero", "Mobile 390×844 — hero / CH.01");

  const frames = [
    [16, "mobile-chapter-pressure", "ch-pressure", 0.35, "Mobile — CH.03 operator console"],
    [17, "mobile-chapter-bottleneck", "ch-bottleneck", 0.5, "Mobile — CH.04 machine at the constraint"],
    [18, "mobile-chapter-finale", "ch-cta", 0.5, "Mobile — CH.08 finale"],
  ];
  for (const [n, slug, anchor, frac, what] of frames) {
    try {
      await scrollTo(page, anchor, frac);
      await settle(page);
      await shot(page, n, slug, what);
    } catch (err) {
      skipped(n, slug, what, err.message);
    }
  }
  await ctx.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const exe = await resolveChromium();
  console.log(`chromium: ${exe}`);

  if (!SKIP_BUILD) {
    console.log("\n> npm run build");
    await run("npm", ["run", "build"]);
  } else {
    console.log("\n(skipping build)");
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  console.log(`\n> npm run start -- -p ${port}`);
  const server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });
  let browser;
  try {
    await waitForServer(base);
    console.log(`server up at ${base}\n`);
    browser = await chromium.launch({ executablePath: exe, args: GL_ON });

    console.log("DESKTOP PASS (1440×900)");
    await desktopPass(browser, base);

    console.log("\nNO-WEBGL PASS");
    try {
      await noWebglPass(base, exe);
    } catch (err) {
      skipped(14, "no-webgl-diagram", "CH.03 WebGL-disabled fallback", err.message);
    }

    console.log("\nMOBILE PASS (390×844)");
    await mobilePass(browser, base);
  } finally {
    if (browser) await browser.close().catch(() => {});
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }

  const lines = [
    "UX CAPTURE INDEX",
    `captured: ${new Date().toISOString()}`,
    `desktop 1440x900 dsf1 · mobile 390x844 dsf1 isMobile+hasTouch · JPEG q70`,
    "",
    ...index.map((e) => `${e.file}\n    ${e.what}${e.note ? `\n    note: ${e.note}` : ""}`),
  ];
  await writeFile(path.join(OUT, "INDEX.txt"), lines.join("\n") + "\n");

  console.log(`\n${index.length} entries → ${path.relative(ROOT, OUT)}/INDEX.txt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
