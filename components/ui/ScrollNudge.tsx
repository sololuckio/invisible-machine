"use client";

import { useEffect, useState } from "react";
import { IconArrowDown } from "@/components/ui/icons";
import { UI_STRINGS } from "@/data/copy";

/**
 * An escape hatch for anyone who has stopped moving.
 *
 * The chapters hold the screen while the machine plays, which is the point —
 * but it means a visitor who pauses gets no confirmation that scrolling is
 * still what advances things. After four seconds of stillness, with page left
 * to travel, the cue that started the journey comes back.
 *
 * It hides on the first sign of intent (scroll, key, touch) and never appears
 * once the document is within a screen of its end, where the finale's own
 * calls to action have taken over.
 */

const IDLE_MS = 4000;

export function ScrollNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const canScrollFurther = () =>
      document.documentElement.scrollHeight - window.scrollY - window.innerHeight >
      window.innerHeight * 0.9;

    const arm = () => {
      if (timer) clearTimeout(timer);
      setVisible(false);
      timer = setTimeout(() => {
        // Re-check at fire time: the page may have reached the end, or a
        // dialog may have taken over, since the timer was armed.
        if (canScrollFurther() && !document.querySelector(".lab-overlay, .boot-overlay")) {
          setVisible(true);
        }
      }, IDLE_MS);
    };

    const opts = { passive: true } as const;
    window.addEventListener("scroll", arm, opts);
    window.addEventListener("touchstart", arm, opts);
    window.addEventListener("keydown", arm);
    window.addEventListener("wheel", arm, opts);
    arm();

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", arm);
      window.removeEventListener("touchstart", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("wheel", arm);
    };
  }, []);

  if (!visible) return null;

  return (
    <p className="scroll-nudge" aria-hidden="true">
      <IconArrowDown /> {UI_STRINGS.scrollHint}
    </p>
  );
}
