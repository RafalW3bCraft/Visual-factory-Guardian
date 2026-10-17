import { DURATION, reading, type Metric } from "../simulation/engine";
export type Vec = [number, number, number];
export const crack: [number, number][] = [
  [0.17, -0.2],
  [0.24, -0.13],
  [0.21, -0.06],
  [0.29, 0.01],
  [0.27, 0.09],
  [0.34, 0.15],
];
export const stages = [
  {
    time: 0,
    name: "Factory idle",
    title: "Industrial intelligence.\nIn action.",
    detail:
      "One component. One continuous investigation. Scroll to set the line in motion.",
  },
  {
    time: 4,
    name: "Robot activation",
    title: "Precision starts\nwith a movement.",
    detail:
      "The manipulator grips, lifts and transfers P-004 onto the inspection conveyor.",
  },
  {
    time: 18,
    name: "Conveyor transport",
    title: "Follow the part.\nKeep the context.",
    detail:
      "A machined flange travels from the handling cell to camera CAM-01.",
  },
  {
    time: 28,
    name: "Vision activation",
    title: "A closer look.\nA traceable observation.",
    detail:
      "CAM-01 tracks P-004. The inspection region stays attached to its surface.",
  },
  {
    time: 32,
    name: "Potential anomaly",
    title: "Small mark.\nImportant question.",
    detail:
      "A surface discontinuity is visible. Evidence captured. Review required.",
  },
  {
    time: 35,
    name: "Sensor correlation",
    title: "An observation\nneeds context.",
    detail:
      "Temperature drift precedes the visual event by 14 seconds. Correlation does not establish cause.",
  },
  {
    time: 44,
    name: "AI investigation",
    title: "Evidence first.\nExplanation second.",
    detail:
      "Trace the observation, compare sensor context and examine a possible explanation.",
  },
  {
    time: 50,
    name: "Operator decision",
    title: "The next move\nis yours.",
    detail:
      "Review the evidence. Challenge the explanation. Record your engineering decision.",
  },
] as const;
const smooth = (n: number) => n * n * (3 - 2 * n);
export function clamp(n: number, max = 1) {
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
}
export function keyframe(
  t: number,
  frames: readonly (readonly [number, number])[],
) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [a, x] = frames[i - 1],
        [b, y] = frames[i];
      return x + (y - x) * smooth((t - a) / (b - a));
    }
  }
  return frames[frames.length - 1][1];
}
const axis = (
  t: number,
  frames: readonly (readonly [number, Vec])[],
  i: number,
) =>
  keyframe(
    t,
    frames.map(([t, v]) => [t, v[i]]),
  );
