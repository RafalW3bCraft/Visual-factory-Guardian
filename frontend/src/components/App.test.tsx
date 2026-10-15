import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("./Factory", () => ({
  default: () => <div data-testid="factory">3D test boundary</div>,
}));
import App from "../App";
describe("investigation interface", () => {
  it("navigates the full story and records only a demo review", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Skip to evidence" }));
    expect(
      screen.getByRole("heading", { name: "Evidence ledger" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Thermal process instability")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Mark demo inspection reviewed" }),
    );
    expect(
      screen.getByRole("button", { name: "Demo review recorded" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restart demo" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Every defect",
    );
  });
  it("switches product evidence without mixing temperature windows", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Camera" }));
    fireEvent.click(screen.getByRole("button", { name: /Flagged · P-004/ }));
    expect(screen.getByText("0.87")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Normal · P-001/ }));
    expect(screen.getByText("0.12")).toBeInTheDocument();
    expect(screen.getByText("Within fixture threshold")).toBeInTheDocument();
  });
  it("provides presentation controls and preserves form keyboard behavior", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Presentation mode" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A defect",
    );
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A defect",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Presentation mode" }),
    ).toBeInTheDocument();
  });
  it("shows unconfigured backend failure and never enables live start", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /Backend not verified/ }),
    );
    expect(
      screen.getByRole("button", { name: "Start live scenario" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("not configured"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No simulated results");
    fireEvent.click(
      screen.getByRole("button", { name: "Return to Guided Simulation" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("selects a sensor, scrubs and pauses without requiring WebGL", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Vibration" }));
    expect(
      screen.getByRole("button", { name: "Inspect Vibration" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("slider"), { target: { value: 32 } });
    expect(
      screen.getByRole("button", { name: "Play scenario" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Vibration simulated trend/ }),
    ).toHaveAttribute("aria-label", expect.stringContaining("mm/s"));
  });
  it("preserves selected investigation identity while scrubbing telemetry", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Skip to evidence" }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: 48 } });
    expect(screen.getByText("evt-004")).toBeInTheDocument();
    expect(screen.getByText("Thermal process instability")).toBeInTheDocument();
  });
});
