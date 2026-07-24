"use client";

import type { ReactNode } from "react";
import type { ChapterCopy } from "@/data/copy";
import { useReveal } from "@/hooks/useReveal";

/**
 * Shared scaffolding for narrative chapters: a tall scroll region with a
 * sticky viewport inside, so copy holds the screen while scroll drives the
 * machine behind it.
 */
export function ChapterSection({
  ch,
  heightClass,
  sticky = true,
  children,
  className = "",
}: {
  ch: ChapterCopy;
  heightClass: string;
  sticky?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={ch.anchor}
      data-chapter={ch.index}
      aria-labelledby={`${ch.anchor}-title`}
      className={`chapter ${heightClass} ${className}`}
    >
      <div className={sticky ? "chapter-sticky" : "chapter-flow"}>{children}</div>
    </section>
  );
}

/**
 * The chapter's editorial block: kicker, oversized headline, body copy.
 * Chapter 1 owns the page's h1.
 */
export function ChapterHeading({
  ch,
  as = "h2",
  bodyUpTo,
  size = "md",
}: {
  ch: ChapterCopy;
  as?: "h1" | "h2";
  /** Render only the first n body paragraphs (rest are placed manually). */
  bodyUpTo?: number;
  size?: "md" | "lg";
}) {
  const ref = useReveal<HTMLDivElement>();
  const Tag = as;
  const body = bodyUpTo === undefined ? ch.body : ch.body.slice(0, bodyUpTo);
  return (
    <div ref={ref} className={`chapter-heading size-${size}`}>
      <p className="tech-label chapter-kicker" data-reveal>
        {ch.kicker}
      </p>
      <Tag id={`${ch.anchor}-title`} className="chapter-title">
        {ch.headline.map((line, i) => (
          <span key={line} className="chapter-title-line" data-reveal>
            {/* Trailing space keeps copied text, screen readers and search
                from reading adjacent lines as one word. */}
            {i < ch.headline.length - 1 ? `${line} ` : line}
          </span>
        ))}
      </Tag>
      {body.map((p) => (
        <p key={p} className="chapter-body" data-reveal>
          {p}
        </p>
      ))}
    </div>
  );
}
