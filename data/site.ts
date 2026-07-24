/**
 * Central site configuration. Edit this file to change identity, links and
 * metadata — nothing here is duplicated inside components.
 */

export const SITE = {
  name: "The Invisible Machine",
  title: "The Invisible Machine — Interactive Business Systems Experience",
  description:
    "Explore the hidden systems behind a modern business. An interactive experience about operations, bottlenecks, automation, and intelligent digital systems.",
  url: "https://im.downloadear.id",
  themeColor: "#08090b",
  author: {
    name: "John C.",
    role: "Systems-minded full-stack developer",
    email: "jtcandra@gmail.com",
  },
} as const;

export interface ContactLink {
  id: string;
  label: string;
  /** Leave empty to hide the link until a real URL is available. */
  href: string;
  description: string;
}

export const CONTACT_LINKS: ContactLink[] = [
  {
    id: "email",
    label: "Email",
    href: "mailto:jtcandra@gmail.com",
    description: "The most direct line into the machine.",
  },
  {
    id: "github",
    label: "GitHub",
    href: "https://github.com/sololuckio",
    description: "Source, experiments and build logs.",
  },
  // No LinkedIn entry until a verified profile URL exists — the link list
  // renders only real destinations, never placeholders.
];

/** Links rendered in the nav. Anchors refer to chapter section ids;
 *  paths are real routes. */
export const NAV_ITEMS = [
  { id: "experience", label: "Experience", href: "#ch-surface" },
  { id: "system", label: "System", href: "#ch-cta" },
  { id: "work", label: "Work", href: "#ch-creator" },
  { id: "case-study", label: "Case Study", href: "/case-study" },
  { id: "contact", label: "Contact", href: "#ch-cta" },
] as const;
