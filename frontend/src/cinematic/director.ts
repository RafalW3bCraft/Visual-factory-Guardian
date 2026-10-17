export type V3 = [number, number, number];
export const chapterNames = [
  "The reveal",
  "The product",
  "Visual inspection",
  "Inside the machine",
  "Connecting evidence",
  "Investigation",
  "The big picture",
];
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const cameras: { position: V3; target: V3 }[] = [
  { position: [11, 8, 12], target: [-1.5, 1, 0] },
  { position: [0.8, 4.3, 5.6], target: [-2.4, 1.5, 0.35] },
  { position: [4.5, 5.5, 5.2], target: [1.65, 1.8, 0.35] },
  { position: [6, 5.2, 10], target: [-1.4, 1.8, -0.6] },
  { position: [8, 7, 11], target: [-0.8, 1.5, -0.3] },
  { position: [4.2, 5.8, 9], target: [-2.2, 2, -1] },
  { position: [12, 9, 15], target: [-1, 1.1, 0] },
];
export function storyState(progress: number, mobile = false, reduced = false) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const travel = p * 6;
  // Hold each composition for reading; spend the intervening interval moving.
  const index = Math.min(5, Math.floor(travel));
  const fraction = reduced
    ? travel - index >= 0.5
      ? 1
      : 0
    : smooth((travel - index - 0.22) / 0.56);
  const vector = (key: "position" | "target"): V3 =>
    cameras[index][key].map((n, i) =>
      mix(n, cameras[index + 1][key][i], fraction),
    ) as V3;
  const position = vector("position");
  const target = vector("target");
  if (mobile) {
    // Portrait keeps the complete assembly between the headline and evidence.
    const direction = position.map((n, i) => n - target[i]);
    const length = Math.hypot(...direction);
    target.splice(0, 3, 0, 1.5, 0);
    position.forEach((_, i) => {
      position[i] = target[i] + (direction[i] / length) * 29;
    });
  }
  const explode = smooth((p - 0.37) / 0.12) * (1 - smooth((p - 0.84) / 0.13));
  return {
    progress: p,
    chapter: Math.min(6, Math.round(travel)),
    position,
    target,
    explode,
    productX: mix(-4.5, 1.65, smooth((p - 0.06) / 0.27)),
    productTurn: mix(0, 0.35, smooth((p - 0.17) / 0.13)),
    inspection: smooth((p - 0.24) / 0.06) * (1 - smooth((p - 0.39) / 0.06)),
    evidence: smooth((p - 0.53) / 0.08) * (1 - smooth((p - 0.85) / 0.08)),
    dark: smooth((p - 0.37) / 0.09) * (1 - smooth((p - 0.86) / 0.1)),
  };
}
export type StoryState = ReturnType<typeof storyState>;
export type StoryClock = {
  progress: number;
  reduced: boolean;
  paused: boolean;
};
