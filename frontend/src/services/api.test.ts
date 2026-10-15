import { describe, it, expect, vi } from "vitest";
import { GuardianApi, eventSchema } from "./api";
const event = {
  schema_version: "1.0",
  event_id: "evt-live",
  timestamp: "2026-10-15T10:00:32Z",
  scenario_id: "s",
  line_id: "line",
  image_id: "im",
  source: "real",
  detection: { model: "test-model", anomaly_score: 0.8 },
};
function client(payload: unknown, status = 200) {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(payload), { status }));
  return { api: new GuardianApi("https://example.test", fetcher), fetcher };
}
describe("API boundary", () => {
  it("rejects absent origins and non-http origins", () => {
    expect(() => new GuardianApi("")).toThrow("not configured");
    expect(() => new GuardianApi("javascript:alert(1)")).toThrow("HTTP");
  });
  it("gates readiness on every required capability", async () => {
    await expect(
      client({ status: "ok", capabilities: ["events"] }).api.health(),
    ).rejects.toThrow("not ready");
    await expect(
      client({
        status: "ok",
        capabilities: ["events", "sensors", "analysis", "scenarios"],
      }).api.health(),
    ).resolves.toMatchObject({ status: "ok" });
  });
  it("validates events and retains missing detection explicitly", async () => {
    await expect(client([event]).api.events("s")).resolves.toHaveLength(1);
    expect(
      eventSchema.parse({ ...event, detection: null }).detection,
    ).toBeNull();
    expect(
      eventSchema.safeParse({ ...event, timestamp: "yesterday" }).success,
    ).toBe(false);
    expect(eventSchema.safeParse({ ...event, source: undefined }).success).toBe(
      false,
    );
  });
  it("rejects malformed payloads and HTTP failures without fixtures", async () => {
    await expect(client({ events: [] }).api.events("s")).rejects.toThrow(
      "contract",
    );
    await expect(client({}, 503).api.events("s")).rejects.toThrow("HTTP 503");
  });
  it("rejects cross-event analysis", async () => {
    const data = {
      event_id: "other",
      scenario_id: "s",
      line_id: "line",
      explanation: "x",
      sensor_evidence: [],
      candidate_causes: [],
      manual_citations: [],
      recommended_action: null,
    };
    await expect(
      client(data).api.analysis(eventSchema.parse(event)),
    ).rejects.toThrow("identity");
  });
  it("starts/stops scenarios and scopes retrieval queries", async () => {
    const { api, fetcher } = client({ scenario_id: "s", line_id: "line" });
    await api.start();
    expect(fetcher.mock.calls[0][0]).toContain("/scenarios/start");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      scenario_id: "thermal-drift-001",
    });
    await expect(client({ status: "stopped" }).api.stop("s")).resolves.toEqual({
      status: "stopped",
    });
    const sensors = client([]);
    await sensors.api.sensors("a b", "line");
    expect(sensors.fetcher.mock.calls[0][0]).toContain(
      "scenario_id=a%20b&line_id=line",
    );
  });
  it("aborts a stalled request at the timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url, options) =>
        new Promise<Response>((_, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new Error("abort")),
          ),
        ),
    );
    const promise = new GuardianApi("https://example.test", fetcher).health();
    const assertion = expect(promise).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    vi.useRealTimers();
  });
});
