"use client";

import { useEffect } from "react";
import { scrollState } from "@/lib/scrollState";
import { useUIStore } from "@/store/uiStore";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Reads scroll position once per animation frame and publishes it to
 * `scrollState` (for the 3D camera and effects), a `--scroll-progress`
 * CSS variable (for nav progress bars) and the active-chapter store value.
 * No React re-renders on scroll.
 */
export function ScrollTracker() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    if (sections.length === 0) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;

      let cf = 1;
      let matched = false;
      for (const el of sections) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 1 && rect.bottom > 1) {
          const idx = Number(el.dataset.chapter);
          cf = idx + clamp(-rect.top / Math.max(1, rect.height - vh), 0, 0.999);
          matched = true;
          break;
        }
      }
      if (!matched) {
        const last = sections[sections.length - 1].getBoundingClientRect();
        cf = last.bottom <= 1 ? 8.999 : 1;
      }
      scrollState.chapterFloat = cf;

      const doc = document.documentElement;
      scrollState.progress = clamp(window.scrollY / Math.max(1, doc.scrollHeight - vh), 0, 1);

      const s1 = sections.find((el) => el.dataset.chapter === "1");
      if (s1) {
        const r = s1.getBoundingClientRect();
        // The split completes at ~80% of the chapter so the reveal line lands
        // while the machine is already showing.
        scrollState.surface = clamp(-r.top / Math.max(1, (r.height - vh) * 0.8), 0, 1);
      }
      const s2 = sections.find((el) => el.dataset.chapter === "2");
      if (s2) {
        const r = s2.getBoundingClientRect();
        scrollState.order = clamp(-r.top / Math.max(1, (r.height - vh) * 0.96), 0, 1);
      }

      doc.style.setProperty("--scroll-progress", scrollState.progress.toFixed(4));

      const chapter = clamp(Math.floor(cf), 1, 8);
      const ui = useUIStore.getState();
      if (ui.activeChapter !== chapter) ui.setActiveChapter(chapter);

      // The machine stays concealed until the surface starts to split.
      const open = scrollState.surface > 0.08 || cf >= 2;
      if (ui.surfaceOpen !== open) ui.setSurfaceOpen(open);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return null;
}
