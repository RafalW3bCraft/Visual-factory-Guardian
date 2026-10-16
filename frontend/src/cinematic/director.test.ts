import { describe, it, expect } from "vitest";
import { storyState } from "./director";
describe("reversible cinematic director", () => {
  it("restores the same camera and machine state after a complete forward/reverse journey", () => {
    const progress = Array.from({ length: 301 }, (_, i) => i / 300);
    const forward = progress.map((p) => storyState(p));
    const reverse = progress
      .slice()
      .reverse()
      .map((p) => storyState(p))
      .reverse();
    expect(reverse).toEqual(forward);
    expect(forward[0].explode).toBe(0);
    expect(forward[150].explode).toBe(1);
    expect(forward[300].explode).toBe(0);
  });
  it("has no camera or product discontinuities across chapter boundaries", () => {
    for (let i = 1; i < 1000; i++) {
      const a = storyState((i - 1) / 1000),
        b = storyState(i / 1000);
      expect(
        Math.hypot(...b.position.map((n, j) => n - a.position[j])),
      ).toBeLessThan(0.25);
      expect(Math.abs(b.productX - a.productX)).toBeLessThan(0.05);
      expect(b.productX).toBeGreaterThanOrEqual(a.productX);
    }
  });
  it("bounds invalid/restored scroll offsets and keeps responsive presets finite", () => {
    for (const p of [-1, 0, 0.18, 0.5, 0.999, 1, 2, NaN, Infinity])
      for (const mobile of [false, true])
        for (const reduced of [false, true]) {
          const s = storyState(p, mobile, reduced);
          expect(s.progress).toBeGreaterThanOrEqual(0);
          expect(s.progress).toBeLessThanOrEqual(1);
          expect([...s.position, ...s.target].every(Number.isFinite)).toBe(
            true,
          );
        }
  });
});
