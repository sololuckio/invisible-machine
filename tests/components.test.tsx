// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemDiagram } from "@/components/fallback/SystemDiagram";
import { AIPanel } from "@/components/system/AIPanel";
import { ControlPanel } from "@/components/system/ControlPanel";
import { MetricsStrip } from "@/components/system/MetricsStrip";
import { NodeInspector } from "@/components/system/NodeInspector";
import { ScenarioSelector } from "@/components/system/ScenarioSelector";
import { Slider } from "@/components/ui/Slider";
import { runCycles } from "@/simulation/engine";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

function resetStores() {
  useSimStore.getState().loadScenario("balanced");
  useUIStore.setState({
    selectedNode: null,
    scanStatus: "idle",
    labOpen: false,
    reducedMotion: false,
  });
}

beforeEach(resetStores);
afterEach(cleanup);

describe("Slider", () => {
  it("renders an accessible range input and reports changes", () => {
    const onChange = vi.fn();
    render(<Slider label="Demand" value={40} onChange={onChange} hint="How many orders arrive" />);
    const input = screen.getByLabelText("Demand");
    expect(input).toHaveValue("40");
    fireEvent.change(input, { target: { value: "70" } });
    expect(onChange).toHaveBeenCalledWith(70);
  });
});

describe("ControlPanel", () => {
  it("drives the simulation controls and marks the sim user-owned", () => {
    render(<ControlPanel />);
    fireEvent.change(screen.getByLabelText("Demand"), { target: { value: "88" } });
    expect(useSimStore.getState().sim.controls.demand).toBe(88);
    expect(useSimStore.getState().userTouched).toBe(true);
  });

  it("requires confirmation before resetting", () => {
    render(<ControlPanel />);
    fireEvent.change(screen.getByLabelText("Demand"), { target: { value: "88" } });
    const resetBtn = screen.getByRole("button", { name: "Reset simulation" });
    fireEvent.click(resetBtn);
    // First click arms the confirmation; nothing resets yet.
    expect(useSimStore.getState().sim.controls.demand).toBe(88);
    fireEvent.click(screen.getByRole("button", { name: "Reset simulation" }));
    expect(useSimStore.getState().sim.controls.demand).toBe(40);
  });

  it("pauses and resumes the clock", () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(useSimStore.getState().running).toBe(false);
    const before = useSimStore.getState().sim.tick;
    useSimStore.getState().tick();
    expect(useSimStore.getState().sim.tick).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Resume simulation" }));
    expect(useSimStore.getState().running).toBe(true);
  });
});

describe("NodeInspector", () => {
  it("selects a station and shows its live internals", () => {
    render(<NodeInspector />);
    fireEvent.click(screen.getByRole("button", { name: "Fulfilment" }));
    expect(useUIStore.getState().selectedNode).toBe("fulfilment");
    expect(screen.getByText("FUL-05")).toBeInTheDocument();
    expect(screen.getByText("Recommended intervention")).toBeInTheDocument();
    expect(screen.getByText("Downstream impact")).toBeInTheDocument();
  });

  it("shows an empty state until a station is chosen", () => {
    render(<NodeInspector />);
    expect(screen.getByText(/Select a station/)).toBeInTheDocument();
  });
});

