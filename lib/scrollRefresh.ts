/**
 * Ask GSAP to re-measure its triggers after something changed height.
 *
 * The reveal animations record element positions when they are created. When
 * a disclosure expands mid-page it moves everything below it, and those
 * recorded positions become wrong — reveals fire early, late, or sit in a dead
 * zone that never fires at all.
 *
 * Debounced, because a toggle can be tapped repeatedly and a refresh forces a
 * full layout read of every trigger on the page. The import resolves from the
 * module cache when the reveal hook has already pulled GSAP in, and is a
 * no-op if it never did.
 */

let timer: ReturnType<typeof setTimeout> | null = null;

export function refreshScrollTriggers(delay = 180): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void import("gsap/ScrollTrigger")
      .then(({ ScrollTrigger }) => ScrollTrigger.refresh())
      .catch(() => {
        /* GSAP was never loaded — nothing has stale measurements. */
      });
  }, delay);
}
