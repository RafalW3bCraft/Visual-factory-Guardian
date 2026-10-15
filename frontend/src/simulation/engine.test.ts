import { describe, it, expect } from "vitest";
import {
  reducer,
  initialState,
  phaseAt,
  inspections,
  milestones,
  reading,
  evidenceFor,
  productPosition,
  timestamp,
  DURATION,
} from "./engine";
describe("deterministic scenario", () => {
  it("starts, pauses, resumes, clamps completion and resets review", () => {
    let s = reducer(initialState, { type: "start" });
    s = reducer(s, { type: "tick", delta: 9 });
    expect(phaseAt(s.time)).toBe("INSPECTION_ACTIVE");
    s = reducer(s, { type: "toggle" });
    expect(reducer(s, { type: "tick", delta: 9 })).toEqual(s);
    s = reducer(s, { type: "toggle" });
    s = reducer(s, { type: "tick", delta: 100 });
    expect(s.status).toBe("complete");
    expect(s.time).toBe(DURATION);
    s = reducer(s, { type: "review" });
    expect(s.reviewed).toBe(true);
    expect(reducer(s, { type: "reset" })).toEqual(initialState);
  });
  it("replays the same event sequence across different frame partitions", () => {
    const run = (deltas: number[]) => {
      let s = reducer(initialState, { type: "start" });
      for (const delta of deltas) s = reducer(s, { type: "tick", delta });
      return {
        s,
        events: milestones.filter((e) => e.time <= s.time),
        sensors: ["temperature", "vibration", "current"].map((m) =>
          reading(m as "temperature", s.time),
        ),
      };
    };
    expect(run(Array(44).fill(1))).toEqual(run(Array(176).fill(0.25)));
  });
  it("orders drift before anomaly and binds products to their camera crossing", () => {
    expect(milestones.map((e) => e.time)).toEqual([8, 18, 32, 38, 44]);
    inspections.forEach((e, i) => expect(productPosition(e.time, i)).toBe(2));
    expect(
      inspections.filter((e) => e.flagged).map((e) => e.productId),
    ).toEqual(["P-004"]);
  });
  it("derives selected evidence and does not attach drift to the early normal product", () => {
    const normal = evidenceFor(inspections[0]),
      flagged = evidenceFor(inspections[3]);
    expect(normal.hasDrift).toBe(false);
    expect(flagged.hasDrift).toBe(true);
    expect(flagged.leadSeconds).toBe(14);
    expect(flagged.delta).toBeGreaterThan(18);
    expect(flagged.observed).toBe(reading("temperature", 32));
    expect(flagged.window).toEqual([14, 40]);
  });
  it("keeps temperature threshold crossing out of the baseline", () => {
    for (let t = 0; t < 18; t++)
      expect(reading("temperature", t)).toBeLessThan(75);
    expect(reading("temperature", 32)).toBeGreaterThan(75);
    expect(reading("current", 32)).toBeLessThan(55);
  });
  it("guards invalid clock actions, review ordering and playback speed", () => {
    expect(reducer(initialState, { type: "seek", value: NaN })).toEqual(
      initialState,
    );
    expect(reducer(initialState, { type: "review" }).reviewed).toBe(false);
    const s = reducer(
      { ...initialState, status: "playing", speed: 2 },
      { type: "tick", delta: 3 },
    );
    expect(s.time).toBe(6);
    expect(reducer(s, { type: "seek", value: -7 }).time).toBe(0);
    expect(timestamp(32)).toBe("2026-10-15T10:00:32.000Z");
  });
});
