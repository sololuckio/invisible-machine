"use client";

import { CHAPTERS, UI_STRINGS } from "@/data/copy";
import { NAV_ITEMS, SITE } from "@/data/site";
import { restartExperience, scrollToAnchor } from "@/lib/experience";
import { useUIStore } from "@/store/uiStore";
import { IconSoundOff, IconSoundOn } from "./icons";
import { SettingsMenu } from "./SettingsMenu";

/**
 * The machine's own interface chrome: a top console bar, a chapter rail on
 * desktop, and a tappable chapter strip on mobile. No hamburger mazes —
 * every control is one interaction away.
 */

function SoundToggle() {
  const soundOn = useUIStore((s) => s.soundOn);
  const toggleSound = useUIStore((s) => s.toggleSound);
  return (
    <button
      type="button"
      className="btn btn-icon"
      aria-pressed={soundOn}
      aria-label={soundOn ? UI_STRINGS.soundOn : UI_STRINGS.soundOff}
      title={soundOn ? UI_STRINGS.soundOn : UI_STRINGS.soundOff}
      onClick={toggleSound}
    >
      {soundOn ? <IconSoundOn /> : <IconSoundOff />}
    </button>
  );
}

export function Nav() {
  const activeChapter = useUIStore((s) => s.activeChapter);
  const setLabOpen = useUIStore((s) => s.setLabOpen);
  const labOpen = useUIStore((s) => s.labOpen);

  return (
    <>
      {/* Top console bar */}
      <header className="nav-bar">
        <button
          type="button"
          className="nav-brand"
          onClick={() => restartExperience(false)}
          aria-label={`${SITE.name} — back to the top`}
        >
          <span className="nav-brand-title">THE INVISIBLE MACHINE</span>
          <span className="nav-brand-sub">TIM-01 · LIVE SYSTEM SIMULATION</span>
        </button>

        <nav className="nav-links" aria-label="Site">
          {NAV_ITEMS.map((item) =>
            item.id === "system" ? (
              <button
                key={item.id}
                type="button"
                className="nav-link"
                onClick={() => setLabOpen(true)}
              >
                {item.label}
              </button>
            ) : (
              <a
                key={item.id}
                className="nav-link"
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToAnchor(item.href.slice(1));
                }}
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="nav-controls">
          <SoundToggle />
          <SettingsMenu />
          <button
            id="lab-trigger"
            type="button"
            className="btn btn-primary nav-lab"
            aria-pressed={labOpen}
            onClick={() => setLabOpen(true)}
          >
            {UI_STRINGS.enterLab}
          </button>
        </div>
      </header>

      {/* Desktop chapter rail */}
      <nav className="chapter-rail" aria-label="Chapters">
        <div className="chapter-rail-track" aria-hidden="true">
          <div className="chapter-rail-progress" />
        </div>
        {CHAPTERS.map((ch) => (
          <button
            key={ch.id}
            type="button"
            className={`chapter-dot${activeChapter === ch.index ? " is-active" : ""}`}
            aria-label={`Chapter ${ch.index}: ${ch.title}`}
            aria-current={activeChapter === ch.index ? "step" : undefined}
            onClick={() => scrollToAnchor(ch.anchor)}
          >
            <span className="chapter-dot-marker" aria-hidden="true" />
            <span className="chapter-dot-label">
              {String(ch.index).padStart(2, "0")} {ch.title}
            </span>
          </button>
        ))}
      </nav>

      {/* Mobile chapter strip */}
      <nav className="chapter-strip" aria-label="Chapters">
        <div className="chapter-strip-progress" aria-hidden="true" />
        {CHAPTERS.map((ch) => (
          <button
            key={ch.id}
            type="button"
            className={`chapter-strip-seg${activeChapter === ch.index ? " is-active" : ""}`}
            aria-label={`Chapter ${ch.index}: ${ch.title}`}
            aria-current={activeChapter === ch.index ? "step" : undefined}
            onClick={() => scrollToAnchor(ch.anchor)}
          >
            {ch.index}
          </button>
        ))}
      </nav>
    </>
  );
}
