import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import LivePanel from "./LivePanel";
const event = {
  schema_version: "1.0",
  event_id: "live-01",
  timestamp: "2026-10-15T10:00:32Z",
  scenario_id: "session",
  line_id: "line",
  image_id: "sample",
  source: "recorded",
  detection: { model: "test-model", anomaly_score: 0.71 },
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function setup({ failSensors = false, empty = false } = {}) {
  vi.stubEnv("VITE_API_BASE_URL", "https://backend.test");
  const fetcher = vi.fn(async (url: string) => {
    let data: unknown = {};
    if (url.endsWith("/health"))
      data = {
        status: "ok",
        capabilities: ["scenarios", "events", "sensors", "analysis"],
      };
    else if (url.endsWith("/start"))
      data = { scenario_id: "session", line_id: "line" };
    else if (url.endsWith("/stop")) data = { status: "stopped" };
    else if (url.includes("/events")) data = empty ? [] : [event];
    else if (url.includes("/sensors")) {
      if (failSensors) return new Response("", { status: 503 });
      data = [];
    } else if (url.includes("/analysis/"))
      data = {
        event_id: "live-01",
        scenario_id: "session",
        line_id: "line",
        explanation: "Recorded test evidence, not synthetic fallback.",
        sensor_evidence: [],
        candidate_causes: [],
        manual_citations: [],
        recommended_action: null,
      };
    return new Response(JSON.stringify(data));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<LivePanel onClose={vi.fn()} />);
  return fetcher;
}
async function start() {
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Start live scenario" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Start live scenario" }));
}
describe("live API integration using mocked HTTP responses", () => {
  it("loads a session, selects its analysis, handles missing fields and stops", async () => {
    const fetcher = setup();
    await start();
    await screen.findByText("live-01");
    fireEvent.click(screen.getByRole("button", { name: /live-01/ }));
    await screen.findByText("Recorded test evidence, not synthetic fallback.");
    expect(
      screen.getByText("No manual citations supplied."),
    ).toBeInTheDocument();
    expect(screen.getByText("No telemetry returned.")).toBeInTheDocument();
    expect(screen.getByText("No action supplied.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop live scenario" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Stop live scenario" }),
      ).toBeDisabled(),
    );
    expect(
      fetcher.mock.calls.some(([url]) => url.endsWith("/scenarios/stop")),
    ).toBe(true);
  });
  it("reports backend failure without showing simulated telemetry or evidence", async () => {
    setup({ failSensors: true });
    await start();
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503");
    expect(
      screen.queryByText("Thermal process instability"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop live scenario" }),
    ).toBeEnabled();
  });
  it("keeps empty datasets explicit and allows refreshing", async () => {
    setup({ empty: true });
    await start();
    await screen.findByText(/No inspection events have arrived/);
    expect(
      screen.getByRole("button", { name: "Refresh records" }),
    ).toBeEnabled();
  });
});
