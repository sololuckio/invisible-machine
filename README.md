# The Invisible Machine

**An interactive business-systems experience.** Every business is a living system: beneath a
calm storefront sit customers, orders, payments, inventory, staff, logistics, support and cash
flow. This site visualises that hidden system as a cinematic machine descending beneath the
surface — and lets visitors interfere with it.

Visitors follow a single order through eight connected stations, crank demand until the system
breaks at its narrowest point, inspect the bottleneck, activate a deterministic "intelligence
layer" that reads the live simulation and recommends interventions, and compare the ignored
system against the managed one. Every number on the page is computed live by the on-page
simulation — no mock data, no video.

Built as a portfolio showcase of creative development, systems thinking, simulation design,
3D/graphics engineering, accessibility and performance work. A concise technical case study
lives at `/case-study` for visitors who want the engineering story without the journey.

**Art direction.** The machine is precision infrastructure, not a neon demo: a disciplined
material kit (structural graphite, machined shells, recessed panels, small self-lit details),
one signal colour for flow, a warm tone for customer orders, a separate pale voice for the
intelligence layer and locally escalating warnings. Stations share a chassis — hex plinth,
utilisation ring, status lamp, physical queue rail — and each carries a distinct operational
identity: an intake dish, a validation gate, a rotating payment verifier, stock cells that
empty with real inventory, a fulfilment gantry sweeping at real tempo, dispatch chutes, a
support array with an unresolved-issue reservoir, and stacked ledger discs. Orders are
oriented carriers with eased travel; conveyors are dark rails with illuminated cores whose
packet speed is the feeding station's live throughput.

## Technology

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Three.js / React Three Fiber / drei** — the 3D machine (procedural geometry only, no
  imported models or textures)
- **GSAP + ScrollTrigger** — text reveals (lazy-loaded)
- **Zustand** — simulation + UI state
- **Tailwind CSS 4** + a hand-written design-system layer in `app/globals.css`
- **Web Audio API** — fully synthesised optional sound layer (no audio files)
- **Vitest + Testing Library** — engine and UI tests

## Running it

```bash
npm install
npm run dev        # development (Turbopack) — http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm test           # simulation + component tests (vitest)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run format     # prettier
```

## Project structure

```
app/                    Layout, page, global CSS, SEO assets (robots, sitemap,
                        manifest, icon, generated Open Graph image) and the
                        server-rendered /case-study recruiter page
components/
  chapters/             The eight narrative chapters + scroll tracker
  experience/           The 3D machine (canvas, stations, particles, pathways,
                        camera rig, surface split, AI scan effects), the shared
                        material kit (materials.ts) and the queue-lane layout
                        (queueLayout.ts) that stations, markers and particles
                        all draw from
  fallback/             Live 2D SVG schematic (no-WebGL / diagram view)
  system/               Interactive consoles (controls, metrics, inspector,
                        AI panel, comparison ledger, scenario selector, Lab)
  ui/                   Chrome (nav, boot sequence, settings, sliders, icons,
                        screen-reader status channel)
data/                   All copy, site config, projects — no copy in components
hooks/                  Simulation loop, chapter director, sound director,
                        environment probe, GSAP reveals
lib/                    Audio synth, formatting, quality tiers, storage,
                        palette, scroll state, shared journey actions
simulation/             The pure engine (see below) — no React imports
store/                  Zustand stores (simulation runtime, UI state)
tests/                  Vitest suites (engine + component smoke tests)
```

## Simulation architecture

`simulation/` is pure, deterministic TypeScript — no `Math.random`, no `Date` — so identical
inputs always produce identical trajectories, which is what makes the tests and the
before/after comparison honest.

- `engine.ts` — a discrete-time queueing network. One cycle ≈ one operational hour. Orders
  arrive at a demand-driven rate (with a deterministic ripple), flow through
  acquisition → checkout → payment → inventory → fulfilment → delivery → revenue, queue in
  front of undersized stations, fail at error-prone gates, and are abandoned by impatient
  customers when backlogs deepen. Inventory consumes and replenishes physical stock. Failures
  and lateness generate support issues. Derived metrics: satisfaction, delivery performance,
  lead time, operating cost, captured/trapped revenue, system health.
