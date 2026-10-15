import {
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  ShieldCheck,
  Cpu,
  Layers,
  ScanLine,
  Activity,
} from "lucide-react";
import {
  clockLabel,
  evidenceFor,
  metrics,
  milestones,
  reading,
  timestamp,
  type Metric,
  type Equipment,
  type Inspection,
  type Simulation,
} from "../simulation/engine";
type Props = {
  scene: number;
  metric: Metric;
  state: Simulation;
  event: Inspection;
  onEvent: (id: string) => void;
  onScene: (scene: number) => void;
  onFocus: (e: Equipment) => void;
  onSeek: (t: number) => void;
  onReview: () => void;
  onStart: () => void;
  onBackend: () => void;
};
export function PartIllustration({ flagged = false }: { flagged?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 160"
      role="img"
      aria-label={
        flagged
          ? "Synthetic metal flange illustration with a surface scratch"
          : "Synthetic normal metal flange illustration"
      }
    >
      <defs>
        <radialGradient id={flagged ? "metal-a" : "metal-n"}>
          <stop stopColor="#d4dcdf" />
          <stop offset=".7" stopColor="#83949e" />
          <stop offset="1" stopColor="#344752" />
        </radialGradient>
        <pattern
          id={flagged ? "grid-a" : "grid-n"}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path d="M16 0H0V16" fill="none" stroke="#435660" strokeWidth=".4" />
        </pattern>
      </defs>
      <rect width="220" height="160" fill="#15212a" />
      <rect
        width="220"
        height="160"
        fill={`url(#${flagged ? "grid-a" : "grid-n"})`}
      />
      <ellipse cx="110" cy="114" rx="58" ry="14" fill="#080f15" opacity=".7" />
      <circle
        cx="110"
        cy="79"
        r="54"
        fill={`url(#${flagged ? "metal-a" : "metal-n"})`}
        stroke="#b2c0c8"
        strokeWidth="2"
      />
      <circle
        cx="110"
        cy="79"
        r="37"
        fill="none"
        stroke="#647c88"
        strokeWidth="1"
      />
      <circle
        cx="110"
        cy="79"
        r="24"
        fill="#16232c"
        stroke="#c7d1d3"
        strokeWidth="5"
      />
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          cx={110 + 42 * Math.cos((i * Math.PI) / 2 + 0.7)}
          cy={79 + 42 * Math.sin((i * Math.PI) / 2 + 0.7)}
          r="4"
          fill="#263b46"
          stroke="#b9c4c8"
        />
      ))}
      {flagged && (
        <path
          d="m134 43-7 10 6 7-8 10"
          fill="none"
          stroke="#293c47"
          strokeWidth="3"
        />
      )}
      <path
        d="M12 30V12h18m160 0h18v18M12 130v18h18m160 0h18v-18"
        fill="none"
        stroke="#79949f"
        strokeWidth="1"
      />
      <text x="12" y="143" fill="#a9bbc5" fontSize="8" fontFamily="monospace">
        ILLUSTRATION · NOT MODEL OUTPUT
      </text>
    </svg>
  );
}
function InspectionPanel({
  event,
  state,
  onEvent,
}: Pick<Props, "event" | "state" | "onEvent">) {
  const occurred = state.time >= event.time;
  return (
    <>
      <div className="panel-heading">
        <Camera size={18} />
        <h3>Inspection evidence</h3>
        <span className="small-tag">FIXTURE</span>
      </div>
      <div className="comparison">
        <button
          onClick={() => onEvent("P-001")}
          aria-pressed={event.productId === "P-001"}
        >
          <PartIllustration />
          <span>
            <i className="dot green" />
            Normal · P-001
          </span>
        </button>
        <button
          onClick={() => onEvent("P-004")}
          aria-pressed={event.productId === "P-004"}
        >
          <PartIllustration flagged />
          <span>
            <i className="dot amber" />
            Flagged · P-004
          </span>
        </button>
      </div>
      <div className={`inspection-result ${event.flagged ? "warning" : ""}`}>
        <ScanLine size={19} />
        <div>
          <strong>
            {!occurred
              ? "Awaiting inspection"
              : event.flagged
                ? "Flagged for review"
                : "Within fixture threshold"}
          </strong>
          <span>
            {event.productId} · {event.id}
          </span>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>Anomaly score</dt>
          <dd>{occurred ? event.score.toFixed(2) : "Pending"}</dd>
        </div>
        <div>
          <dt>Illustrative threshold</dt>
          <dd>0.65</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>Synthetic fixture</dd>
        </div>
        <div>
          <dt>Inspection time</dt>
          <dd>{timestamp(event.time).slice(11, 19)} UTC</dd>
        </div>
        <div>
          <dt>Localization</dt>
          <dd>Not available</dd>
        </div>
      </dl>
      <p className="fineprint">
        Original product illustrations and synthetic scores. No CV model was
        run. Scores are not calibrated probabilities.
      </p>
    </>
  );
}
function Evidence({ event, onFocus }: Pick<Props, "event" | "onFocus">) {
  const e = evidenceFor(event);
  return (
    <>
      <div className="panel-heading">
        <Layers size={18} />
        <h3>Evidence ledger</h3>
        <span className="small-tag">{event.id}</span>
      </div>
      <details open>
        <summary>
          <span className="evidence-id">E01</span>Visual observation
        </summary>
        <p>
          {event.productId} {event.flagged ? "exceeds" : "is below"} the
          illustrative inspection threshold: {event.score.toFixed(2)} / 0.65.
          Synthetic fixture; no model inference.
        </p>
      </details>
      <details open>
        <summary>
          <span className="evidence-id">E02</span>Temperature deviation
        </summary>
        <p>
          {e.observed.toFixed(1)} °C at inspection versus a{" "}
          {e.baseline.toFixed(1)} °C baseline (mean of 00:00–00:17). Deviation:{" "}
          {e.delta > 0 ? "+" : ""}
          {e.delta.toFixed(1)} °C.
        </p>
        <button className="text-button" onClick={() => onFocus("temperature")}>
          Locate temperature sensor <ArrowUpRight size={14} />
        </button>
      </details>
      <details>
        <summary>
          <span className="evidence-id">E03</span>Temporal relationship
        </summary>
        <p>
          {e.hasDrift
            ? `Drift begins at 00:18, ${e.leadSeconds} seconds before this inspection. The sequence is intentionally simulated and does not establish causation.`
            : "This inspection precedes the injected thermal drift. No preceding thermal deviation supports this event."}
        </p>
      </details>
      <div className="candidate">
        <span className="eyebrow">
          {event.flagged
            ? "CANDIDATE CONTRIBUTING FACTOR"
            : "NO FLAGGED ANOMALY"}
        </span>
        <h4>
          {event.flagged
            ? "Thermal process instability"
            : "No investigation candidate"}
        </h4>
        <p>
          {event.flagged
            ? "E01 + E02 + E03 support checking the thermal subsystem. Sensor calibration error remains an alternative explanation."
            : "The selected product has a normal fixture inspection. Select P-004 to explore the anomaly evidence."}
        </p>
        <span className="uncertainty">
          {event.flagged
            ? "Hypothesis · causality unverified"
            : "Do not infer a fault from this record"}
        </span>
      </div>
      <p className="fineprint">
        Deterministic demo explanation, derived from fixture evidence. No LLM or
        retrieval service is connected.
      </p>
    </>
  );
}
export function StoryPanel(props: Props) {
  const {
    scene,
    state,
    event,
    metric,
    onScene,
    onFocus,
    onSeek,
    onReview,
    onStart,
    onBackend,
  } = props;
  if (scene === 2) return <InspectionPanel {...props} />;
  if (scene === 5) return <Evidence {...props} />;
  if (scene === 3)
    return (
      <>
        <div className="panel-heading">
          <Activity size={18} />
          <h3>Signals in context</h3>
        </div>
        <span className="source-label">SIMULATED TELEMETRY</span>
        <h4 className="panel-title">A rise before the flag.</h4>
        <p>
          Temperature drifts upward at 00:18. The flagged inspection follows at
          00:32.
        </p>
        <div className="big-reading">
          {reading(metric, state.time).toFixed(1)}
          <small>{metrics[metric].unit}</small>
        </div>
        <dl className="facts">
          <div>
            <dt>{metrics[metric].label} baseline</dt>
            <dd>
              {metrics[metric].baseline} {metrics[metric].unit}
            </dd>
          </div>
          <div>
            <dt>Illustrative threshold</dt>
            <dd>
              {metrics[metric].threshold} {metrics[metric].unit}
            </dd>
          </div>
          <div>
            <dt>Selected window</dt>
            <dd>{evidenceFor(event).window.map(clockLabel).join(" – ")}</dd>
          </div>
          <div>
            <dt>Sampling interval</dt>
            <dd>1 second</dd>
          </div>
        </dl>
        <p>
          Use the time scrubber or select a chart to inspect a reading and
          locate its sensor.
        </p>
        <button className="wide-button" onClick={() => onScene(4)}>
          Connect the events <ChevronRight size={16} />
        </button>
      </>
    );
  if (scene === 4)
    return (
      <>
        <div className="panel-heading">
          <Layers size={18} />
          <h3>Event chronology</h3>
        </div>
        <p>One scenario. One shared clock.</p>
        <ol className="event-list">
          {milestones.map((m) => (
            <li key={m.time} className={state.time >= m.time ? "reached" : ""}>
              <button onClick={() => onSeek(m.time)}>
                <time>{clockLabel(m.time)}</time>
                <div>
                  <strong>{m.title}</strong>
                  <span>{m.detail}</span>
                </div>
                <ChevronRight size={14} />
              </button>
            </li>
          ))}
        </ol>
        <p className="fineprint">
          Select an event to move the factory and telemetry to that moment. This
          designed temporal sequence is not causal proof.
        </p>
        <button className="wide-button" onClick={() => onScene(5)}>
          Open investigation <ChevronRight size={16} />
        </button>
      </>
    );
  if (scene === 6)
    return (
      <>
        <div className="panel-heading">
          <ShieldCheck size={18} />
          <h3>Operator decision</h3>
        </div>
        <div className="review-icon">
          <ShieldCheck size={34} />
        </div>
        <h4 className="panel-title">Verify before you act.</h4>
        <p>
          For this demo, inspect the thermal subsystem and verify the
          temperature sensor against the equipment’s approved maintenance
          procedure.
        </p>
        <div className="notice">
          <FileText size={18} />
          <div>
            <strong>No manual supplied</strong>
            <p>
              No technical citation is available. This illustrative
              recommendation is not a validated maintenance instruction.
            </p>
          </div>
        </div>
        <dl className="facts">
          <div>
            <dt>Evidence</dt>
            <dd>E01 · E02 · E03</dd>
          </div>
          <div>
            <dt>Review status</dt>
            <dd>
              {state.reviewed ? "Reviewed in demo" : "Awaiting human review"}
            </dd>
          </div>
        </dl>
        <button
          className="primary wide-button"
          disabled={state.reviewed || state.time < 44}
          onClick={onReview}
        >
          {state.reviewed ? <Check size={16} /> : <ShieldCheck size={16} />}{" "}
          {state.reviewed
            ? "Demo review recorded"
            : "Mark demo inspection reviewed"}
        </button>
        <p className="fineprint">
          Local demo state only. No machine command or maintenance record is
          sent.
        </p>
      </>
    );
  if (scene === 7)
    return (
      <>
        <div className="panel-heading">
          <Cpu size={18} />
          <h3>Compute architecture</h3>
        </div>
        <div className="amd-title">
          AMD{" "}
          <span>
            DEVELOPER
            <br />
            HACKATHON · ACT III
          </span>
        </div>
        <div className="architecture">
          {[
            ["01", "Browser", "React · Three.js · WebGL", "Implemented"],
            [
              "02",
              "Application",
              "Scenario state · typed API adapter",
              "Implemented",
            ],
            [
              "03",
              "Analysis",
              "Vision → telemetry → evidence → explanation",
              "Backend planned",
            ],
            ["04", "Compute", "AMD GPU · ROCm · PyTorch", "Evaluation pending"],
          ].map(([n, title, description, status]) => (
            <div key={n}>
              <span>{n}</span>
              <section>
                <strong>{title}</strong>
                <p>{description}</p>
                <small>{status}</small>
              </section>
            </div>
          ))}
        </div>
        <p className="fineprint">
          Browser WebGL is separate from ROCm inference. No AMD workload, model
          accuracy, latency or throughput has been measured.
        </p>
      </>
    );
  if (scene === 8)
    return (
      <>
        <div className="panel-heading">
          <ScanLine size={18} />
          <h3>Explore the prototype</h3>
        </div>
        <h4 className="panel-title">Your line of inquiry.</h4>
        <p>
          One thermal drift. Six products. Every signal connected to a
          reproducible scenario.
        </p>
        <button className="primary wide-button" onClick={onStart}>
          Replay guided investigation <ChevronRight size={16} />
        </button>
        <button className="wide-button" onClick={onBackend}>
          Check live backend <ArrowUpRight size={16} />
        </button>
        <div className="notice">
          <CircleAlert size={18} />
          <p>
            Guided Demo is fully synthetic. Live Analysis becomes available only
            after the configured service passes its readiness check.
          </p>
        </div>
        <a
          className="text-button"
          href="https://github.com/RafalW3bCraft/Visual-factory-Guardian"
          target="_blank"
          rel="noreferrer"
        >
          Explore the GitHub project <ArrowUpRight size={14} />
        </a>
      </>
    );
  if (scene === 1)
    return (
      <>
        <div className="panel-heading">
          <Camera size={18} />
          <h3>Beyond the inspection</h3>
        </div>
        <PartIllustration flagged={state.time >= 32} />
        <h4 className="panel-title">A flag is a starting point.</h4>
        <p>
          The same production line can leave behind separate image records,
          sensor logs, and operator notes. Bring them into one investigation.
        </p>
        <div className="sequence">
          <span>01 Detect</span>
          <ChevronRight size={14} />
          <span>02 Connect</span>
          <ChevronRight size={14} />
          <span>03 Investigate</span>
        </div>
        <button className="wide-button" onClick={() => onScene(2)}>
          Inspect the product <ChevronRight size={16} />
        </button>
        <p className="fineprint">
          A synthetic product illustration is shown. No real factory or image
          dataset is connected.
        </p>
      </>
    );
  return (
    <>
      <div className="panel-heading">
        <span className="dot green" />
        <h3>Production line 01</h3>
        <span className="small-tag">DEMO</span>
      </div>
      <div className="overview-id">THERMAL PROCESSING CELL</div>
      <h4 className="panel-title">
        From a signal
        <br />
        to a next step.
      </h4>
      <p>
        Follow a component through inspection. Look inside the machine. Build an
        investigation from connected evidence.
      </p>
      <div className="scenario-note">
        <span className="eyebrow">FEATURED SCENARIO</span>
        <strong>Thermal drift investigation</strong>
        <span>56-second simulation · manually paced story</span>
      </div>
      <button className="primary wide-button" onClick={onStart}>
        Launch investigation <ChevronRight size={16} />
      </button>
      <button className="wide-button" onClick={() => onFocus("conveyor")}>
        Explore the factory <ArrowUpRight size={16} />
      </button>
      <div className="panel-bottom">
        <ShieldCheck size={16} />
        <span>Evidence first. Human judgment always.</span>
      </div>
    </>
  );
}
