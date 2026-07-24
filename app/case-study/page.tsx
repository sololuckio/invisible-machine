import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Case Study — The Invisible Machine",
  description:
    "How The Invisible Machine was engineered: a deterministic business simulation, a computed bottleneck engine, an evidence-based recommendation system and a cinematic Three.js experience — by John C.",
  alternates: { canonical: `${SITE.url}/case-study` },
};

/**
 * The recruiter path: everything the guided journey demonstrates, stated
 * plainly and indexable — readable in two minutes, no WebGL required.
 */

const SECTIONS: { label: string; title: string; body: string[] }[] = [
  {
    label: "01 · CONCEPT",
    title: "What this project is",
    body: [
      "The Invisible Machine is an interactive essay about the systems hidden under every business. The storefront surface splits open and the visitor descends through eight operational stations — acquisition, checkout, payment, inventory, fulfilment, delivery, support, revenue — following real orders through a live simulation they can stress, break and repair.",
      "It is a portfolio piece with a thesis: understanding systems matters more than decorating them. Every number on the page is computed; nothing is a mock-up.",
    ],
  },
  {
    label: "02 · SIMULATION",
    title: "A deterministic business simulation",
    body: [
      "The core is a pure TypeScript discrete-time queueing model — eight stations with capacities, processing times, queues, error rates, stock consumption and customer abandonment. It uses no randomness and no wall-clock time: the same inputs always produce the same outcomes, which makes every claim in the experience reproducible and testable.",
      "Six operator controls (demand, staffing, inventory replenishment, processing tempo, support capacity, automation) feed effective-capacity calculations. Three scenarios — balanced, viral spike, operational breakdown — are just different control presets; their contrasting failure modes emerge from the model, and are pinned by unit tests.",
    ],
  },
  {
    label: "03 · INTELLIGENCE",
    title: "Bottleneck detection and the decision engine",
    body: [
      "The bottleneck is computed live: the engine walks the flow path looking for sustained pressure (arrival rate vs. effective capacity) combined with a deepening queue, distinguishing pipeline constraints from support overload. The camera, warnings, scan sequence and copy all key off this computed constraint — nothing is scripted to a fixed station.",
      "'Activate Intelligence' runs a deterministic operational decision engine that analyzes live simulation state and ranks interventions. Each rule scores itself against the current state and reports numeric evidence (backlog hours, overload ratio, trapped revenue). Applying a recommendation mutates the live controls — capacity rises, a bypass route assembles, queues drain over time — and the tradeoffs (such as operating cost) stay visible.",
    ],
  },
  {
    label: "04 · RENDERING",
    title: "Three.js / React Three Fiber architecture",
    body: [
      "The 3D machine is fully procedural — no downloaded models or texture packs. Stations share a chassis (plinth, utilisation ring, status lamp, queue rail) and carry distinct operational identities: a rotating payment verification ring, inventory stock cells that physically empty, a fulfilment gantry that sweeps at the station's real tempo, a support reservoir that fills with unresolved issues.",
      "Rendering is a strict one-way street: the simulation ticks in a Zustand store, and the render loop reads it imperatively — zero React re-renders per frame. Orders are one instanced mesh pool; queue blocks fill each station's holding rail from a shared layout module so particles, markers and geometry can never disagree. Materials come from one shared kit, flow lanes are tube shaders whose packet speed is the feeding station's live throughput, and the scroll-driven camera uses damped poses per chapter — no scroll-jacking.",
    ],
  },
  {
    label: "05 · RESILIENCE",
    title: "Accessibility, fallbacks and failure states",
    body: [
      "The experience has a full reduced-motion path (static compositions, crossfades, no sweeps), a complete keyboard journey, ARIA labelling with live announcements, and a screen-reader system overview. Without JavaScript, the narrative still reads top to bottom.",
      "Without WebGL — or if the scene crashes — a live 2D SVG schematic takes over, driven by the same simulation. Device capability, chosen view and runtime failure are modelled as independent state, so visitors can switch 3D ↔ Diagram freely, a runtime failure offers a real one-shot retry, and only genuine capability absence ever disables the 3D option.",
    ],
  },
  {
    label: "06 · PERFORMANCE",
    title: "Quality tiers and adaptation",
    body: [
      "The three.js bundle is lazy-loaded so the opening copy never waits for it; first-load JavaScript for the page is ~130 kB. Three quality tiers (auto-detected from device signals, user-overridable) control resolution caps, particle pool sizes and environmental detail. The simulation pauses when the tab is hidden, high-frequency readouts update the DOM imperatively, and narrow viewports get recomposed camera framing rather than a cropped desktop shot.",
    ],
  },
  {
    label: "07 · ENGINEERING",
    title: "Testing and deployment",
    body: [
      "The simulation is developed test-first: scenario dynamics, bottleneck attribution, recommendation ranking, intervention effects and the before/after comparison are covered by unit tests, with component tests over the operator console, inspector, AI panel and the view-mode state machine. Linting, strict TypeScript and the production build gate every change.",
      "The site is a Next.js App Router application deployed on a self-managed VPS behind nginx with automated TLS — built, tested and shipped from a single source tree.",
    ],
  },
  {
    label: "08 · HARD PARTS",
    title: "Key engineering challenges",
    body: [
      "Making interventions honestly beat neglect: early versions let abandoned demand pile up forever, so 'after' could never win — modelling customer abandonment fixed the dynamics and sharpened the story. Keeping the constraint computed (not staged) meant the camera, scan and copy all had to follow the engine wherever it pointed. Separating WebGL capability from runtime state eliminated a class of false 'unsupported device' dead-ends. And keeping 60 fps meant instancing everything that repeats and letting the render loop read the store without React in the way.",
    ],
  },
];

export default function CaseStudyPage() {
  return (
    <main id="main" className="cs-page">
      <div className="cs-inner">
        <p className="tech-label">TIM-01 · TECHNICAL CASE STUDY</p>
        <h1 className="cs-title">The Invisible Machine, explained</h1>
        <p className="cs-lede">
          Built by {SITE.author.name} — {SITE.author.role}. A two-minute tour of what the guided
          experience demonstrates and how it is engineered.
        </p>

        <nav className="cs-actions" aria-label="Case study actions">
          <Link className="btn btn-primary" href="/">
            Enter the experience
          </Link>
          <a className="btn btn-ghost" href={`mailto:${SITE.author.email}`}>
            Email {SITE.author.name}
          </a>
          <a
            className="btn btn-ghost"
            href="https://github.com/sololuckio"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>

        {SECTIONS.map((s) => (
          <section key={s.label} className="cs-section" aria-label={s.title}>
            <p className="tech-label">{s.label}</p>
            <h2>{s.title}</h2>
            {s.body.map((p) => (
              <p key={p.slice(0, 32)} className="cs-body">
                {p}
              </p>
            ))}
          </section>
        ))}

        <footer className="cs-footer">
          <p className="tech-label">STACK</p>
          <p className="cs-body">
            Next.js · React · TypeScript (strict) · three.js · React Three Fiber · GSAP
            ScrollTrigger · Zustand · Tailwind CSS · Vitest
          </p>
          <p className="cs-fine">
            © {new Date().getFullYear()} {SITE.author.name} ·{" "}
            <Link href="/">{SITE.name}</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
