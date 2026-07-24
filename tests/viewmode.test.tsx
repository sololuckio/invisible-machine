// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsMenu } from "@/components/ui/SettingsMenu";
import { useSimStore } from "@/store/simStore";
import { useUIStore } from "@/store/uiStore";

function resetViewState() {
  window.sessionStorage.clear();
  useUIStore.setState({
    viewMode: "3d",
    viewModeSource: "auto",
    webglCapability: "available",
    sceneStatus: "ready",
    sceneEpoch: 0,
    quality: "balanced",
    qualitySource: "auto",
  });
}

beforeEach(resetViewState);
afterEach(cleanup);

function openSettings() {
  render(<SettingsMenu />);
  fireEvent.click(screen.getByRole("button", { name: "Display settings" }));
}

const machineButton = () => screen.getByRole("button", { name: /3D view/ });
const diagramButton = () => screen.getByRole("button", { name: /Diagram view/ });

describe("view-mode state architecture", () => {
  it("choosing the diagram never marks WebGL unavailable", () => {
    useUIStore.getState().setViewMode("diagram");
    const s = useUIStore.getState();
    expect(s.viewMode).toBe("diagram");
    expect(s.webglCapability).toBe("available");
    expect(s.sceneStatus).toBe("ready");
  });

  it("survives repeated 3d → diagram → 3d cycles with sim and quality intact", () => {
    useUIStore.getState().setQuality("high", "user");
    useSimStore.getState().loadScenario("viral");
    const tickBefore = useSimStore.getState().sim.tick;
    for (let i = 0; i < 4; i++) {
      useUIStore.getState().setViewMode("diagram");
      useUIStore.getState().setViewMode("3d");
    }
    const ui = useUIStore.getState();
    expect(ui.viewMode).toBe("3d");
    expect(ui.webglCapability).toBe("available");
    expect(ui.quality).toBe("high");
    expect(ui.qualitySource).toBe("user");
    expect(useSimStore.getState().sim.scenario).toBe("viral");
    expect(useSimStore.getState().sim.tick).toBe(tickBefore);
  });

  it("a runtime scene failure is not device incompatibility and can be retried", () => {
    useUIStore.getState().reportSceneFailure();
    let s = useUIStore.getState();
    expect(s.sceneStatus).toBe("failed");
    expect(s.viewMode).toBe("diagram");
    expect(s.viewModeSource).toBe("error");
    expect(s.webglCapability).toBe("available");

    useUIStore.getState().retry3D();
    s = useUIStore.getState();
    expect(s.sceneStatus).toBe("idle");
    expect(s.viewMode).toBe("3d");
    // A fresh epoch remounts the error boundary and canvas exactly once.
    expect(s.sceneEpoch).toBe(1);
  });

  it("retry is refused when the device truly lacks WebGL", () => {
    useUIStore.setState({ webglCapability: "unavailable", viewMode: "diagram" });
    useUIStore.getState().retry3D();
    const s = useUIStore.getState();
    expect(s.viewMode).toBe("diagram");
    expect(s.sceneEpoch).toBe(0);
  });

  it("only user choices persist; automatic and error fallbacks do not", () => {
    useUIStore.getState().setViewMode("diagram", "auto");
    expect(window.sessionStorage.getItem("tim.view")).toBeNull();
    useUIStore.getState().reportSceneFailure();
    expect(window.sessionStorage.getItem("tim.view")).toBeNull();
    useUIStore.getState().setViewMode("diagram", "user");
    expect(window.sessionStorage.getItem("tim.view")).toBe("diagram");
    // A stored diagram preference must not corrupt capability.
    expect(useUIStore.getState().webglCapability).toBe("available");
  });

  it("a successful scene start reconfirms capability", () => {
    useUIStore.setState({ webglCapability: "unknown", sceneStatus: "idle" });
    useUIStore.getState().markSceneReady();
    const s = useUIStore.getState();
    expect(s.webglCapability).toBe("available");
    expect(s.sceneStatus).toBe("ready");
  });
});

describe("SettingsMenu view options", () => {
  it("keeps 3D selectable after switching to diagram", () => {
    openSettings();
    fireEvent.click(diagramButton());
    expect(useUIStore.getState().viewMode).toBe("diagram");
    const btn = machineButton();
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent("Live spatial machine");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(diagramButton()).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(btn);
    expect(useUIStore.getState().viewMode).toBe("3d");
    expect(machineButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("disables 3D only for genuine WebGL absence, with an accurate reason", () => {
    useUIStore.setState({ webglCapability: "unavailable", viewMode: "diagram" });
    openSettings();
    const btn = machineButton();
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("WebGL isn't available on this device");
    expect(diagramButton()).toBeEnabled();
  });

  it("offers a real retry after a runtime failure instead of blaming the device", () => {
    useUIStore.getState().reportSceneFailure();
    openSettings();
    const btn = machineButton();
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent("could not start — select to retry");
    fireEvent.click(btn);
    const s = useUIStore.getState();
    expect(s.viewMode).toBe("3d");
    expect(s.sceneStatus).toBe("idle");
    expect(s.sceneEpoch).toBe(1);
  });

  it("distinguishes auto-detected from manually selected quality", () => {
    openSettings();
    expect(screen.getByText("Currently Balanced")).toBeInTheDocument();
    const autoBtn = screen.getByRole("button", { name: /Auto-detect/ });
    expect(autoBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^High/ }));
    expect(screen.getByText("High — manually selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Auto-detect/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
