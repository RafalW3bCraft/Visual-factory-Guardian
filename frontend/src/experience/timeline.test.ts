import { describe, it, expect } from "vitest";
import {
  frameAt,
  links,
  shoulder,
  demoReducer,
  demoInitial,
  type Vec,
} from "./timeline";
const distance = (a: Vec, b: Vec) => Math.hypot(...a.map((v, i) => v - b[i]));
describe("scroll-controlled cell", () => {
  it("reverses to exactly the same pose and never uses elapsed wall time", () => {
    const forward = Array.from({ length: 561 }, (_, i) => frameAt(i / 560));
    for (let i = 560; i >= 0; i--) expect(frameAt(i / 560)).toEqual(forward[i]);
  });
  it("preserves both physical link lengths throughout the operation", () => {
    for (let t = 0; t <= 56; t += 0.05) {
      const f = frameAt(t / 56);
      expect(distance(shoulder, f.elbow)).toBeCloseTo(links[0], 8);
      expect(distance(f.elbow, f.grip)).toBeCloseTo(links[1], 8);
    }
  });
  it("keeps the flange attached to the tool until release, then seated on the conveyor", () => {
    for (let t = 8; t <= 18.5; t += 0.1) {
      const f = frameAt(t / 56);
      expect(f.part[0]).toBe(f.grip[0]);
      expect(f.part[1]).toBeCloseTo(f.grip[1] - 0.4, 8);
      expect(f.part[2]).toBe(f.grip[2]);
    }
    for (let t = 18.6; t <= 56; t += 0.1) {
      const f = frameAt(t / 56);
      expect(f.part[1]).toBe(1.25);
      expect(f.part[2]).toBe(0);
    }
  });
  it("has no teleport at pickup, release, scan or camera transitions", () => {
    for (let t = 0.01; t <= 56; t += 0.01) {
      const a = frameAt((t - 0.01) / 56),
        b = frameAt(t / 56);
      expect(distance(a.part, b.part)).toBeLessThan(0.025);
      expect(distance(a.grip, b.grip)).toBeLessThan(0.025);
      expect(distance(a.camera, b.camera)).toBeLessThan(0.04);
    }
  });
  it("aligns the component under CAM-01 before detecting the fixed anomaly", () => {
    expect(frameAt(27.99 / 56).detection).toBe(false);
    expect(frameAt(28 / 56).part[0]).toBeCloseTo(2, 10);
    expect(frameAt(28 / 56).part.slice(1)).toEqual([1.25, 0]);
    expect(frameAt(31.99 / 56).anomaly).toBe(false);
    expect(frameAt(32 / 56).anomaly).toBe(true);
    expect(frameAt(32 / 56).sensors.temperature).toBe(82.49);
    expect(frameAt(49 / 56).reasoning).toBe(5);
  });
  it("clamps malformed progress and boundaries", () => {
    expect(frameAt(NaN)).toEqual(frameAt(0));
    expect(frameAt(-1)).toEqual(frameAt(0));
    expect(frameAt(3)).toEqual(frameAt(1));
  });
});
describe("operator scenario", () => {
  it("starts, pauses, seeks, resumes, completes and restarts", () => {
    let s = demoReducer(demoInitial, { type: "play" });
    s = demoReducer(s, { type: "tick", value: 0.5 });
    expect(s.time).toBe(0.5);
    s = demoReducer(s, { type: "pause" });
    expect(demoReducer(s, { type: "tick", value: 1 })).toEqual(s);
    s = demoReducer(s, { type: "seek", value: 55.8 });
    s = demoReducer(s, { type: "play" });
    s = demoReducer(s, { type: "tick", value: 0.5 });
    expect(s.time).toBe(56);
    expect(s.playing).toBe(false);
    expect(demoReducer(s, { type: "restart" })).toEqual(demoInitial);
  });
  it("requires evidence assembly before accepting review and retains a revision history", () => {
    expect(
      demoReducer(demoInitial, {
        type: "decide",
        decision: "confirmed",
        note: "",
      }),
    ).toEqual(demoInitial);
    let s = demoReducer(demoInitial, { type: "seek", value: 50 });
    for (const decision of ["confirmed", "rejected", "reinspect"] as const)
      s = demoReducer(s, { type: "decide", decision, note: ` ${decision} ` });
    expect(s.reviews.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(s.reviews[2].note).toBe("reinspect");
    expect(demoReducer(s, { type: "seek", value: 10 }).reviews).toEqual(
      s.reviews,
    );
    expect(demoReducer(s, { type: "restart" }).reviews).toEqual([]);
  });
  it("does not advance while paused or on negative/nonfinite deltas", () => {
    let s = { ...demoInitial, playing: true, time: 4 };
    for (const value of [-1, NaN, Infinity])
      expect(demoReducer(s, { type: "tick", value }).time).toBe(4);
  });
});
