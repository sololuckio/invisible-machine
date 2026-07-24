"use client";

import { CHAPTERS, UI_STRINGS } from "@/data/copy";
import { CONTACT_LINKS, SITE } from "@/data/site";
import { restartExperience, scrollToAnchor } from "@/lib/experience";
import { useReveal } from "@/hooks/useReveal";
import { useUIStore } from "@/store/uiStore";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[7];

/**
 * The transmission ends where it began: the surface halves close over the
 * machine as the visitor decides what happens next.
 */
export function Chapter08Finale() {
  const setLabOpen = useUIStore((s) => s.setLabOpen);
  const ctaRef = useReveal<HTMLDivElement>();
  const email = CONTACT_LINKS.find((l) => l.id === "email");
  const visibleLinks = CONTACT_LINKS.filter((l) => l.href);

  return (
    <ChapterSection ch={ch} heightClass="min-h-[160vh]" className="finale">
      <div className="chapter-layout is-center">
        <div className="chapter-copy is-center">
          <ChapterHeading ch={ch} size="lg" />

          <div ref={ctaRef} className="finale-actions">
            <div className="finale-buttons" data-reveal>
              <button type="button" className="btn btn-primary" onClick={() => setLabOpen(true)}>
                {UI_STRINGS.enterLab}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => restartExperience(false)}
              >
                {UI_STRINGS.exploreAgain}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => scrollToAnchor("ch-creator")}
              >
                {UI_STRINGS.viewProjects}
              </button>
              {email && (
                <a className="btn btn-ghost" href={email.href}>
                  {UI_STRINGS.contactMe}
                </a>
              )}
            </div>

            <ul className="finale-links" data-reveal>
              {visibleLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    {...(link.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {link.label}
                  </a>
                  <span className="finale-link-desc">{link.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <footer className="colophon">
        <p className="tech-label">TIM-01 · END OF TRANSMISSION</p>
        <p>
          Every number on this page is computed live by the on-page simulation — no mock data, no
          video, no staged screenshots.
        </p>
        <p className="colophon-fine">
          © {new Date().getFullYear()} {SITE.author.name} · Next.js · React Three Fiber · TypeScript
          · a deterministic business simulation
        </p>
      </footer>
    </ChapterSection>
  );
}
