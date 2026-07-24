"use client";

import { useEffect, useRef } from "react";

/**
 * Staggered text reveals via GSAP ScrollTrigger, loaded lazily so gsap never
 * blocks the initial render. Content is visible by default — if the library
 * fails or motion is reduced, nothing is ever hidden.
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
          targets.forEach((target, i) => {
            gsap.from(target, {
              opacity: 0,
              y: 26,
              duration: 0.9,
              delay: (i % 4) * 0.09,
              ease: "power3.out",
              scrollTrigger: { trigger: target, start: "top 84%" },
            });
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
