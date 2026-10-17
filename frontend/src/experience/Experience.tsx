import { lazy, Suspense, useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  ScanLine,
  X,
  ChevronRight,
} from "lucide-react";
import {
  DURATION,
  inspections,
  metrics,
  reading,
  timestamp,
  type Metric,
} from "../simulation/engine";
import {
  crack,
  clamp,
  demoInitial,
  demoReducer,
  frameAt,
  stages,
  type Decision,
  type Frame,
} from "./timeline";
import "./experience.css";
const FactoryScene = lazy(() => import("./FactoryScene"));

function useReduced() {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(q.matches);
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  return reduced;
}
function Header({ demo = false, time = 0 }: { demo?: boolean; time?: number }) {
  return (
    <header className="ex-header">
      <a
        className="ex-brand"
        href="#factory"
        aria-label="Visual Factory Guardian home"
      >
        <span className="ex-monogram">
          V<span>G</span>
        </span>
        <span>
          VISUAL FACTORY
          <br />
          GUARDIAN<span className="ex-orange">.</span>
        </span>
      </a>
      <span className="ex-header-center">
        {demo ? "OPERATOR WORKSPACE" : "INDUSTRIAL INTELLIGENCE IN ACTION"}
      </span>
      {demo ? (
        <a href="#factory">
          <ArrowLeft size={14} /> Factory story
        </a>
      ) : (
        <a href={`#/demo?t=${time.toFixed(3)}`}>
          Open demo <ArrowUpRight size={16} />
        </a>
      )}
    </header>
  );
}
function StageNav({
  frame,
  seek,
}: {
  frame: Frame;
  seek: (t: number) => void;
}) {
  return (
    <nav className="ex-stages" aria-label="Manufacturing stages">
      {stages.map((s, i) => (
        <button
          key={s.name}
          onClick={() => seek(s.time)}
          aria-current={frame.stage === i ? "step" : undefined}
          aria-label={`${i + 1}. ${s.name}`}
        >
          <span>{String(i + 1).padStart(2, "0")}</span>
          <b>{s.name}</b>
          <i />
        </button>
      ))}
    </nav>
  );
}
function Scene({
  frame,
  reduced,
  focus,
  onInspect,
}: {
  frame: Frame;
  reduced: boolean;
  focus?: string;
  onInspect?: () => void;
}) {
  return (
    <div
      className="ex-viewport"
      data-time={frame.time.toFixed(3)}
      data-stage={frame.stage}
      data-pose={JSON.stringify({
        grip: frame.grip,
        part: frame.part,
        elbow: frame.elbow,
        camera: frame.camera,
      })}
    >
      <Suspense
        fallback={
          <div className="ex-loading">Preparing manufacturing cell…</div>
        }
      >
        <FactoryScene
          progress={frame.progress}
          reduced={reduced}
          focus={focus}
          onInspect={onInspect}
        />
      </Suspense>
      <div className="ex-camera-label">
        <span className="ex-dot" /> CELL 01 /{" "}
        {frame.stage < 3 ? "DIRECTOR VIEW" : "CAM-01 · INSPECTION"}
      </div>
      <span className="ex-render-label">REAL-TIME 3D · SIMULATED PROCESS</span>
    </div>
  );
}
function SignalChart({ metric, time }: { metric: Metric; time: number }) {
  const m = metrics[metric],
    y = (v: number) => 94 - ((v - m.range[0]) / (m.range[1] - m.range[0])) * 76;
  const points = Array.from(
    { length: Math.floor(time) + 1 },
    (_, t) => `${12 + (t / DURATION) * 276},${y(reading(metric, t))}`,
  ).join(" ");
  return (
    <svg
      viewBox="0 0 300 112"
      className="ex-chart"
      role="img"
      aria-label={`${m.label} synthetic trend; threshold ${m.threshold} ${m.unit}`}
    >
      <path d="M12 20H288M12 55H288M12 94H288" stroke="#2f3c42" fill="none" />
      <path
        d={`M12 ${y(m.threshold)}H288`}
        stroke="#b58d64"
        strokeDasharray="3 4"
      />
      <polyline points={points} stroke="#9ad8c6" strokeWidth="2" fill="none" />
      <path
        d={`M${12 + (32 / DURATION) * 276} 10V94`}
        stroke="#e8a15d"
        strokeDasharray="2 4"
      />
      <text x="12" y="109">
        T+00
      </text>
      <text x="151" y="109">
        EVENT +32
      </text>
      <text x="254" y="109">
        +56s
      </text>
    </svg>
  );
}
const reasoning = [
  [
    "Visual observation",
    "P-004 has a visible surface discontinuity in the outer flange. The fixture score is 0.87; it is not a calibrated probability.",
  ],
  [
    "Sensor context",
    "At T+32s, temperature is 82.49 °C against a 75 °C illustrative threshold. The injected drift starts at T+18s. Vibration remains below its 4 mm/s threshold.",
  ],
  [
    "Possible explanation",
    "Thermal process instability is a candidate to investigate. Timing alone cannot establish that heat produced the mark; handling damage is an alternative.",
  ],
  [
    "Uncertainty",
    "No validated causal model, live camera inference or LLM was used for this scenario. Sensor limits and the anomaly are reproducible demonstration fixtures.",
  ],
  [
    "Engineering recommendation",
    "Inspect the affected surface, verify sensor calibration and compare adjacent components before deciding whether process intervention is justified.",
  ],
];
function Reasoning({ count = 5 }: { count?: number }) {
  return (
    <ol className="ex-reasoning">
      {reasoning.slice(0, count).map(([title, body], i) => (
        <li key={title}>
          <span>0{i + 1}</span>
          <details open={i === 0}>
            <summary>{title}</summary>
            <p>{body}</p>
          </details>
        </li>
      ))}
    </ol>
  );
}
function StageContext({
  frame,
  onEvidence,
}: {
  frame: Frame;
  onEvidence: () => void;
}) {
  if (frame.stage === 4)
    return (
      <div className="ex-stage-context">
        <span className="ex-alert">POTENTIAL ANOMALY</span>
        <h3>Visual evidence captured.</h3>
        <p>Outer flange · P-004 · evt-004</p>
        <button onClick={onEvidence}>
          Inspect affected surface <ScanLine size={16} />
        </button>
        <small>Fixed synthetic evidence · review required</small>
      </div>
    );
  if (frame.stage === 5)
    return (
      <div className="ex-stage-context">
        <span className="ex-eyebrow">SENSOR CONTEXT / SYNTHETIC</span>
        <div className="ex-reading">
          {frame.sensors.temperature.toFixed(1)}
          <span>°C</span>
        </div>
        <SignalChart metric="temperature" time={frame.time} />
        <p>Drift +18s → Visual observation +32s</p>
        <small>Temporal association. Cause remains unverified.</small>
      </div>
    );
  if (frame.stage === 6)
    return (
      <div className="ex-stage-context">
        <span className="ex-eyebrow">TRACEABLE INVESTIGATION / FIXTURE</span>
        <Reasoning count={frame.reasoning} />
      </div>
    );
  if (frame.stage === 7)
    return (
      <div className="ex-stage-context">
        <span className="ex-eyebrow">HUMAN CONFIRMATION REQUIRED</span>
        <h3>Take control.</h3>
        <p>Explore the evidence and record a local review.</p>
        <a className="ex-primary" href={`#/demo?t=${frame.time.toFixed(3)}`}>
          Enter interactive demo <ArrowUpRight size={17} />
        </a>
      </div>
    );
  return (
    <div className="ex-technical">
      <span>
        {frame.stage === 0
          ? "AWAITING INPUT"
          : frame.stage === 1
            ? "ARTICULATED HANDLING CELL"
            : frame.stage === 2
              ? "SYNCHRONIZED TRANSPORT"
              : "REGION LOCK / P-004"}
      </span>
      <strong>
        {frame.stage === 0
          ? "Scroll to operate"
          : frame.stage === 1
            ? frame.time < 8
              ? "Approach → grip"
              : frame.time < 15
                ? "Lift → transfer"
                : "Place → release"
            : frame.stage === 2
              ? "Transport → inspection"
              : "Component detected"}
      </strong>
      <small>
        {frame.stage < 3
          ? "Part P-004 / machined flange"
          : "CAM-01 / fixed inspection fixture"}
      </small>
    </div>
  );
}
function Evidence({
  close,
  eventIndex = 3,
}: {
  close: () => void;
  eventIndex?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [zoom, setZoom] = useState(false),
    [region, setRegion] = useState(true),
    event = inspections[eventIndex];
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);
  const path = crack
    .map(([x, z], i) => `${i ? "L" : "M"}${200 + x * 330},${190 + z * 330}`)
    .join(" ");
  return (
    <dialog
      className="ex-evidence-dialog"
      ref={dialog}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="evidence-heading"
    >
      <div className="ex-dialog-top">
        <span className="ex-eyebrow">CAPTURE / {event.id} / SYNTHETIC</span>
        <button onClick={close} aria-label="Close evidence">
          <X size={20} />
        </button>
      </div>
      <h2 id="evidence-heading">
        {event.flagged
          ? "Examine the affected surface."
          : "Reference inspection."}
      </h2>
      <div className="ex-evidence-layout">
        <div className="ex-evidence-image">
          <svg
            viewBox="0 0 400 380"
            role="img"
            aria-label={
              event.flagged
                ? "Top-down reconstruction of P-004 with a jagged surface mark inside the highlighted outer flange region"
                : "Reference flange without a marked discontinuity"
            }
          >
            <defs>
              <radialGradient id="metal">
                <stop offset="0" stopColor="#e2e6e3" />
                <stop offset="0.5" stopColor="#839399" />
                <stop offset="0.8" stopColor="#c1ccc9" />
                <stop offset="1" stopColor="#677b85" />
              </radialGradient>
              <pattern
                id="turning"
                width="3"
                height="3"
                patternUnits="userSpaceOnUse"
              >
                <path d="M0 0H3" stroke="#34454a" strokeWidth="0.4" />
              </pattern>
            </defs>
            <g transform={zoom ? "translate(-300 -190) scale(2.1)" : undefined}>
              <circle
                cx="200"
                cy="190"
                r="139"
                fill="url(#metal)"
                stroke="#9eaeb3"
                strokeWidth="3"
              />
              <circle
                cx="200"
                cy="190"
                r="134"
                fill="url(#turning)"
                opacity="0.3"
              />
              {[80, 92, 129].map((r) => (
                <circle
                  key={r}
                  cx="200"
                  cy="190"
                  r={r}
                  stroke="#65777d"
                  fill="none"
                />
              ))}
              {Array.from({ length: 6 }, (_, i) => (
                <circle
                  key={i}
                  cx={200 + Math.cos((i * Math.PI) / 3) * 106}
                  cy={190 + Math.sin((i * Math.PI) / 3) * 106}
                  r="15"
                  fill="#14232a"
                  stroke="#a5b4ba"
                  strokeWidth="3"
                />
              ))}
              <circle
                cx="200"
                cy="190"
                r="65"
                fill="url(#metal)"
                stroke="#556a74"
                strokeWidth="4"
              />
              <circle
                cx="200"
                cy="190"
                r="35"
                fill="#16252c"
                stroke="#acbabd"
                strokeWidth="5"
              />
              {event.flagged && (
                <>
                  <path
                    d={path}
                    fill="none"
                    stroke="#33221a"
                    strokeWidth="3.5"
                  />
                  {region && (
                    <rect
                      x="239.6"
                      y="107.5"
                      width="89.1"
                      height="148.5"
                      fill="none"
                      stroke="#ffb971"
                      strokeWidth="2"
                    />
                  )}
                </>
              )}
            </g>
          </svg>
          <span>RECONSTRUCTED FIXTURE FRAME · CAM-01</span>
        </div>
        <div>
          <dl className="ex-metadata">
            <dt>Component</dt>
            <dd>{event.productId} · machined flange</dd>
            <dt>Capture time</dt>
            <dd>{timestamp(event.time)}</dd>
            <dt>Source</dt>
            <dd>Deterministic synthetic fixture</dd>
            <dt>Anomaly score</dt>
            <dd>{event.score.toFixed(2)} / illustrative threshold 0.65</dd>
            <dt>Inspection region</dt>
            <dd>
              {event.flagged
                ? "Outer flange · local X 0.12–0.39, Z −0.25–0.20"
                : "Full flange / no flagged region"}
            </dd>
            <dt>Interpretation</dt>
            <dd>
              {event.flagged
                ? "Potential surface discontinuity. Engineering review required."
                : "Below fixture threshold. Not a production quality certification."}
            </dd>
          </dl>
          {event.flagged && (
            <div className="ex-evidence-actions">
              <button aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
                {zoom ? "Full component" : "Magnify defect"}
              </button>
              <button aria-pressed={region} onClick={() => setRegion(!region)}>
                {region ? "Hide region" : "Show region"}
              </button>
            </div>
          )}
          <p className="ex-fine">
            The reconstruction uses the same surface coordinates as the 3D
            component. No camera image or live inference is claimed.
          </p>
        </div>
      </div>
    </dialog>
  );
}
export function FactoryStory() {
  const root = useRef<HTMLElement>(null),
    [progress, setProgress] = useState(0),
    [manual, setManual] = useState(false),
    [evidence, setEvidence] = useState(false),
    reduced = useReduced();
  const stepped = manual || reduced,
    frame = frameAt(progress);
  useEffect(() => {
    if (stepped) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = root.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setProgress(clamp(-rect.top / (el.offsetHeight - innerHeight)));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (root.current) observer.observe(root.current);
    update();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [stepped]);
  const seek = (time: number) => {
    if (stepped) {
      setProgress(time / DURATION);
      return;
    }
    const el = root.current!;
    window.scrollTo({
      top: Math.ceil(
        el.getBoundingClientRect().top +
          scrollY +
          (time / DURATION) * (el.offsetHeight - innerHeight),
      ),
      behavior: "instant",
    });
  };
  return (
    <div className="ex">
      <a className="ex-skip" href="#story-controls">
        Skip to timeline controls
      </a>
      <main
        ref={root}
        id="factory"
        className={`ex-story ${stepped ? "ex-stepped" : ""}`}
      >
        <div className="ex-sticky">
          <Header time={frame.time} />
          <div className="ex-story-body">
            <Scene
              frame={frame}
              reduced={reduced}
              onInspect={() => setEvidence(true)}
            />
            <div className="ex-story-copy">
              <p className="ex-eyebrow">
                0{frame.stage + 1} / 08{" "}
                <span>— {stages[frame.stage].name}</span>
              </p>
              <h1>{stages[frame.stage].title}</h1>
              <p className="ex-description">{stages[frame.stage].detail}</p>
            </div>
            <StageContext frame={frame} onEvidence={() => setEvidence(true)} />
            <div className="ex-scene-footer">
              <span>
                THERMAL-DRIFT-001 <b> / </b> P-004
              </span>
              <span>T+{frame.time.toFixed(1).padStart(4, "0")}s / 56.0s</span>
            </div>
          </div>
          <div className="ex-story-controls" id="story-controls" tabIndex={-1}>
            <StageNav frame={frame} seek={seek} />
            <div className="ex-control-note">
              <span>
                {stepped
                  ? "Step through the process at your own pace."
                  : "SCROLL TO ADVANCE · REVERSE TO REWIND · STOP TO PAUSE"}
              </span>
              <button
                onClick={() => {
                  setManual(!manual);
                  setProgress(0);
                  window.scrollTo(0, 0);
                }}
                disabled={reduced}
              >
                {reduced
                  ? "Reduced motion · step controls"
                  : manual
                    ? "Use scroll control"
                    : "Use step controls"}
              </button>
            </div>
          </div>
        </div>
      </main>
      <footer className="ex-footer">
        <p>
          VISUAL FACTORY GUARDIAN{" "}
          <span> / Interactive manufacturing study 02</span>
        </p>
        <p>
          Procedural 3D · synthetic inspection & telemetry · deterministic
          explanation · human decision
        </p>
        <a href="#/console">
          Open existing simulation & backend console <ArrowUpRight size={14} />
        </a>
      </footer>
      {evidence && <Evidence close={() => setEvidence(false)} />}
    </div>
  );
}
const tabs = [
  "Overview",
  "Inspection",
  "Equipment",
  "Evidence",
  "Investigation",
  "Review",
  "History",
] as const;
type Tab = (typeof tabs)[number];
export function InteractiveDemo() {
  const [state, dispatch] = useReducer(demoReducer, undefined, () => ({
    ...demoInitial,
    time: clamp(
      Number(new URLSearchParams(location.hash.split("?")[1]).get("t") || 0),
      DURATION,
    ),
  }));
  const [tab, setTab] = useState<Tab>("Overview"),
    [focus, setFocus] = useState("auto"),
    [evidence, setEvidence] = useState<number | null>(null),
    [metric, setMetric] = useState<Metric>("temperature"),
    [note, setNote] = useState("");
  const reduced = useReduced(),
    frame = frameAt(state.time / DURATION),
    latest = state.reviews.at(-1);
  useEffect(() => {
    if (!state.playing) return;
    let raf = 0,
      previous = performance.now();
    const tick = (now: number) => {
      if (!document.hidden)
        dispatch({ type: "tick", value: (now - previous) / 1000 });
      previous = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.playing]);
  useEffect(() => {
    if (reduced) dispatch({ type: "pause" });
  }, [reduced]);
  const seek = (time: number) => dispatch({ type: "seek", value: time });
  const decide = (decision: Decision) => {
    dispatch({ type: "decide", decision, note });
    setNote("");
  };
  return (
    <div className="ex ex-demo">
      <a className="ex-skip" href="#demo-panel">
        Skip to investigation controls
      </a>
      <Header demo />
      <main>
        <div className="ex-demo-heading">
          <div>
            <p className="ex-eyebrow">SCENARIO / THERMAL-DRIFT-001</p>
            <h1>
              From observation to decision<span>.</span>
            </h1>
          </div>
          <span className="ex-sim-badge">
            SIMULATION · NO HARDWARE CONNECTED
          </span>
        </div>
        <div className="ex-workspace">
          <section className="ex-demo-scene" aria-label="Manufacturing cell">
            <Scene
              frame={frame}
              reduced={reduced}
              focus={focus}
              onInspect={() => setEvidence(3)}
            />
            <div className="ex-playback">
              <button
                className="ex-primary"
                onClick={() =>
                  dispatch({ type: state.playing ? "pause" : "play" })
                }
              >
                {state.playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                {state.playing
                  ? "Pause scenario"
                  : state.time === 0
                    ? "Start scenario"
                    : state.time === DURATION
                      ? "Replay scenario"
                      : "Resume scenario"}
              </button>
              <button
                aria-label="Restart scenario"
                onClick={() => {
                  dispatch({ type: "restart" });
                  setTab("Overview");
                  setFocus("auto");
                  setNote("");
                }}
              >
                <RotateCcw size={17} />
              </button>
              <label className="ex-slider-label">
                <input
                  type="range"
                  min="0"
                  max={DURATION}
                  step="0.05"
                  value={state.time}
                  aria-label="Scenario time"
                  onChange={(e) => seek(Number(e.target.value))}
                />
              </label>
              <output
                role="timer"
                aria-live="off"
                aria-label="Scenario elapsed time"
              >
                {state.time.toFixed(1)} / 56s
              </output>
            </div>
            <StageNav frame={frame} seek={seek} />
          </section>
          <section className="ex-panel" id="demo-panel" tabIndex={-1}>
            <nav className="ex-tabs" aria-label="Investigation workspace">
              {tabs.map((name) => (
                <button
                  key={name}
                  aria-pressed={tab === name}
                  onClick={() => setTab(name)}
                >
                  {name}
                </button>
              ))}
            </nav>
            <div className="ex-panel-body">
              {tab === "Overview" && (
                <>
                  <span className="ex-eyebrow">
                    LINE 01 / HANDLING → INSPECTION
                  </span>
                  <h2>{stages[frame.stage].name}</h2>
                  <p>{stages[frame.stage].detail}</p>
                  <div className="ex-state-grid">
                    <div>
                      <small>COMPONENT</small>
                      <strong>P-004</strong>
                    </div>
                    <div>
                      <small>OBSERVATION</small>
                      <strong>{frame.anomaly ? "Flagged" : "Pending"}</strong>
                    </div>
                    <div>
                      <small>PROCESS</small>
                      <strong>{state.playing ? "Running" : "Paused"}</strong>
                    </div>
                    <div>
                      <small>DECISION</small>
                      <strong>{latest?.decision || "Unreviewed"}</strong>
                    </div>
                  </div>
                  <p className="ex-fine">
                    This cell demonstrates one handling cycle. All observations
                    and telemetry are fixed synthetic fixtures.
                  </p>
                  <button
                    className="ex-wide"
                    onClick={() => {
                      seek(28);
                      setTab("Inspection");
                    }}
                  >
                    Go to live inspection view <ChevronRight size={16} />
                  </button>
                  <button
                    className="ex-wide"
                    onClick={() => {
                      seek(44);
                      setTab("Investigation");
                    }}
                  >
                    Open assembled investigation <ChevronRight size={16} />
                  </button>
                </>
              )}
              {tab === "Inspection" && (
                <>
                  <span className="ex-eyebrow">
                    CAM-01 / RENDERED SCENARIO SOURCE
                  </span>
                  <h2>
                    {frame.anomaly
                      ? "Potential anomaly"
                      : frame.detection
                        ? "Inspecting P-004"
                        : "Awaiting component"}
                  </h2>
                  <p>
                    The field of view, tracking boundary and marked region share
                    the component’s 3D coordinates.
                  </p>
                  <dl className="ex-metadata">
                    <dt>Tracking</dt>
                    <dd>
                      {frame.detection
                        ? "P-004 · region locked"
                        : "Not acquired"}
                    </dd>
                    <dt>Processing</dt>
                    <dd>
                      {frame.anomaly
                        ? "Complete · review required"
                        : frame.detection
                          ? `${Math.round(frame.scan * 100)}% fixture inspection`
                          : "Waiting for transport"}
                    </dd>
                    <dt>Inference source</dt>
                    <dd>Synthetic fixture · no live model</dd>
                  </dl>
                  <button
                    className="ex-wide"
                    onClick={() => seek(frame.anomaly ? 28 : 32)}
                  >
                    {frame.anomaly
                      ? "Rewind inspection"
                      : "Advance to captured observation"}
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="ex-wide"
                    disabled={!frame.anomaly}
                    onClick={() => setEvidence(3)}
                  >
                    Open detected region <ScanLine size={16} />
                  </button>
                </>
              )}
              {tab === "Equipment" && (
                <>
                  <span className="ex-eyebrow">EQUIPMENT DETAIL</span>
                  <h2>
                    {focus === "robot"
                      ? "Handling manipulator"
                      : focus === "camera"
                        ? "Inspection camera"
                        : focus === "motor"
                          ? "Conveyor drive"
                          : "Production cell"}
                  </h2>
                  <div className="ex-equipment">
                    {[
                      ["auto", "Whole cell"],
                      ["robot", "Robot"],
                      ["camera", "Camera"],
                      ["motor", "Drive motor"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={focus === id}
                        onClick={() => setFocus(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p>
                    {focus === "robot"
                      ? "Two-link inverse kinematics positions the tool. The gripper holds the flange through lift and transfer. The wrist keeps the component level."
                      : focus === "camera"
                        ? "CAM-01 looks vertically onto the flange. Tracking activates at T+28s; the fixed anomaly becomes available at T+32s."
                        : "Synthetic drive telemetry provides context for inspection. These are not measurements of the rendered equipment."}
                  </p>
                  <label className="ex-field">
                    Sensor metric
                    <select
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as Metric)}
                    >
                      {Object.entries(metrics).map(([id, m]) => (
                        <option key={id} value={id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ex-reading">
                    {frame.sensors[metric].toFixed(2)}
                    <span>{metrics[metric].unit}</span>
                  </div>
                  <SignalChart metric={metric} time={state.time} />
                  <p className="ex-fine">
                    Illustrative threshold: {metrics[metric].threshold}{" "}
                    {metrics[metric].unit}. Current time: T+
                    {state.time.toFixed(1)}s.
                  </p>
                </>
              )}
              {tab === "Evidence" && (
                <>
                  <span className="ex-eyebrow">TRACEABLE CAPTURES</span>
                  <h2>Detection evidence</h2>
                  <p>
                    Earlier fixture observations provide a reference. Select a
                    capture to inspect its metadata and surface reconstruction.
                  </p>
                  <div className="ex-captures">
                    {inspections
                      .filter((e) => e.time <= state.time)
                      .map((e, i) => (
                        <button key={e.id} onClick={() => setEvidence(i)}>
                          <span className={e.flagged ? "ex-orange" : ""}>
                            {e.flagged ? "△" : "○"} {e.productId}
                          </span>
                          <span>
                            T+{e.time}s ·{" "}
                            {e.flagged ? "Review required" : "Below threshold"}
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                  </div>
                  {state.time < 8 && (
                    <p>
                      No captures yet. Start the scenario or advance to
                      inspection.
                    </p>
                  )}
                  <button
                    className="ex-wide"
                    onClick={() => {
                      seek(32);
                      setEvidence(3);
                    }}
                  >
                    Inspect P-004 anomaly <ScanLine size={16} />
                  </button>
                </>
              )}
              {tab === "Investigation" && (
                <>
                  <span className="ex-eyebrow">
                    AI WORKFLOW / DETERMINISTIC EXPLANATION
                  </span>
                  <h2>An explanation you can trace.</h2>
                  {state.time < 44 ? (
                    <>
                      <p>
                        The investigation becomes available after the visual
                        event and sensor context are assembled.
                      </p>
                      <button onClick={() => seek(44)}>
                        Assemble evidence at T+44s
                      </button>
                    </>
                  ) : (
                    <>
                      <Reasoning />
                      <button
                        className="ex-wide"
                        onClick={() => {
                          seek(50);
                          setTab("Review");
                        }}
                      >
                        Continue to operator review <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </>
              )}
              {tab === "Review" && (
                <>
                  <span className="ex-eyebrow">
                    HUMAN DECISION / LOCAL DEMO ONLY
                  </span>
                  <h2>Engineering review</h2>
                  {state.time < 50 ? (
                    <>
                      <p>
                        Review follows evidence assembly. Advance the scenario
                        to inspect the complete context.
                      </p>
                      <button onClick={() => seek(50)}>
                        Prepare review at T+50s
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        Confirm that the observation merits follow-up, reject
                        it, or request another inspection. A decision does not
                        establish its cause.
                      </p>
                      <button
                        className="ex-wide"
                        onClick={() => setEvidence(3)}
                      >
                        Review visual evidence <ScanLine size={16} />
                      </button>
                      <label className="ex-field">
                        Engineering note (optional)
                        <textarea
                          maxLength={500}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Record your reasoning…"
                        />
                      </label>
                      <div className="ex-review-actions">
                        <button onClick={() => decide("confirmed")}>
                          Confirm finding
                        </button>
                        <button onClick={() => decide("rejected")}>
                          Reject finding
                        </button>
                        <button onClick={() => decide("reinspect")}>
                          Request additional inspection
                        </button>
                      </div>
                      {latest && (
                        <div
                          role="status"
                          aria-label="Operator review outcome"
                          className="ex-resolution"
                        >
                          <strong>
                            {latest.decision === "confirmed"
                              ? "Finding confirmed for engineering follow-up"
                              : latest.decision === "rejected"
                                ? "Finding rejected by operator"
                                : "Additional inspection requested"}
                          </strong>
                          <p>{latest.note || "No note provided."}</p>
                          <small>
                            Recorded in this demo session. No work order or
                            external action was created.
                          </small>
                          <button onClick={() => setTab("History")}>
                            View recorded outcome →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {tab === "History" && (
                <>
                  <span className="ex-eyebrow">
                    EVENT HISTORY / CURRENT SESSION
                  </span>
                  <h2>Every step, in context.</h2>
                  <ol className="ex-history">
                    {stages
                      .filter((s) => s.time <= state.time)
                      .map((s) => (
                        <li key={s.time}>
                          <span>T+{s.time.toString().padStart(2, "0")}</span>
                          <button onClick={() => seek(s.time)}>{s.name}</button>
                        </li>
                      ))}
                    {state.reviews.map((r) => (
                      <li key={r.id}>
                        <span>
                          #{r.id} / +{r.time.toFixed(1)}s
                        </span>
                        <div>
                          <strong>Operator: {r.decision}</strong>
                          <p>{r.note || "No note provided"}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="ex-fine">
                    Review history is retained when seeking; Restart clears the
                    session. Decisions do not modify the simulation fixture.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
        <div className="ex-demo-bottom">
          <span>
            <span className="ex-dot" />{" "}
            {frame.anomaly ? "P-004 · REVIEW REQUIRED" : "CELL READY"} /{" "}
            {latest
              ? `LAST REVIEW: ${latest.decision.toUpperCase()}`
              : "OPERATOR RESPONSIBLE FOR FINAL DECISION"}
          </span>
          <a href="#/console">
            Existing simulation & backend console <ArrowUpRight size={14} />
          </a>
        </div>
      </main>
      {evidence !== null && (
        <Evidence eventIndex={evidence} close={() => setEvidence(null)} />
      )}
    </div>
  );
}
