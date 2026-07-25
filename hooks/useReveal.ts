"use client";

import { useEffect, useRef } from "react";

/**
 * Directed text reveals via GSAP ScrollTrigger, loaded lazily so gsap never
 * blocks the initial render. Content is visible by default — if the library
 * fails or motion is reduced, nothing is ever hidden.
 *
 * Three voices, not one animation applied everywhere:
 *   kicker  a technical index settling out of wide tracking
 *   lead    the narrative statement rising through a line mask
 *   body    a quiet lift, held back until the headline has landed
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup = () => {};
    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const ctx = gsap.context(() => {
          let lead = 0;
          let body = 0;
          targets.forEach((target, i) => {
            const kind = target.dataset.reveal;
            if (kind === "kicker") {
              gsap.from(target, {
                opacity: 0,
                y: 8,
                letterSpacing: "0.42em",
                duration: 0.95,
                ease: "power2.out",
                scrollTrigger: { trigger: target, start: "top 88%" },
              });
            } else if (kind === "lead") {
              // A mask reveal, line by line — the strongest treatment on the
              // page, reserved for the narrative statements.
              const n = lead++;
              gsap.from(target, {
                yPercent: 106,
                duration: 1.05,
                delay: n * 0.11,
                ease: "power3.out",
                scrollTrigger: { trigger: target.parentElement ?? target, start: "top 90%" },
              });
            } else {
              // Supporting copy waits for the headline, then simply arrives.
              const n = kind === "body" ? body++ : i;
              gsap.from(target, {
                opacity: 0,
                y: 22,
                duration: 0.85,
                delay: (kind === "body" ? 0.24 : 0) + (n % 4) * 0.08,
                ease: "power3.out",
                scrollTrigger: { trigger: target, start: "top 84%" },
              });
            }
          });
        }, el);
        cleanup = () => ctx.revert();
      } catch {
        // Reveals are decoration; the copy is already visible.
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return ref;
}
