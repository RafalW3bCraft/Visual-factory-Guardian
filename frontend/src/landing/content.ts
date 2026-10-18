import {
  ANOMALY_TIME,
  FAULT_TIME,
  metrics,
  reading,
  SCENARIO,
} from "../simulation/engine";

export const chapters = [
  { id: "factory", label: "The factory" },
  { id: "signals", label: "The unseen" },
  { id: "vision", label: "Machine vision" },
  { id: "context", label: "Beyond the image" },
  { id: "understanding", label: "The investigation" },
  { id: "next", label: "The complete picture" },
] as const;

export const photographs = {
  factory: {
    name: "factory",
    alt: "Generated illustration of a steel manufacturing hall with orange robotic arms, conveyors and light falling through roof trusses.",
    position: "64% 50%",
  },
  motor: {
    name: "motor",
    alt: "Generated illustration of a finned industrial motor and a machined steel drive coupling, with warm light across the metal surfaces.",
    position: "66% 50%",
  },
} as const;

export const sensorSnapshot = {
  scenario: SCENARIO,
  seconds: ANOMALY_TIME,
  lead: ANOMALY_TIME - FAULT_TIME,
  readings: (["temperature", "vibration", "current"] as const).map((key) => ({
    key,
    label: metrics[key].label,
    value: reading(key, ANOMALY_TIME).toFixed(2),
    unit: metrics[key].unit,
    baseline: metrics[key].baseline,
  })),
};
