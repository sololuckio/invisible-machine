import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia; components use it for reduced-motion checks.
// (Guarded: the simulation suite runs in a plain node environment.)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