export function vectorAt(
  t: number,
  frames: readonly (readonly [number, Vec])[],
): Vec {
  return [axis(t, frames, 0), axis(t, frames, 1), axis(t, frames, 2)];
}
export const gripKeys: readonly (readonly [number, Vec])[] = [
  [0, [-2.3, 3.15, 1.5]],
  [4, [-2.3, 3.15, 1.5]],
  [7, [-2.3, 1.65, 1.5]],
  [8.5, [-2.3, 1.65, 1.5]],
  [11, [-2.3, 2.8, 1.5]],
  [15, [-1.05, 2.8, 0]],
  [17, [-1.05, 1.65, 0]],
  [18.5, [-1.05, 1.65, 0]],
  [22, [-2, 3.1, -0.3]],
];
export const shoulder: Vec = [-3.7, 1.45, 0];
export const links = [1.85, 1.7] as const;
export function solveArm(target: Vec) {
  const dx = target[0] - shoulder[0],
    dz = target[2] - shoulder[2],
    dy = target[1] - shoulder[1];
  const radial = Math.hypot(dx, dz),
    distance = Math.hypot(radial, dy);
  const yaw = Math.atan2(dz, dx);
  const upper =
    Math.atan2(dy, radial) +
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (links[0] ** 2 + distance ** 2 - links[1] ** 2) /
            (2 * links[0] * distance),
        ),
      ),
    );
  const elbow: Vec = [
    shoulder[0] + Math.cos(yaw) * Math.cos(upper) * links[0],
    shoulder[1] + Math.sin(upper) * links[0],
    shoulder[2] + Math.sin(yaw) * Math.cos(upper) * links[0],
  ];
  return { elbow, yaw, upper };
}
export function frameAt(progress: number) {
  const p = clamp(progress),
    time = p * DURATION;
  const grip = vectorAt(time, gripKeys);
  const transport = keyframe(time, [
    [18.5, -1.05],
    [28, 2],
  ]);
  const part: Vec =
    time < 8
      ? [-2.3, 1.25, 1.5]
      : time <= 18.5
        ? [grip[0], grip[1] - 0.4, grip[2]]
        : [transport, 1.25, 0];
  const stage = stages.reduce((v, s, i) => (time >= s.time ? i : v), 0);
  return {
    progress: p,
    time,
    stage,
    grip,
    part,
    ...solveArm(grip),
    opening: keyframe(time, [
      [0, 0.58],
      [7, 0.58],
      [8, 0.4625],
      [17, 0.4625],
      [18.5, 0.58],
    ]),
    belt: (transport + 1.05) / 0.11,
    detection: time >= 28,
    anomaly: time >= 32,
    scan: clamp((time - 28) / 4),
    reasoning: time < 44 ? 0 : Math.min(5, Math.floor(time - 44) + 1),
    sensors: Object.fromEntries(
      (["temperature", "vibration", "current"] as Metric[]).map((m) => [
        m,
        reading(m, time),
      ]),
    ) as Record<Metric, number>,
    camera: vectorAt(time, [
      [0, [8.4, 6.4, 10.8]],
      [4, [7, 5.8, 10]],
      [8, [2, 4.5, 8]],
      [16, [3, 4.8, 8]],
      [26, [6, 5, 7]],
      [29, [5, 4.6, 5.7]],
      [33, [3.6, 3.8, 3.1]],
      [38, [5.8, 4.5, 6.8]],
      [50, [7, 5.4, 9]],
    ]),
    target: vectorAt(time, [
      [0, [-0.4, 1.3, 0]],
      [8, [-2.1, 1.65, 0.7]],
      [18, [-0.7, 1.5, 0]],
      [28, [1.9, 1.65, 0]],
      [33, [2, 1.4, 0]],
      [38, [1, 1.35, -0.5]],
      [50, [0, 1.5, 0]],
    ]),
  };
}
export type Frame = ReturnType<typeof frameAt>;
export type Decision = "confirmed" | "rejected" | "reinspect";
export type Review = {
  decision: Decision;
  time: number;
  note: string;
  id: number;
};
export type DemoState = { time: number; playing: boolean; reviews: Review[] };
export const demoInitial: DemoState = { time: 0, playing: false, reviews: [] };
export type DemoAction =
  | { type: "play" | "pause" | "restart" }
  | { type: "seek" | "tick"; value: number }
  | { type: "decide"; decision: Decision; note: string };
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "play":
      return {
        ...state,
        time: state.time >= DURATION ? 0 : state.time,
        playing: true,
      };
    case "pause":
      return { ...state, playing: false };
    case "restart":
      return { ...demoInitial, reviews: [] };
    case "seek":
      return { ...state, time: clamp(action.value, DURATION), playing: false };
    case "tick": {
      if (!state.playing) return state;
      const time = clamp(state.time + clamp(action.value, 1), DURATION);
      return { ...state, time, playing: time < DURATION };
    }
    case "decide":
      return state.time < 50
        ? state
        : {
            ...state,
            playing: false,
            reviews: [
              ...state.reviews,
              {
                decision: action.decision,
                note: action.note.trim(),
                time: state.time,
                id: state.reviews.length + 1,
              },
            ],
          };
  }
}
