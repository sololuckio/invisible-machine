"use client";

import { useEffect, useRef, useState } from "react";
import { BOOT_LINES, UI_STRINGS } from "@/data/copy";
import { readSession, STORAGE_KEYS, writeSession } from "@/lib/storage";
import { useUIStore } from "@/store/uiStore";

/**
 * Chapter 0: the initialization sequence. Short, skippable, and remembered —
 * repeat visitors in the same session get a single-flash confirmation
 * instead of the full ritual. Reduced motion shows everything at once.
 */

const LINE_INTERVAL = 340;
const HOLD_AFTER = 650;
const FADE_MS = 600;

export function BootOverlay() {
  const bootDone = useUIStore((s) => s.bootDone);
  const finishBoot = useUIStore((s) => s.finishBoot);
  const [visibleLines, setVisibleLines] = useState(0);
  const [fading, setFading] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishedRef = useRef(false);
  const skipHandler = useRef<() => void>(() => {});

  useEffect(() => {
    if (bootDone) return;
    const localTimers = timers.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = readSession(STORAGE_KEYS.bootSeen) === "1";

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      writeSession(STORAGE_KEYS.bootSeen, "1");
      setFading(true);
      localTimers.push(setTimeout(() => finishBoot(), FADE_MS));
    };
    // Expose to the skip button via ref-stable closure.
    skipHandler.current = finish;

    if (seen) {
      // Repeat visit this session: flash SYSTEM READY, move on.
      setVisibleLines(BOOT_LINES.length);
      localTimers.push(setTimeout(finish, 450));
    } else if (reduced) {
      setVisibleLines(BOOT_LINES.length);
      localTimers.push(setTimeout(finish, 1100));
    } else {
      for (let i = 1; i <= BOOT_LINES.length; i++) {
        localTimers.push(setTimeout(() => setVisibleLines(i), i * LINE_INTERVAL));
      }
      localTimers.push(setTimeout(finish, BOOT_LINES.length * LINE_INTERVAL + HOLD_AFTER));
    }

    skipRef.current?.focus({ preventScroll: true });
    return () => {
      localTimers.forEach(clearTimeout);
    };
  }, [bootDone, finishBoot]);

  // Lock scroll while booting.
  useEffect(() => {
    if (bootDone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [bootDone]);

  if (bootDone) return null;

  const allShown = visibleLines >= BOOT_LINES.length;

  return (
    <div
      className={`boot-overlay${fading ? " is-fading" : ""}`}
      role="dialog"
      aria-label="System boot sequence"
      aria-modal="true"
    >
      <div className="boot-terminal" aria-hidden="true">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <p
            key={line}
            className={`boot-line${i === BOOT_LINES.length - 1 ? " boot-line-ready" : ""}`}
          >
            <span className="boot-index">{String(i).padStart(2, "0")}</span>
            {line}
            {i === visibleLines - 1 && !allShown && <span className="boot-caret" />}
          </p>
        ))}
      </div>
      <button
        ref={skipRef}
        type="button"
        className="btn btn-ghost boot-skip"
        onClick={() => skipHandler.current()}
      >
        {UI_STRINGS.skipIntro}
      </button>
    </div>
  );
}
