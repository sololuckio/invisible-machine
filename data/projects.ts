/**
 * Featured work. Add or edit projects here — the Creator chapter renders
 * whatever this array contains.
 */

export interface Project {
  id: string;
  name: string;
  /** Machine-style designation rendered as a technical label. */
  tag: string;
  role: string;
  summary: string;
  stack: string[];
  /** Leave empty to render the project without an outbound link. */
  url: string;
  status: "live" | "in-development" | "case-study";
}

export const PROJECTS: Project[] = [
  {
    id: "sololuck",
    name: "SoloLuck.io",
    tag: "SYS-A",
    role: "Design, engineering, operations",
    summary:
      "A public solo Bitcoin mining pool for Southeast Asia — stratum infrastructure, real-time miner dashboards, transparent pool statistics and an automated growth engine, run as a live production system.",
    stack: ["ckpool", "Bitcoin Core", "Python", "Node.js", "Linux"],
    url: "https://sololuck.io",
    status: "live",
  },
  {
    id: "care-physio",
    name: "Care Physio",
    tag: "SYS-B",
    role: "Design, engineering, SEO",
    summary:
      "A multilingual website for a physiotherapy clinic in Bandung — five languages, an educational content system, an AI assistant that answers patient questions, and a measurable search-visibility pipeline.",
    stack: ["Astro", "TypeScript", "Claude API", "Nginx"],
    url: "https://www.care-physio.com",
    status: "live",
  },
  {
    id: "invisible-machine",
    name: "The Invisible Machine",
    tag: "SYS-C",
    role: "Concept, simulation, 3D, everything",
    summary:
      "This site. A deterministic business simulation wired into a cinematic 3D machine — the experience you are inside right now.",
    stack: ["Next.js", "TypeScript", "Three.js", "React Three Fiber", "Zustand"],
    url: "",
    status: "live",
  },
];

export interface Capability {
  id: string;
  name: string;
  /** Rendered as the machine's operating-mode label. */
  mode: string;
  description: string;
}

/** Presented as operating modes of the same machine, not a skills list. */
export const CAPABILITIES: Capability[] = [
  {
    id: "full-stack",
    name: "Full-stack development",
    mode: "MODE 01",
    description:
      "From database to pixel: APIs, infrastructure, interfaces and the plumbing between them.",
  },
  {
    id: "interactive",
    name: "Interactive web experiences",
    mode: "MODE 02",
    description:
      "Real-time graphics, simulation and motion in the browser — used to explain, not to decorate.",
  },
  {
    id: "systems-analysis",
    name: "Systems analysis",
    mode: "MODE 03",
    description:
      "Finding the constraint. Every underperforming business has one; most dashboards hide it.",
  },
  {
    id: "dataviz",
    name: "Data visualization",
    mode: "MODE 04",
    description:
      "Turning operational data into pictures that change decisions instead of filling slides.",
  },
  {
    id: "process-design",
    name: "Business-process design",
    mode: "MODE 05",
    description:
      "Mapping how orders, money and decisions actually move, then redesigning the path of least friction.",
  },
  {
    id: "ai-automation",
    name: "AI automation",
    mode: "MODE 06",
    description:
      "Wiring intelligence into workflows so systems act on their own state — the way this machine just did.",
  },
  {
    id: "seo",
    name: "SEO & technical optimization",
    mode: "MODE 07",
    description:
      "Performance budgets, structured data and search visibility treated as engineering, not afterthought.",
  },
];

export interface CapabilityCluster {
  id: string;
  name: string;
  summary: string;
  /** Capability ids, in the order they should read inside the cluster. */
  capabilities: string[];
}

/**
 * Seven modes listed flat is a skills list, which is the one thing this
 * section is trying not to be. Grouped into three, it reads as what the
 * machine actually does: understand a system, build the thing, then let it
 * run itself.
 */
export const CAPABILITY_CLUSTERS: CapabilityCluster[] = [
  {
    id: "build",
    name: "Build",
    summary: "Make the thing, end to end.",
    capabilities: ["full-stack", "interactive"],
  },
  {
    id: "understand",
    name: "Understand",
    summary: "Find out what is actually happening first.",
    capabilities: ["systems-analysis", "dataviz", "process-design"],
  },
  {
    id: "automate",
    name: "Automate",
    summary: "Then take the hands off it.",
    capabilities: ["ai-automation", "seo"],
  },
];

/** Capabilities by id, so a cluster can name its members without duplicating them. */
export const CAPABILITY_MAP: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
);
