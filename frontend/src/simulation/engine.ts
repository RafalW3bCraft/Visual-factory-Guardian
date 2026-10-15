export const DURATION = 56;
export const FAULT_TIME = 18;
export const ANOMALY_TIME = 32;
export const SCENARIO = "thermal-drift-001";
export const EPOCH = Date.parse("2026-10-15T10:00:00Z");
export type Metric = "temperature" | "vibration" | "current";
export type Equipment =
  | "overview"
  | "conveyor"
  | "camera"
  | "temperature"
  | "vibration"
  | "motor"
  | "control";
export const metrics: Record<
  Metric,
  {
    label: string;
    unit: string;
    baseline: number;
    threshold: number;
    range: [number, number];
    equipment: Equipment;
  }
> = {
  temperature: {
    label: "Temperature",
    unit: "°C",
    baseline: 64,
    threshold: 75,
    range: [58, 92],
    equipment: "temperature",
  },
  vibration: {
    label: "Vibration",
    unit: "mm/s",
    baseline: 2.1,
    threshold: 4,
    range: [0, 5],
    equipment: "vibration",
  },
  current: {
    label: "Motor current",
    unit: "A",
    baseline: 42,
    threshold: 55,
    range: [30, 62],
    equipment: "motor",
  },
};
export function reading(metric: Metric, seconds: number) {
  const t = Math.max(0, Math.min(DURATION, seconds));
  const drift = Math.min(1, Math.max(0, (t - FAULT_TIME) / 18));
  const values = {
    temperature: 64 + 24 * drift + Math.sin(t * 0.9) * 0.35,
    vibration: 2.1 + 0.8 * drift + Math.sin(t * 1.7) * 0.12,
    current: 42 + 7 * drift + Math.sin(t * 0.6) * 0.5,
  };
  return Number(values[metric].toFixed(2));
}
export function timestamp(seconds: number) {
  return new Date(EPOCH + seconds * 1000).toISOString();
}
export function clockLabel(seconds: number) {
  return `00:${Math.floor(seconds).toString().padStart(2, "0")}`;
}
export const inspections = Array.from({ length: 6 }, (_, i) => ({
  id: `evt-${String(i + 1).padStart(3, "0")}`,
  productId: `P-${String(i + 1).padStart(3, "0")}`,
  time: 8 + i * 8,
  flagged: i === 3,
  score: i === 3 ? 0.87 : 0.12 + i * 0.02,
  source: "synthetic fixture" as const,
}));
export type Inspection = (typeof inspections)[number];
export const milestones = [
  {
    time: 8,
    title: "Normal inspection",
    detail: "P-001 · below illustrative threshold",
    kind: "normal",
  },
  {
    time: 18,
    title: "Thermal drift injected",
    detail: "Synthetic temperature begins to rise",
    kind: "sensor",
  },
  {
    time: 32,
    title: "Visual anomaly flagged",
    detail: "P-004 · synthetic score 0.87",
    kind: "anomaly",
  },
  {
    time: 38,
    title: "Evidence assembled",
    detail: "Temperature window aligned to evt-004",
    kind: "evidence",
  },
  {
    time: 44,
    title: "Investigation ready",
    detail: "Candidate explanation · human review required",
    kind: "evidence",
  },
];
export type Phase =
  | "IDLE"
  | "FACTORY_RUNNING"
  | "PRODUCT_APPROACHING"
  | "INSPECTION_ACTIVE"
  | "ANOMALY_FLAGGED"
  | "TELEMETRY_ANALYSIS"
  | "EVIDENCE_READY"
  | "INVESTIGATION_COMPLETE";
export function phaseAt(t: number): Phase {
  return t >= 44
    ? "INVESTIGATION_COMPLETE"
    : t >= 38
      ? "EVIDENCE_READY"
      : t >= 35
        ? "TELEMETRY_ANALYSIS"
        : t >= 32
          ? "ANOMALY_FLAGGED"
          : t >= 8 && t < 10
            ? "INSPECTION_ACTIVE"
            : t >= 5
              ? "PRODUCT_APPROACHING"
              : "FACTORY_RUNNING";
}
export type Simulation = {
  time: number;
  status: "idle" | "playing" | "paused" | "complete";
  speed: number;
  reviewed: boolean;
};
export const initialState: Simulation = {
  time: 0,
  status: "idle",
  speed: 1,
  reviewed: false,
};
export type Action =
  | { type: "start" | "toggle" | "reset" | "review" }
  | { type: "tick"; delta: number }
  | { type: "seek" | "speed"; value: number };
export function reducer(state: Simulation, action: Action): Simulation {
  switch (action.type) {
    case "start":
      return { ...initialState, status: "playing" };
    case "reset":
      return { ...initialState };
    case "toggle":
      return state.status === "playing"
        ? { ...state, status: "paused" }
        : state.time >= DURATION
          ? { ...initialState, status: "playing" }
          : { ...state, status: "playing" };
    case "tick": {
      if (state.status !== "playing" || !Number.isFinite(action.delta))
        return state;
      const time = Math.min(
        DURATION,
        state.time + Math.max(0, action.delta) * state.speed,
      );
      return {
        ...state,
        time,
        status: time === DURATION ? "complete" : "playing",
      };
    }
    case "seek": {
      if (!Number.isFinite(action.value)) return state;
      const time = Math.max(0, Math.min(DURATION, action.value));
      return {
        ...state,
        time,
        status: "paused",
        reviewed: time >= 44 && state.reviewed,
      };
    }
    case "speed":
      return {
        ...state,
        speed: [0.5, 1, 2].includes(action.value) ? action.value : 1,
      };
    case "review":
      return state.time >= 44 ? { ...state, reviewed: true } : state;
  }
}
export function evidenceFor(event: Inspection) {
  const baseline =
    Array.from({ length: FAULT_TIME }, (_, i) =>
      reading("temperature", i),
    ).reduce((a, b) => a + b, 0) / FAULT_TIME;
  const observed = reading("temperature", event.time);
  return {
    baseline,
    observed,
    delta: observed - baseline,
    leadSeconds: event.time - FAULT_TIME,
    hasDrift: event.time > FAULT_TIME,
    window: [
      Math.max(0, event.time - 18),
      Math.min(DURATION, event.time + 8),
    ] as [number, number],
  };
}
export function productPosition(time: number, index: number) {
  return 2 + (time - inspections[index].time) * 0.38;
}
