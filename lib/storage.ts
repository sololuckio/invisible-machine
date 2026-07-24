/**
 * sessionStorage that never throws — private browsing modes and storage
 * restrictions degrade to in-memory no-ops instead of crashing the page.
 */

const memory = new Map<string, string>();

function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.sessionStorage;
    const probe = "__tim_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readSession(key: string): string | null {
  const s = store();
  if (s) {
    try {
      return s.getItem(key);
    } catch {
      /* fall through to memory */
    }
  }
  return memory.get(key) ?? null;
}

export function writeSession(key: string, value: string): void {
  const s = store();
  if (s) {
    try {
      s.setItem(key, value);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memory.set(key, value);
}

export const STORAGE_KEYS = {
  bootSeen: "tim.boot.seen",
  sound: "tim.sound",
  quality: "tim.quality",
  view: "tim.view",
} as const;
