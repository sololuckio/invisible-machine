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
    // TODO: replace with the full display name you want on the site.
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
    href: "", // TODO: add your personal GitHub profile URL.
    description: "Source, experiments and build logs.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "", // TODO: add your LinkedIn profile URL.
    description: "The professional layer.",
  },
];

/** Links rendered in the nav. Anchors refer to chapter section ids. */
export const NAV_ITEMS = [
  { id: "experience", label: "Experience", href: "#ch-surface" },
  { id: "system", label: "System", href: "#ch-cta" },
  { id: "work", label: "Work", href: "#ch-creator" },
  { id: "contact", label: "Contact", href: "#ch-cta" },
] as const;