- **Bottleneck detection** is computed, not scripted: the flow-path station with the deepest
  sustained backlog (support only counts when the pipeline itself is healthy).
- `recommendations.ts` — a rule-based analysis engine that reads the live state and returns
  ranked interventions **with the evidence that justified them** (live queue counts,
  utilisation, stock levels). Different states produce different advice; applied advice is
  never repeated.
- `apply.ts` — applies a recommendation's effect (control changes, capacity tweaks, stock
  boosts) to the state; the engine then reacts naturally.
- `compare.ts` — runs the same scenario twice for the same number of cycles (untouched vs.
  scan-and-apply three times) and reports both endings.
- `scenarios.ts` — Balanced Business, Viral Demand Spike, Operational Breakdown. The viral
  spike breaks at fulfilment; the breakdown starves at inventory — verified by tests.

The visual layer subscribes to the same store the engine writes; 3D frame loops read state via
`getState()` so rendering never causes React re-render churn.

## Rendering-quality system

Three tiers — **High / Balanced / Reduced** — controlling device-pixel-ratio caps, particle
pool size, queue-marker counts, antialiasing and environment detail (`lib/quality.ts`). A tier
is auto-detected from device signals (cores, memory, pointer type, viewport) and can be
overridden in the settings panel (persisted for the session). The simulation clock pauses when
the tab is hidden; the three.js bundle is code-split and lazy-loaded so the opening copy never
waits for it.

## Accessibility

- Semantic structure, one `h1`, labelled sections, skip link, logical tab order
- Every control is a real `<button>`/`<input type="range">`; nothing is hover-only
- A visually-hidden structured **system overview** describes the whole experience
- A polite `aria-live` channel narrates chapter changes, new bottlenecks, scan results and
  applied recommendations
- **`prefers-reduced-motion`**: no cinematic camera travel (fixed overview shot), the surface
  split becomes a fade, particle motion is minimised, CSS animations are disabled, boot shows
  instantly
- **No WebGL / 3D crash**: an error boundary demotes the experience to a live 2D SVG
  schematic driven by the same simulation, with keyboard-selectable stations. The same
  diagram is available to everyone via Settings → "Diagram view"
- **View-mode state model**: device WebGL capability (`unknown/available/unavailable`),
  the chosen view (`3d/diagram` + why: `user/auto/error`) and the scene's runtime status
  (`idle/ready/failed`) are independent store fields. Choosing the diagram or unmounting
  the canvas never rewrites capability, so 3D ↔ Diagram switching is freely reversible;
  a runtime crash offers a real one-shot "Retry 3D" (an epoch counter remounts the error
  boundary and canvas), and only genuine capability absence disables the 3D option
- Status is never conveyed by colour alone (labels + values accompany every state)

## Editing content

All copy and configuration live in `data/`:

- `data/copy.ts` — every narrative line, chapter headline, UI string and the screen-reader
  overview
- `data/site.ts` — title, description, author, **production URL** (`SITE.url` — replace the
  placeholder before deploying), contact links (entries with an empty `href` are hidden until
  you fill them)
- `data/projects.ts` — featured work (`PROJECTS`) and capabilities (`CAPABILITIES`); add a
  project by appending an object with name, tag, role, summary, stack, URL and status
- Simulation tuning lives in `simulation/` (`scenarios.ts` for presets, `nodes.ts` for
  station definitions and layout positions in both 3D and the 2D diagram)

## Deploying

Any Node host that runs Next.js 15 works:

```bash
npm run build && npm run start   # self-hosted (PORT=3000 by default)
```

or push the repository to Vercel/Netlify with default Next.js settings. Before deploying:

1. Set `SITE.url` in `data/site.ts` to the real domain (feeds canonical URL, sitemap, robots
   and Open Graph).
2. Fill the TODO contact links in `data/site.ts`.

## Known limitations

- The Open Graph image is generated at request/build time by `app/opengraph-image.tsx`
  (satori); customise it there if you want a designed bitmap instead.
- The sound layer is intentionally minimal (synthesised ambience + event tones) and stays off
  until the visitor enables it.
- The simulation is a believable abstraction, not an economics model — units are honest
  relative to each other, not calibrated to any real business.
