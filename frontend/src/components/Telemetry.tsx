import { useState } from "react";
import { Thermometer, Activity, Zap } from "lucide-react";
import {
  metrics,
  reading,
  clockLabel,
  DURATION,
  FAULT_TIME,
  ANOMALY_TIME,
  evidenceFor,
  type Metric,
  type Inspection,
} from "../simulation/engine";
export function Telemetry({
  time,
  metric,
  onSelect,
  onSeek,
  event,
}: {
  time: number;
  metric: Metric;
  onSelect: (m: Metric) => void;
  onSeek: (t: number) => void;
  event: Inspection;
}) {
  return (
    <section className="telemetry-section" aria-label="Simulated telemetry">
      <div className="section-label">
        <span>TELEMETRY / LINE 01</span>
        <span className="source-label">SIMULATED · FULL SCENARIO</span>
      </div>
      <div className="telemetry-grid">
        {(Object.keys(metrics) as Metric[]).map((m) => (
          <SensorChart
            key={m}
            metric={m}
            time={time}
            selected={metric === m}
            onSelect={() => onSelect(m)}
            onSeek={onSeek}
            event={event}
          />
        ))}
      </div>
    </section>
  );
}
function SensorChart({
  metric,
  time,
  selected,
  onSelect,
  onSeek,
  event,
}: {
  metric: Metric;
  time: number;
  selected: boolean;
  onSelect: () => void;
  onSeek: (t: number) => void;
  event: Inspection;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const config = metrics[metric];
  const sample = hover ?? time;
  const value = reading(metric, sample);
  const color = metric === "temperature" ? "#ffb347" : "#42c8e8";
  const Icon =
    metric === "temperature"
      ? Thermometer
      : metric === "vibration"
        ? Activity
        : Zap;
  const x = (t: number) => 14 + (t / DURATION) * 312;
  const y = (v: number) =>
    71 - ((v - config.range[0]) / (config.range[1] - config.range[0])) * 60;
  const points = Array.from(
    { length: 57 },
    (_, t) => `${x(t)},${y(reading(metric, t))}`,
  ).join(" ");
  const window = evidenceFor(event).window;
  return (
    <article className={`sensor-chart ${selected ? "active" : ""}`}>
      <button
        className="sensor-heading"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span>
          <Icon size={15} />
          {config.label}
        </span>
        <strong>
          {value.toFixed(1)} <small>{config.unit}</small>
        </strong>
      </button>
      <svg
        role="img"
        aria-label={`${config.label} simulated trend. Baseline ${config.baseline} ${config.unit}. Current ${reading(metric, time).toFixed(1)} ${config.unit}. Drift injected at 18 seconds; flagged inspection at 32 seconds.`}
        viewBox="0 0 340 104"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                56,
                Math.round(
                  ((((e.clientX - r.left) / r.width) * 340 - 14) / 312) * 56,
                ),
              ),
            ),
          );
        }}
        onPointerLeave={() => setHover(null)}
        onClick={() => {
          if (hover !== null) onSeek(hover);
        }}
      >
        <rect
          x={x(window[0])}
          y="5"
          width={x(window[1]) - x(window[0])}
          height="72"
          fill="#42c8e8"
          opacity=".035"
        />
        {[15, 40, 65].map((n) => (
          <line
            key={n}
            x1="14"
            y1={n}
            x2="326"
            y2={n}
            stroke="#ffffff"
            strokeOpacity=".06"
          />
        ))}
        <line
          x1="14"
          x2="326"
          y1={y(config.baseline)}
          y2={y(config.baseline)}
          stroke="#8d9ba8"
          strokeDasharray="3 4"
          opacity=".6"
        />
        <line
          x1={x(FAULT_TIME)}
          x2={x(FAULT_TIME)}
          y1="6"
          y2="76"
          stroke="#ffb347"
          strokeDasharray="2 4"
          opacity=".45"
        />
        <line
          x1={x(ANOMALY_TIME)}
          x2={x(ANOMALY_TIME)}
          y1="6"
          y2="76"
          stroke="#ff5b57"
          strokeDasharray="2 4"
          opacity=".65"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
        />
        <line
          x1={x(sample)}
          x2={x(sample)}
          y1="6"
          y2="77"
          stroke="#e2eaf1"
          opacity=".45"
        />
        <circle cx={x(sample)} cy={y(value)} r="3" fill={color} />
        <text x="14" y="96">
          00:00
        </text>
        <text x={x(18)} y="96" textAnchor="middle">
          00:18
        </text>
        <text x={x(32)} y="96" textAnchor="middle">
          00:32
        </text>
        <text x="326" y="96" textAnchor="end">
          00:56
        </text>
      </svg>
      <div className="chart-foot">
        <span>
          Baseline {config.baseline} {config.unit}
        </span>
        <span>
          {hover !== null
            ? `${clockLabel(hover)} · click to inspect`
            : `Δ ${value - config.baseline >= 0 ? "+" : ""}${(value - config.baseline).toFixed(1)} ${config.unit}`}
        </span>
      </div>
    </article>
  );
}
