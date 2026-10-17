import { lazy, Suspense, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { chapterNames, storyState, type StoryClock } from "./director";
import {
  evidenceFor,
  inspections,
  reading,
  metrics,
  type Metric,
} from "../simulation/engine";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "./global.css";
import "./cinematic.css";
const Stage = lazy(() => import("./Stage"));
gsap.registerPlugin(ScrollTrigger);
const repo = "https://github.com/RafalW3bCraft/Visual-factory-Guardian";
const evidence = evidenceFor(inspections[3]);
const headlines = [
  ["EVERY DEFECT", "HAS A STORY."],
  ["ONE PRODUCT.", "ONE ANOMALY."],
  ["SEE WHAT", "OTHERS MISS."],
  ["BUT WHAT", "CHANGED?"],
  ["CONNECT", "THE SIGNALS."],
  ["FROM DATA", "TO DIRECTION."],
  ["SEE THE DEFECT.", "UNDERSTAND THE SIGNALS.", "INVESTIGATE THE CAUSE."],
];
const intros = [
  "A surface tells you what happened. The signals around it help you ask why.",
  "Follow P-004. A surface fracture interrupts an otherwise ordinary journey along the line.",
  "The inspection is a starting point. A flagged region asks for a closer look.",
  "Look beyond the surface. Open the machine and examine what changed around the event.",
  "One inspection. Three sensor histories. A shared timeline for a better question.",
  "Evidence narrows the next step. It does not turn a hypothesis into a proven cause.",
  "Visual Factory Guardian combines computer vision, machine telemetry, and evidence-grounded AI to support industrial investigation.",
];
function Signal({ metric }: { metric: Metric }) {
  const meta = metrics[metric],
    samples = Array.from({ length: 57 }, (_, t) => reading(metric, t));
  const y = (v: number) =>
    54 - ((v - meta.range[0]) / (meta.range[1] - meta.range[0])) * 48;
  return (
    <div className="cinema-signal">
      <div>
        <span>{meta.label}</span>
        <span>
          {reading(metric, 32).toFixed(2)} <small>{meta.unit}</small>
        </span>
      </div>
      <svg
        viewBox="0 0 280 64"
        role="img"
        aria-label={`${meta.label}: simulated baseline and deviation; inspection at 32 seconds`}
      >
        <path
          d={`M0 ${y(meta.baseline)}H280`}
          stroke="currentColor"
          opacity=".4"
          strokeDasharray="3 4"
        />
        <path d={`M90 2V60M160 2V60`} stroke="currentColor" opacity=".3" />
        <polyline
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: "calc(1 - var(--signal-reveal, 1))",
          }}
          points={samples.map((v, t) => `${t * 5},${y(v)}`).join(" ")}
          fill="none"
          stroke={metric === "temperature" ? "#ff985f" : "#81d4e1"}
          strokeWidth="1.8"
        />
        <circle cx="160" cy={y(reading(metric, 32))} r="3" fill="#f0eee8" />
      </svg>
    </div>
  );
}
function Annotation({ chapter }: { chapter: number }) {
  if (chapter === 0)
    return (
      <>
        <span className="cinema-overline">
          THE INDUSTRIAL INVESTIGATION PROJECT
        </span>
        <p>
          We don’t just detect anomalies.
          <br />
          We help investigate them.
        </p>
        <span className="cinema-micro">
          LABLAB · AMD DEVELOPER HACKATHON ACT III
        </span>
      </>
    );
  if (chapter === 1)
    return (
      <>
        <span className="cinema-overline">SPECIMEN / P-004</span>
        <p>
          Machined flange.
          <br />
          Surface fracture.
        </p>
        <span className="cinema-micro">
          SYNTHETIC INSPECTION VISUAL
          <br />
          Illustrative geometry · not a model output
        </span>
      </>
    );
  if (chapter === 2)
    return (
      <>
        <span className="cinema-overline">VISUAL INSPECTION</span>
        <p className="cinema-status">
          <i /> ANOMALY DETECTED
        </p>
        <span className="cinema-micro">
          FLAGGED FOR REVIEW · EVT-004
          <br />
          Conceptual localization · synthetic fixture
          <br />
          No live inference in this story
        </span>
        <div className="cinema-inspection-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </>
    );
  if (chapter === 3)
    return (
      <>
        <span className="cinema-overline">SIMULATED TELEMETRY</span>
        <Signal metric="temperature" />
        <Signal metric="vibration" />
        <Signal metric="current" />
        <span className="cinema-micro">
          00:18 DRIFT &nbsp; / &nbsp; 00:32 INSPECTION
          <br />
          Dashed line: authored baseline
        </span>
      </>
    );
  if (chapter === 4)
    return (
      <>
        <span className="cinema-overline">THERMAL-DRIFT-001 / LINE-01</span>
        <ol className="cinema-evidence">
          <li>
            <time>00:18</time>
            <span>
              Temperature drift injected<small>Simulated machine signal</small>
            </span>
          </li>
          <li>
            <time>00:32</time>
            <span>
              P-004 flagged for review<small>Synthetic inspection event</small>
            </span>
          </li>
          <li>
            <time>+{evidence.leadSeconds}s</time>
            <span>
              Drift precedes the inspection
              <small>Temporal relationship, not causal proof</small>
            </span>
          </li>
        </ol>
        <p className="cinema-small">
          Temperature at inspection: {evidence.observed.toFixed(1)} °C.
          <br />
          Baseline: {evidence.baseline.toFixed(1)} °C.
        </p>
      </>
    );
  if (chapter === 5)
    return (
      <>
        <span className="cinema-overline">
          INVESTIGATION / CANDIDATE FACTOR
        </span>
        <p>
          Thermal process
          <br />
          instability.
        </p>
        <div className="cinema-rule" />
        <p className="cinema-small">
          Temperature drift preceded the flagged inspection by 14 seconds in
          this simulated scenario.
        </p>
        <p className="cinema-small">
          <strong>Suggested next step</strong>
          <br />
          Inspect thermal process stability and verify temperature sensor
          calibration.
        </p>
        <details>
          <summary>
            Evidence & uncertainty <span>↗</span>
          </summary>
          <p>
            Temperature increased by {evidence.delta.toFixed(1)} °C from the
            simulated baseline. Sensor calibration error is an alternative
            explanation. This is a deterministic guided explanation, not an LLM
            response. No technical manual was supplied, so no manual citation is
            claimed.
          </p>
        </details>
      </>
    );
  return (
    <>
      <span className="cinema-overline">BUILT FOR INVESTIGATION</span>
      <p className="cinema-small">
        AMD / ROCm adapter code is present in the project. Inference on AMD
        hardware has not yet been verified in the published evaluation.
      </p>
      <div className="cinema-actions">
        <a href={`${repo}#readme`} target="_blank" rel="noreferrer">
          Explore the Project <span aria-hidden="true">↗</span>
        </a>
        <a href={repo} target="_blank" rel="noreferrer">
          View GitHub <span aria-hidden="true">↗</span>
        </a>
        <a href="#/demo">
          Open Dashboard <span aria-hidden="true">→</span>
        </a>
      </div>
    </>
  );
}
export default function Landing() {
  const root = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null),
    panels = useRef<(HTMLElement | null)[]>([]);
  const [chapter, setChapter] = useState(0),
    [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [paused, setPaused] = useState(false);
  const clock = useRef<StoryClock>({ progress: 0, reduced, paused });
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    clock.current.reduced = reduced;
    clock.current.paused = paused;
    window.dispatchEvent(new Event("vfg-progress"));
  }, [reduced, paused]);
  useEffect(() => {
    if (!track.current || !root.current) return;
    let active = -1;
    const render = () => {
      const p = clock.current.progress,
        s = storyState(p);
      root.current!.style.setProperty("--dark", String(s.dark));
      root.current!.dataset.tone = s.dark > 0.5 ? "dark" : "light";
      root.current!.dataset.progress = p.toFixed(5);
      root.current!.style.setProperty(
        "--signal-reveal",
        String(reduced ? 1 : gsap.utils.clamp(0, 1, (p - 0.425) / 0.07)),
      );
      const n = Math.min(6, Math.round(p * 6));
      if (n !== active) {
        active = n;
        setChapter(n);
      }
      panels.current.forEach((panel, i) => {
        if (!panel) return;
        const d = Math.abs(p * 6 - i);
        const opacity = reduced
          ? n === i
            ? 1
            : 0
          : gsap.utils.clamp(0, 1, (0.53 - d) / 0.16);
        panel.style.opacity = String(opacity);
        panel.style.visibility = opacity > 0.001 ? "visible" : "hidden";
        panel.style.transform = `translateY(${reduced ? 0 : (i - p * 6) * 40}px)`;
        panel.inert = n !== i;
        panel.setAttribute("aria-hidden", String(n !== i));
      });
      window.dispatchEvent(new Event("vfg-progress"));
    };
    const tween = gsap.fromTo(
      clock.current,
      { progress: 0 },
      {
        progress: 1,
        ease: "none",
        onUpdate: render,
        scrollTrigger: {
          trigger: track.current,
          start: "top top",
          end: "bottom bottom",
          scrub: reduced ? true : 0.65,
          invalidateOnRefresh: true,
        },
      },
    );
    render();
    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh);
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reduced]);
  return (
    <div className="cinema" ref={root} data-tone="light">
      <a href="#cinema-story" className="cinema-skip">
        Skip to story
      </a>
      <header className="cinema-header">
        <a
          className="cinema-brand"
          href="#chapter-1"
          aria-label="Visual Factory Guardian, beginning"
        >
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <path
              d="M3 25V12L11 7V12L19 7V12L27 7V25Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M7 19H23M7 22H16M23 4V10"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
          <span>
            VISUAL FACTORY
            <br />
            <b>GUARDIAN</b>
          </span>
        </a>
        <span className="cinema-header-note">
          EVIDENCE-DRIVEN INDUSTRIAL AI
        </span>
        <a className="cinema-project-link" href="#/demo">
          Demo mode <span>↗</span>
        </a>
      </header>
      <div className="cinema-stage">
        <Suspense
          fallback={
            <div className="cinema-loading" role="status">
              ASSEMBLING THE PRODUCTION CELL…
            </div>
          }
        >
          <Stage clock={clock} reduced={reduced} paused={paused} />
        </Suspense>
      </div>
      <main
        id="cinema-story"
        tabIndex={-1}
        className="cinema-track"
        ref={track}
        aria-label="Seven-chapter industrial investigation story"
      >
        {chapterNames.map((name, i) => (
          <div
            className="cinema-anchor"
            id={`chapter-${i + 1}`}
            key={name}
            aria-hidden="true"
          />
        ))}
        <div className="cinema-story-layer">
          {headlines.map((lines, i) => (
            <section
              key={i}
              className={`cinema-panel cinema-panel-${i}`}
              ref={(el) => {
                panels.current[i] = el;
              }}
              aria-label={`Chapter ${i + 1}: ${chapterNames[i]}`}
            >
              <div className="cinema-copy">
                <div className="cinema-chapter-title">
                  <span>{String(i + 1).padStart(2, "0")} / 07</span>
                  <span>{chapterNames[i]}</span>
                </div>
                {i === 0 ? (
                  <h1>
                    {lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h1>
                ) : (
                  <h2>
                    {lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h2>
                )}
                <p className="cinema-intro">
                  {i === 0
                    ? "Visual Factory Guardian — evidence-driven industrial AI."
                    : intros[i]}
                </p>
                {i === 0 && (
                  <a className="cinema-scroll" href="#chapter-2">
                    <span>↓</span> SCROLL TO INVESTIGATE
                  </a>
                )}
              </div>
              <aside className="cinema-annotation">
                <Annotation chapter={i} />
              </aside>
            </section>
          ))}
        </div>
      </main>
      <footer className="cinema-footer">
        <span className="cinema-provenance">
          <i /> GUIDED SIMULATION<span> / SYNTHETIC VISUALS & TELEMETRY</span>
        </span>
        <nav aria-label="Story chapters">
          {chapterNames.map((name, i) => (
            <a
              key={name}
              href={`#chapter-${i + 1}`}
              aria-label={`Chapter ${i + 1}: ${name}`}
              aria-current={chapter === i ? "step" : undefined}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
            </a>
          ))}
        </nav>
        <button
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused || reduced}
          disabled={reduced}
        >
          {reduced
            ? "Reduced motion"
            : paused
              ? "Resume motion"
              : "Pause motion"}
        </button>
      </footer>
    </div>
  );
}
