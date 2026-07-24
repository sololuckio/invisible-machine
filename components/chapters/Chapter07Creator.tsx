"use client";

import { IconArrowUpRight } from "@/components/ui/icons";
import { CHAPTERS } from "@/data/copy";
import { CAPABILITIES, PROJECTS } from "@/data/projects";
import { SITE } from "@/data/site";
import { useReveal } from "@/hooks/useReveal";
import { ChapterHeading, ChapterSection } from "./ChapterShell";

const ch = CHAPTERS[6];

/**
 * The reveal: the machine was a self-portrait. Capabilities are presented
 * as operating modes of the same system, and featured work as other
 * machines already running.
 */
export function Chapter07Creator() {
  const modesRef = useReveal<HTMLDivElement>();
  const workRef = useReveal<HTMLDivElement>();

  return (
    <ChapterSection ch={ch} heightClass="min-h-[100vh]" sticky={false}>
      <div className="creator-wrap">
        <div className="chapter-copy">
          <ChapterHeading ch={ch} />
          <p className="creator-byline">
            {SITE.author.name} — {SITE.author.role}
          </p>
        </div>

        <div ref={modesRef} className="creator-modes">
          <p className="tech-label" data-reveal>
            Operating modes of the same machine
          </p>
          <ul className="modes-grid">
            {CAPABILITIES.map((cap) => (
              <li key={cap.id} className="mode-card" data-reveal>
                <span className="tech-label">{cap.mode}</span>
                <h3>{cap.name}</h3>
                <p>{cap.description}</p>
              </li>
            ))}
          </ul>
        </div>

        <div ref={workRef} className="creator-work">
          <p className="tech-label" data-reveal>
            Machines already running
          </p>
          <ul className="work-grid">
            {PROJECTS.map((project) => (
              <li key={project.id} className="work-card" data-reveal>
                <div className="work-card-head">
                  <span className="tech-label">{project.tag}</span>
                  <span
                    className={`work-status status-text-${project.status === "live" ? "nominal" : "idle"}`}
                  >
                    {project.status === "live" ? "LIVE" : project.status.toUpperCase()}
                  </span>
                </div>
                <h3>{project.name}</h3>
                <p className="work-role">{project.role}</p>
                <p className="work-summary">{project.summary}</p>
                <p className="work-stack">{project.stack.join(" · ")}</p>
                {project.url ? (
                  <a
                    className="work-link"
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit {project.name} <IconArrowUpRight />
                  </a>
                ) : (
                  <span className="work-link is-here">You are inside it right now</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChapterSection>
  );
}
