import { lazy, Suspense, useEffect, useReducer, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Crosshair,
  Shield,
  Camera,
  Thermometer,
  Activity,
  Zap,
  Monitor,
  Box,
  Github,
  X,
} from "lucide-react";
import {
  initialState,
  reducer,
  inspections,
  phaseAt,
  clockLabel,
  DURATION,
  type Equipment,
  type Metric,
} from "./simulation/engine";
import { scenes } from "./simulation/scenes";
import { StoryPanel } from "./components/Panels";
import { Telemetry } from "./components/Telemetry";
import LivePanel from "./components/LivePanel";
const Factory = lazy(() => import("./components/Factory"));
const equipment: { id: Equipment; label: string; icon: typeof Camera }[] = [
  { id: "conveyor", label: "Conveyor", icon: Box },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "temperature", label: "Temperature", icon: Thermometer },
  { id: "vibration", label: "Vibration", icon: Activity },
  { id: "motor", label: "Motor", icon: Zap },
  { id: "control", label: "Control", icon: Monitor },
];
export default function App() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    status: reduced ? "idle" : "playing",
  });
  const [scene, setScene] = useState(0),
    [focus, setFocus] = useState<Equipment>("overview"),
    [cameraKey, setCameraKey] = useState(0),
    [selected, setSelected] = useState("P-001"),
    [metric, setMetric] = useState<Metric>("temperature"),
    [presentation, setPresentation] = useState(false),
    [autoguide, setAutoguide] = useState(false),
    [backend, setBackend] = useState(false),
    [team, setTeam] = useState(false),
    [notice, setNotice] = useState(""),
    [visible, setVisible] = useState(!document.hidden);
  const event =
    inspections.find((e) => e.productId === selected) ?? inspections[0];
  const story = scenes[scene];
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(query.matches);
      if (query.matches) dispatch({ type: "seek", value: 0 });
    };
    query.addEventListener("change", change);
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      query.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (state.status !== "playing" || !visible || backend) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", delta: (now - previous) / 1000 });
      previous = now;
    }, 50);
    return () => clearInterval(timer);
  }, [state.status, visible, backend]);
  useEffect(() => {
    if (!autoguide || presentation) return;
    const next =
      state.time >= 50
        ? 6
        : state.time >= 44
          ? 5
          : state.time >= 38
            ? 4
            : state.time >= 35
              ? 3
              : state.time >= 32
                ? 2
                : 1;
    setScene(next);
    setFocus(scenes[next].focus);
    if (state.time >= 32) setSelected("P-004");
  }, [Math.floor(state.time), autoguide, presentation]);
  function go(next: number) {
    const n = Math.max(0, Math.min(8, next));
    setAutoguide(false);
    setScene(n);
    setFocus(scenes[n].focus);
    dispatch({ type: "seek", value: scenes[n].time });
    setSelected(n >= 2 && n <= 7 ? "P-004" : "P-001");
    setCameraKey((k) => k + 1);
  }
  function start() {
    setAutoguide(!presentation);
    setScene(1);
    setFocus("conveyor");
    setSelected("P-001");
    dispatch({ type: "start" });
  }
  function seek(value: number) {
    setAutoguide(false);
    dispatch({ type: "seek", value });
  }
  function product(id: string) {
    const item = inspections.find((e) => e.productId === id);
    if (!item) return;
    setAutoguide(false);
    setSelected(id);
    dispatch({ type: "seek", value: item.time });
    setScene(2);
    setFocus("camera");
  }
  function selectEquipment(id: Equipment) {
    setAutoguide(false);
    setFocus(id);
    setCameraKey((k) => k + 1);
    if (id === "temperature" || id === "vibration" || id === "motor") {
      setScene(3);
      setMetric(id === "motor" ? "current" : id);
    }
    if (id === "camera") setScene(2);
    if (id === "control") {
      setScene(5);
    }
    if (id === "conveyor") setScene(1);
  }
  function reset() {
    setAutoguide(false);
    dispatch({ type: "reset" });
    setScene(0);
    setSelected("P-001");
    setFocus("overview");
    setCameraKey((k) => k + 1);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Fullscreen is unavailable in this browser. Presentation controls remain available.",
      );
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (backend || team || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        setPresentation(false);
        return;
      }
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (
        e.code === "Space" &&
        ["BUTTON", "A", "SUMMARY"].includes((e.target as HTMLElement).tagName)
      )
        return;
      if (!presentation) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(scene + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(scene - 1);
      }
      if (e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "toggle" });
      }
      if (e.key.toLowerCase() === "r") {
        go(scene);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <div className={`app scene-${scene}${presentation ? " presentation" : ""}`}>
      <a href="#experience" className="skip-link">
        Skip to investigation
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={reset}
          aria-label="Visual Factory Guardian home"
        >
          <span className="brand-mark">
            <Shield size={23} />
          </span>
          <span>
            VISUAL FACTORY
            <span className="brand-sub">
              GUARDIAN<span className="brand-period">.</span>
            </span>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            onClick={() => go(0)}
            className={scene === 0 ? "nav-active" : ""}
          >
            Overview
          </button>
          <button
            onClick={() => go(2)}
            className={scene >= 2 && scene <= 4 ? "nav-active" : ""}
          >
            Technology
          </button>
          <button
            onClick={() => go(5)}
            className={scene === 5 || scene === 6 ? "nav-active" : ""}
          >
            Investigation
          </button>
          <button
            onClick={() => go(7)}
            className={scene === 7 ? "nav-active" : ""}
          >
            AMD
          </button>
          <button onClick={() => setTeam(true)}>Project</button>
        </nav>
        <div className="header-actions">
          <button
            className="presentation-button"
            onClick={() => {
              setPresentation(!presentation);
              setAutoguide(false);
            }}
          >
            {presentation ? <Minimize size={15} /> : <Maximize size={15} />}
            <span>
              {presentation ? "Exit presentation" : "Presentation mode"}
            </span>
          </button>
          <a
            className="github-button"
            href="https://github.com/RafalW3bCraft/Visual-factory-Guardian"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
          >
            <Github size={19} />
          </a>
        </div>
      </header>
      <main id="experience">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="accent-line" />
              {story.eyebrow}
            </div>
            <h1>{story.title}</h1>
          </div>
          <div className="intro-description">
            <p>{story.description}</p>
            <span className="hackathon-label">
              AMD DEVELOPER HACKATHON <span>ACT III / 2026</span>
            </span>
          </div>
        </section>
        <div className="experience-shell">
          <div className="experience-bar">
            <div className="status">
              <span className="dot green" />
              <strong>GUIDED SIMULATION</strong>
              <span className="bar-divider" />
              <span>LINE 01</span>
            </div>
            <button className="backend-status" onClick={() => setBackend(true)}>
              <span className="dot muted" />
              Backend not verified <ArrowUpRight size={13} />
            </button>
          </div>
          <nav className="scene-tabs" aria-label="Story scenes">
            {scenes.map((s, i) => (
              <button
                key={s.name}
                className={scene === i ? "active" : ""}
                aria-current={scene === i ? "step" : undefined}
                onClick={() => go(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {s.name}
              </button>
            ))}
          </nav>
          <div className="stage">
            <section
              className="factory-viewport"
              aria-label="Factory visualization"
            >
              <div className="viewport-caption">
                <span className="eyebrow">
                  THERMAL DRIFT / DIGITAL DEMONSTRATOR
                </span>
                <span className="live-state">
                  <span
                    className={`dot ${state.time >= 32 ? "amber" : "green"}`}
                  />
                  {state.status === "paused"
                    ? "Paused"
                    : state.status === "idle"
                      ? "Ready"
                      : state.time >= 32
                        ? "Investigation available"
                        : "Line operating"}
                </span>
              </div>
              <Suspense
                fallback={
                  <div className="scene-loading">
                    <span />
                    Assembling the factory…
                  </div>
                }
              >
                <Factory
                  state={state}
                  focus={focus}
                  cameraKey={cameraKey}
                  selected={selected}
                  onFocus={selectEquipment}
                  onProduct={product}
                  reduced={reduced}
                  visible={visible && !backend}
                />
              </Suspense>
              <div className="viewport-footer">
                <span>
                  <span className="axis">↗</span> Drag to orbit · scroll to zoom
                </span>
                <button
                  onClick={() => {
                    setFocus("overview");
                    setCameraKey((k) => k + 1);
                  }}
                >
                  <Crosshair size={14} />
                  Reset view
                </button>
              </div>
              <div
                className="equipment-controls"
                aria-label="Equipment controls"
              >
                {equipment.map((e) => (
                  <button
                    key={e.id}
                    className={focus === e.id ? "active" : ""}
                    aria-label={`Inspect ${e.label}`}
                    aria-pressed={focus === e.id}
                    onClick={() => selectEquipment(e.id)}
                  >
                    <e.icon size={16} />
                    <span>{e.label}</span>
                  </button>
                ))}
              </div>
            </section>
            <aside className="story-panel" aria-label="Investigation workspace">
              <StoryPanel
                metric={metric}
                scene={scene}
                state={state}
                event={event}
                onEvent={product}
                onScene={go}
                onFocus={selectEquipment}
                onSeek={(time) => {
                  seek(time);
                  setSelected(time < 32 ? "P-001" : "P-004");
                  setFocus(time === 18 ? "temperature" : "camera");
                }}
                onReview={() => dispatch({ type: "review" })}
                onStart={start}
                onBackend={() => setBackend(true)}
              />
            </aside>
          </div>
          <div className="transport">
            <div className="playback-buttons">
              <button
                className="play-button"
                aria-label={
                  state.status === "playing"
                    ? "Pause scenario"
                    : "Play scenario"
                }
                onClick={() => dispatch({ type: "toggle" })}
              >
                {state.status === "playing" ? (
                  <Pause size={16} />
                ) : (
                  <Play size={16} />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Restart demo"
                onClick={reset}
              >
                <RotateCcw size={16} />
              </button>
              <span className="clock">
                {clockLabel(state.time)}
                <span> / 00:56</span>
              </span>
            </div>
            <div className="scrubber">
              <input
                type="range"
                aria-label="Scenario time"
                min="0"
                max={DURATION}
                step=".1"
                value={state.time}
                onChange={(e) => seek(Number(e.target.value))}
              />
              <div>
                <span>Normal operation</span>
                <span>Thermal drift</span>
                <span>Inspection</span>
                <span>Investigation</span>
              </div>
            </div>
            <label className="speed-label">
              <span>Speed</span>
              <select
                aria-label="Playback speed"
                value={state.speed}
                onChange={(e) =>
                  dispatch({ type: "speed", value: Number(e.target.value) })
                }
              >
                <option value=".5">0.5×</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
            </label>
            <button className="skip-button" onClick={() => go(5)}>
              Skip to evidence <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <Telemetry
          time={state.time}
          metric={metric}
          event={event}
          onSelect={(m) => {
            setMetric(m);
            selectEquipment(m === "current" ? "motor" : m);
          }}
          onSeek={seek}
        />
        <div className="narrative-footer">
          <div className="narrative-progress">
            <span>
              {String(scene + 1).padStart(2, "0")}
              <small> / 09</small>
            </span>
            <span>
              {story.name}
              <small>
                {presentation
                  ? "← → Navigate · Space Pause · R Replay · Esc Exit"
                  : "An observed anomaly. A connected investigation."}
              </small>
            </span>
          </div>
          <div className="button-row">
            {presentation && (
              <>
                <button onClick={() => go(scene)}>
                  <RotateCcw size={14} />
                  Replay scene
                </button>
                <button onClick={reset}>Restart presentation</button>
                <button
                  className="icon-button"
                  aria-label="Toggle fullscreen"
                  onClick={fullscreen}
                >
                  <Maximize size={16} />
                </button>
              </>
            )}
            <button
              className="icon-button"
              aria-label="Previous scene"
              disabled={scene === 0}
              onClick={() => go(scene - 1)}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="next-button"
              disabled={scene === 8}
              onClick={() => go(scene + 1)}
            >
              Next scene <ArrowRight size={16} />
            </button>
          </div>
        </div>
        {notice && (
          <p role="status" className="notice">
            {notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
              <X size={14} />
            </button>
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {state.status === "paused" ? "Paused. " : ""}
          {phaseAt(state.time).replaceAll("_", " ")}. Selected product{" "}
          {selected}. All evidence is simulated.
        </p>
      </main>
      <footer className="site-footer">
        <span>
          VISUAL FACTORY GUARDIAN <span className="footer-slash">/</span>{" "}
          Evidence-driven industrial AI
        </span>
        <span>Prototype · Synthetic data · Human verification required</span>
        <a
          href="https://github.com/RafalW3bCraft/Visual-factory-Guardian"
          target="_blank"
          rel="noreferrer"
        >
          View source <ArrowUpRight size={12} />
        </a>
      </footer>
      <LivePanel open={backend} onClose={() => setBackend(false)} />
      {team && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-title"
            className="live-dialog"
            onKeyDown={(e) => {
              if (e.key === "Escape") setTeam(false);
              if (e.key === "Tab") {
                e.preventDefault();
                (
                  e.currentTarget.querySelector("button") as HTMLButtonElement
                )?.focus();
              }
            }}
          >
            <div className="panel-heading">
              <h2 id="project-title">A focused industrial AI prototype.</h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close project panel"
                onClick={() => setTeam(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              Visual Factory Guardian explores how visual anomalies, telemetry,
              and evidence can support operator investigation.
            </p>
            <dl className="facts">
              <div>
                <dt>Devid</dt>
                <dd>Full-stack / integration</dd>
              </div>
              <div>
                <dt>Arshad</dt>
                <dd>AI / root-cause analysis</dd>
              </div>
              <div>
                <dt>Rafal</dt>
                <dd>Computer vision</dd>
              </div>
              <div>
                <dt>Member 4</dt>
                <dd>Sensor simulation / data</dd>
              </div>
            </dl>
            <p className="fineprint">
              Proposed team responsibilities from the repository README. This
              browser demonstration uses original procedural geometry and
              synthetic fixtures. Dataset, backend, manual retrieval, and AMD
              inference remain team integration work.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
