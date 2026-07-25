#!/usr/bin/env node
/**
 * Record the CH.03 -> CH.04 mobile scroll as video, so the feel can be
 * judged and not only the final position. A test that says "it moved 1600px"
 * cannot tell you whether it moved in one lurch or read as a normal page.
 *
 * Usage: node scripts/record-scroll.mjs [outDir]
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = path.resolve(process.argv[2] || "ux-review-v3");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolveChromium() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || "/root/.cache/ms-playwright";
  const dirs = (await readdir(cache)).filter((d) => d.startsWith("chromium")).sort().reverse();
  for (const d of dirs)
    for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
      const p = path.join(cache, d, rel);
      if (existsSync(p)) return p;
    }
  throw new Error("no chromium found");
}

const port = await new Promise((res) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
  cwd: process.cwd(),
  stdio: "ignore",
  detached: true,
});

await mkdir(OUT, { recursive: true });
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

  const viewport = { width: 390, height: 844 };
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: OUT, size: viewport },
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator("button.boot-skip").click({ force: true }).catch(() => {});
  await sleep(3500);

  // Start at the top of CH.03 with the console on screen.
  await page.evaluate(() => {
    const el = document.getElementById("ch-pressure");
    window.scrollTo({ top: el.offsetTop, behavior: "instant" });
  });
  await sleep(2000);

  // Swipe repeatedly over the console — the exact gesture that used to do
  // nothing at all — and let the recording show what each one produces.
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(195, 620);
    await sleep(90);
    await page.mouse.wheel(0, 300);
    await sleep(520);
  }
  await sleep(1200);

  const video = page.video();
  await ctx.close();
  if (video) {
    const src = await video.path();
    await rename(src, path.join(OUT, "ch03-to-ch04-scroll.webm"));
    console.log(`recorded -> ${path.relative(process.cwd(), path.join(OUT, "ch03-to-ch04-scroll.webm"))}`);
  }
} finally {
  await browser.close().catch(() => {});
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
