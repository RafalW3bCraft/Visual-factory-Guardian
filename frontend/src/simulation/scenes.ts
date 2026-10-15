import type { Equipment } from "./engine";
export const scenes: {
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  time: number;
  focus: Equipment;
}[] = [
  {
    name: "Overview",
    eyebrow: "01 / ENTER THE FACTORY",
    title: "Every defect has a story.",
    description:
      "Connect visual anomalies, machine telemetry, and evidence. Understand what to investigate next.",
    time: 0,
    focus: "overview",
  },
  {
    name: "The problem",
    eyebrow: "02 / BEYOND DETECTION",
    title: "A defect is only the beginning.",
    description:
      "A camera can flag a product. Understanding what changed in the process takes a wider view.",
    time: 8,
    focus: "conveyor",
  },
  {
    name: "Computer vision",
    eyebrow: "03 / SEE THE ANOMALY",
    title: "One product. A closer look.",
    description:
      "Compare a normal inspection with a flagged sample. A score is a signal to investigate—not a probability of failure.",
    time: 32,
    focus: "camera",
  },
  {
    name: "Telemetry",
    eyebrow: "04 / LOOK INSIDE",
    title: "What changed in the machine?",
    description:
      "Inspect temperature, vibration, and motor current on the same clock. Every reading here is simulated.",
    time: 36,
    focus: "temperature",
  },
  {
    name: "Timeline",
    eyebrow: "05 / CONNECT THE EVIDENCE",
    title: "The sequence matters.",
    description:
      "The temperature rise precedes the flagged inspection by 14 seconds in this designed scenario. Timing alone does not prove a cause.",
    time: 40,
    focus: "conveyor",
  },
  {
    name: "Investigation",
    eyebrow: "06 / FOLLOW THE EVIDENCE",
    title: "Don’t just detect. Investigate.",
    description:
      "Trace a candidate explanation back to its observations. Keep evidence, hypothesis, and uncertainty distinct.",
    time: 44,
    focus: "temperature",
  },
  {
    name: "Operator action",
    eyebrow: "07 / HUMAN IN THE LOOP",
    title: "An informed next step.",
    description:
      "Review the evidence, then decide what to inspect. The prototype never controls real machinery.",
    time: 48,
    focus: "control",
  },
  {
    name: "AMD architecture",
    eyebrow: "08 / UNDER THE HOOD",
    title: "Built for the next investigation.",
    description:
      "Browser visualization and AI inference are separate workloads. Explore where AMD compute belongs in the proposed pipeline.",
    time: 48,
    focus: "overview",
  },
  {
    name: "Try the demo",
    eyebrow: "09 / YOUR TURN",
    title: "Take the investigation further.",
    description:
      "Replay the complete scenario, explore each machine, or check the availability of the team’s live analysis service.",
    time: 0,
    focus: "overview",
  },
];
