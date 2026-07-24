import { Chapter01Surface } from "@/components/chapters/Chapter01Surface";
import { Chapter02Order } from "@/components/chapters/Chapter02Order";
import { Chapter03Pressure } from "@/components/chapters/Chapter03Pressure";
import { Chapter04Bottleneck } from "@/components/chapters/Chapter04Bottleneck";
import { Chapter05Intelligence } from "@/components/chapters/Chapter05Intelligence";
import { Chapter06Compare } from "@/components/chapters/Chapter06Compare";
import { Chapter07Creator } from "@/components/chapters/Chapter07Creator";
import { Chapter08Finale } from "@/components/chapters/Chapter08Finale";
import { ExperienceRoot } from "@/components/ExperienceRoot";
import { SYSTEM_OVERVIEW_TEXT } from "@/data/copy";

export default function Home() {
  return (
    <>
      <ExperienceRoot />

      {/* Structured overview for screen readers and non-visual agents. */}
      <section aria-label="What this experience contains" className="sr-only">
        <h2>System overview</h2>
        {SYSTEM_OVERVIEW_TEXT.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </section>

      <main id="main" className="relative z-10">
        <Chapter01Surface />
        <Chapter02Order />
        <Chapter03Pressure />
        <Chapter04Bottleneck />
        <Chapter05Intelligence />
        <Chapter06Compare />
        <Chapter07Creator />
        <Chapter08Finale />
      </main>
    </>
  );
}