describe("AIPanel", () => {
  it("takes one click, then works on its own", async () => {
    // Reduced motion shortens the console's own timings, which is what makes
    // the autonomous loop testable without a multi-second wall clock.
    useUIStore.setState({ reducedMotion: true });
    useSimStore.getState().loadScenario("viral");
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 100) });
    const controlsBefore = { ...useSimStore.getState().sim.controls };

    render(<AIPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Activate Intelligence/i }));
    expect(useUIStore.getState().scanStatus).toBe("scanning");

    // A stop control has to exist the moment it starts: an autonomous process
    // the visitor cannot interrupt is worse than one that never started.
    await screen.findByRole("button", { name: "Stop" }, { timeout: 4000 });

    // It applies several interventions from one click, without being asked
    // again — the whole point of the change.
    await waitFor(
      () => expect(useSimStore.getState().sim.appliedRecommendations.length).toBeGreaterThan(1),
      { timeout: 8000 },
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).toBeNull(), {
      timeout: 12000,
    });

    // Each intervention really moved the machine's controls. Whether health
    // then improves is the engine's business and is asserted in the simulation
    // suite with real cycles — nothing ticks the clock in jsdom, so metrics
    // cannot move here however correct the loop is.
    expect(useSimStore.getState().sim.controls).not.toEqual(controlsBefore);
    expect(screen.getByText("Result")).toBeInTheDocument();
    useUIStore.setState({ reducedMotion: false });
  }, 20000);

  it("recovers instead of rendering nothing when the analysis is cleared", () => {
    // Changing scenario clears the analysis while scanStatus still says
    // "complete". That combination used to render an empty panel with no
    // control in it at all.
    useSimStore.getState().loadScenario("viral");
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 100) });
    useSimStore.getState().runAnalysis();
    useUIStore.getState().startScan();
    useUIStore.getState().completeScan();

    useSimStore.getState().loadScenario("breakdown");
    expect(useSimStore.getState().analysis).toBeNull();

    render(<AIPanel />);
    expect(screen.getByRole("button", { name: /Activate Intelligence/i })).toBeInTheDocument();
  });
});

describe("intelligence loop", () => {
  it("re-offers advice while its lever still has room", () => {
    // The System Lab puts the dials and the intelligence layer in one window,
    // so advice that is spent after a single use leaves it with nothing to do.
    useSimStore.getState().loadScenario("breakdown");
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 100) });
    const first = useSimStore.getState().runAnalysis().recommendations[0];
    useSimStore.getState().applyRec(first);
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 40) });

    const again = useSimStore.getState().runAnalysis().recommendations;
    expect(again.length).toBeGreaterThan(0);

    // And taking it a second time genuinely moves the machine.
    const before = { ...useSimStore.getState().sim.controls };
    useSimStore.getState().applyRec(again[0]);
    expect(useSimStore.getState().sim.controls).not.toEqual(before);
  });

  it("only asks to re-analyse once the state it read has moved", () => {
    useSimStore.getState().loadScenario("viral");
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 100) });
    useSimStore.getState().runAnalysis();
    useUIStore.getState().startScan();
    useUIStore.getState().completeScan();
    expect(useSimStore.getState().analysisStale).toBe(false);

    // Moving a dial dates the advice without throwing it away.
    useSimStore.getState().setControl("demand", 95);
    expect(useSimStore.getState().analysisStale).toBe(true);
    expect(useSimStore.getState().analysis).not.toBeNull();

    // Re-reading clears it again.
    useSimStore.getState().runAnalysis();
    expect(useSimStore.getState().analysisStale).toBe(false);
  });
});

describe("ScenarioSelector", () => {
  it("switches scenarios without reload and resets cleanly", () => {
    render(<ScenarioSelector />);
    fireEvent.click(screen.getByRole("button", { name: /Operational Breakdown/ }));
    const sim = useSimStore.getState().sim;
    expect(sim.scenario).toBe("breakdown");
    expect(sim.tick).toBe(0);
    expect(sim.controls.staff).toBe(25);
  });
});

describe("MetricsStrip", () => {
  it("reports live metric values", () => {
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 40) });
    render(<MetricsStrip />);
    expect(screen.getByText("System health")).toBeInTheDocument();
    expect(screen.getByText("Trapped revenue")).toBeInTheDocument();
  });
});

describe("SystemDiagram (non-WebGL fallback)", () => {
  it("renders all eight stations with accessible controls", () => {
    render(<SystemDiagram />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
    expect(screen.getByRole("button", { name: /Fulfilment: status/ })).toBeInTheDocument();
  });

  it("selects nodes via keyboard", () => {
    render(<SystemDiagram />);
    const node = screen.getByRole("button", { name: /Inventory: status/ });
    fireEvent.keyDown(node, { key: "Enter" });
    expect(useUIStore.getState().selectedNode).toBe("inventory");
  });

  it("marks the live bottleneck", () => {
    useSimStore.getState().loadScenario("viral");
    useSimStore.setState({ sim: runCycles(useSimStore.getState().sim, 120) });
    const { container } = render(<SystemDiagram />);
    expect(useSimStore.getState().sim.bottleneck).toBe("fulfilment");
    expect(container.querySelector(".diagram-pulse")).not.toBeNull();
  });
});
