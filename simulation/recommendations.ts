import { effectiveCapacity } from "./engine";
import { NODE_MAP } from "./nodes";
import type { Analysis, Recommendation, SimState } from "./types";

/**
 * Deterministic recommendation engine. Reads the live simulation state and
 * produces ranked interventions with the evidence that justified them.
 * No randomness: the same system state always yields the same advice.
 */

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function analyze(state: SimState): Analysis {
  const { nodes, controls, metrics, tweaks } = state;
  const recs: Recommendation[] = [];

  const ful = nodes.fulfilment;
  const pay = nodes.payment;
  const inv = nodes.inventory;
  const del = nodes.delivery;
  const chk = nodes.checkout;
  const sup = nodes.support;

  // -- Fulfilment starving the machine --------------------------------------
  if (ful.pressure > 1.2) {
    if (controls.staff <= 78) {
      recs.push({
        id: "add-fulfilment-capacity",
        title: "Add fulfilment capacity",
        detail:
          "Bring more hands to picking and packing. Raises staff allocation so the narrowest chamber widens.",
        evidence: `Fulfilment is absorbing ${ful.utilization.toFixed(1)}× its capacity with ${fmt(
          ful.queue,
        )} orders waiting — ${ful.pressure.toFixed(1)} hours of backlog.`,
        targetNode: "fulfilment",
        score: 40 + ful.pressure * 10,
        effect: { controls: { staff: Math.min(100, controls.staff + 25) } },
      });
    } else {
      recs.push({
        id: "reallocate-to-fulfilment",
        title: "Reallocate capacity from acquisition to fulfilment",
        detail:
          "Marketing is feeding a machine that cannot swallow. Shift budget and people downstream until flow recovers.",
        evidence: `Staff allocation is already at ${controls.staff}%, yet fulfilment holds ${fmt(
          ful.queue,
        )} queued orders while acquisition runs at ${Math.round(
          nodes.acquisition.utilization * 100,
        )}% utilisation.`,
        targetNode: "fulfilment",
        score: 38 + ful.pressure * 10,
        effect: {
          controls: { demand: Math.max(10, Math.round(controls.demand * 0.85)) },
          tweaks: { fulfilment: 1.35 },
        },
      });
    }
  }

  // -- Stockout -------------------------------------------------------------
  if (state.stock < 25 || inv.pressure > 1.2) {
    recs.push({
      id: "increase-safety-stock",
      title: "Increase inventory safety stock",
      detail:
        "Raise reorder points and buffer stock so allocation stops rationing orders that are already paid for.",
      evidence: `Stock is at ${Math.round(state.stock)}% with ${fmt(
        inv.queue,
      )} paid orders waiting for allocation.`,
      targetNode: "inventory",
      score: 35 + inv.pressure * 8 + (25 - Math.min(25, state.stock)),
      effect: {
        controls: { inventory: Math.min(100, controls.inventory + 30) },
        stockBoost: 30,
      },
    });
  }

  // -- Payment verification drag -------------------------------------------
  if (pay.pressure > 1 && controls.automation < 70) {
    recs.push({
      id: "automate-payment-verification",
      title: "Automate payment verification",
      detail:
        "Let rules clear the obvious transactions instantly and reserve human review for genuine anomalies.",
      evidence: `Payment holds ${fmt(pay.queue)} transactions at ${Math.round(
        pay.errorRate * 100,
      )}% error rate while automation sits at ${controls.automation}%.`,
      targetNode: "payment",
      score: 30 + pay.pressure * 9,
      effect: {
        controls: { automation: Math.min(100, controls.automation + 20) },
        tweaks: { payment: 1.3 },
      },
    });
  }

  // -- Support drowning -----------------------------------------------------
  if (metrics.unresolvedIssues > 15 && controls.automation < 80) {
    recs.push({
      id: "introduce-self-service",
      title: "Introduce self-service support",
      detail:
        "Publish answers to the questions the machine keeps generating, and deflect routine tickets before they queue.",
      evidence: `${fmt(metrics.unresolvedIssues)} issues are unresolved and support is at ${Math.round(
        sup.utilization * 100,
      )}% utilisation.`,
      targetNode: "support",
      score: 26 + metrics.unresolvedIssues * 0.35,
      effect: {
        controls: {
          support: Math.min(100, controls.support + 15),
          automation: Math.min(100, controls.automation + 10),
        },
        tweaks: { support: 1.35 },
      },
    });
  }

  // -- Demand outrunning the whole chain ------------------------------------
  const chainCap = Math.min(
    effectiveCapacity("checkout", controls, tweaks),
    effectiveCapacity("payment", controls, tweaks),
    effectiveCapacity("fulfilment", controls, tweaks),
    effectiveCapacity("delivery", controls, tweaks),
  );
  if (metrics.arrivalRate > chainCap * 1.25 && metrics.customerSatisfaction < 72) {
    recs.push({
      id: "throttle-acquisition",
      title: "Slow acquisition temporarily",
      detail:
        "Ease spend until flow recovers. Orders you cannot deliver cost more in trust than they earn in revenue.",
      evidence: `Orders arrive at ${fmt(metrics.arrivalRate)}/h against a narrowest-link capacity of ${fmt(
        chainCap,
      )}/h, and satisfaction has fallen to ${Math.round(metrics.customerSatisfaction)}%.`,
      targetNode: "acquisition",
      score: 24 + (metrics.arrivalRate / Math.max(1, chainCap)) * 6,
      effect: {
        controls: { demand: Math.max(15, Math.round(controls.demand * 0.7)) },
      },
    });
  }

  // -- Delivery strain ------------------------------------------------------
  if (del.pressure > 1.2) {
    recs.push({
      id: "prioritise-deliveries",
      title: "Prioritise high-risk deliveries",
      detail:
        "Triage the dispatch queue: promised dates and perishable trust ship first; the rest follow in sequence.",
      evidence: `Delivery is carrying ${fmt(del.queue)} undispatched orders — ${del.pressure.toFixed(
        1,
      )} hours of backlog at the dock.`,
      targetNode: "delivery",
      score: 22 + del.pressure * 8,
      effect: { tweaks: { delivery: 1.25 } },
    });
  }

  // -- Front-of-funnel congestion with automation available ------------------
  if (chk.pressure + pay.pressure > 1.5 && controls.automation >= 40) {
    recs.push({
      id: "alternate-express-route",
      title: "Route urgent orders through an express path",
      detail:
        "Open a parallel lane: trusted repeat customers skip full verification and merge back before allocation.",
      evidence: `Checkout and payment hold ${fmt(
        chk.queue + pay.queue,
      )} combined orders while automation (${controls.automation}%) can safely pre-clear known customers.`,
      targetNode: "checkout",
      score: 18 + (chk.pressure + pay.pressure) * 5,
      effect: { tweaks: { checkout: 1.2, payment: 1.2 } },
    });
  }

  // -- Nothing urgent: tune, don't operate -----------------------------------
  if (recs.length === 0) {
    recs.push({
      id: "raise-automation-baseline",
      title: "Raise the automation baseline",
      detail:
        "The system is stable — invest the calm. Automate verification and routing now, before the next spike arrives.",
      evidence: `No node exceeds safe pressure. Health ${Math.round(
        metrics.systemHealth,
      )}%, satisfaction ${Math.round(
        metrics.customerSatisfaction,
      )}%, automation at ${controls.automation}%.`,
      targetNode: controls.automation < 60 ? "payment" : "revenue",
      score: 10,
      effect: {
        controls: { automation: Math.min(100, controls.automation + 15) },
      },
    });
  }

  recs.sort((a, b) => b.score - a.score);
  const drop = recs.filter((r) => !state.appliedRecommendations.includes(r.id));
  const finalRecs = drop.length > 0 ? drop : recs;

  return {
    narrative: buildNarrative(state, finalRecs),
    bottleneck: state.bottleneck,
    recommendations: finalRecs.slice(0, 3),
  };
}

function buildNarrative(state: SimState, recs: Recommendation[]): string {
  const { metrics } = state;
  const bn = state.bottleneck ? NODE_MAP[state.bottleneck] : null;
  const health = Math.round(metrics.systemHealth);

  if (!bn && health >= 80) {
    return `Scan complete. Flow is balanced: ${fmt(
      metrics.completionRate,
    )} orders/h leaving the machine against ${fmt(
      metrics.arrivalRate,
    )}/h arriving. No constraint detected — the leverage now is preparation, not repair.`;
  }
  if (!bn) {
    return `Scan complete. No single choke point, but the system is running warm — health ${health}%, ${fmt(
      metrics.totalQueue,
    )} orders in queues. Small frictions are compounding across stages.`;
  }
  const n = state.nodes[bn.id];
  return `Scan complete. The constraint is ${bn.name} (${bn.tag}): ${fmt(
    n.queue,
  )} orders backed up, ${n.utilization.toFixed(1)}× overloaded. $${fmt(
    metrics.trappedRevenue,
  )} of revenue is trapped in queues${
    recs[0] ? `. Highest-leverage move: ${recs[0].title.toLowerCase()}` : ""
  }.`;
}
