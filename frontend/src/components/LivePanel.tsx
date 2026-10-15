import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Radio, X } from "lucide-react";
import {
  GuardianApi,
  type ApiEvent,
  type Analysis,
  type sensorSchema,
} from "../services/api";
import type { z } from "zod";
type Sensor = z.infer<typeof sensorSchema>;
export default function LivePanel({
  onClose,
  open = true,
}: {
  onClose: () => void;
  open?: boolean;
}) {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [events, setEvents] = useState<ApiEvent[]>([]),
    [sensors, setSensors] = useState<Sensor[]>([]),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [selected, setSelected] = useState<ApiEvent | null>(null),
    [run, setRun] = useState<{ scenario_id: string; line_id: string } | null>(
      null,
    ),
    [stopped, setStopped] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    const previous = document.activeElement as HTMLElement;
    first.current?.focus();
    return () => {
      abort.current?.abort();
      previous?.focus();
    };
  }, [open]);
  async function operation(
    fn: (api: GuardianApi, signal: AbortSignal) => Promise<void>,
  ) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const api = new GuardianApi(import.meta.env.VITE_API_BASE_URL || "");
      await fn(api, controller.signal);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Backend request failed.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function load(
    api: GuardianApi,
    signal: AbortSignal,
    session: { scenario_id: string; line_id: string },
  ) {
    const [ev, se] = await Promise.all([
      api.events(session.scenario_id, signal),
      api.sensors(session.scenario_id, session.line_id, signal),
    ]);
    if (
      ev.some(
        (x) =>
          x.scenario_id !== session.scenario_id ||
          x.line_id !== session.line_id,
      ) ||
      se.some(
        (x) =>
          x.scenario_id !== session.scenario_id ||
          x.line_id !== session.line_id,
      )
    )
      throw new Error(
        "Backend returned records from a different scenario or line.",
      );
    setEvents(ev);
    setSensors(se);
    setAnalysis(null);
    setSelected(null);
  }
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-title"
        ref={dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const nodes = Array.from(
              dialog.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled),a[href],select",
              ),
            );
            const firstNode = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === firstNode) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              firstNode.focus();
            }
          }
        }}
      >
        <div className="panel-heading">
          <Radio size={18} />
          <h2 id="live-title">
            {run ? "Live Analysis" : "Backend connection"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close backend panel"
            onClick={onClose}
            ref={first}
          >
            <X size={20} />
          </button>
        </div>
        <span className="source-label">
          {run
            ? "LIVE ANALYSIS · API DATA ONLY"
            : "LIVE ANALYSIS NOT YET VERIFIED"}
        </span>
        <p>
          Guided Simulation uses bundled fixtures. This workspace only displays
          validated responses from the configured team backend.
        </p>
        <div className="notice">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {ready
                ? "Readiness check passed"
                : "No backend has been verified in this repository"}
            </strong>
            <p>
              {ready
                ? "The configured service advertises scenario, event, sensor and analysis capabilities. Individual responses are validated as they arrive."
                : "A live API is not included. Configure VITE_API_BASE_URL using the integration contract to connect a service."}
            </p>
          </div>
        </div>
        <div className="button-row">
          <button
            disabled={busy}
            onClick={() =>
              operation(async (api, signal) => {
                setReady(false);
                await api.health(signal);
                setReady(true);
              })
            }
          >
            {busy ? "Connecting…" : "Check connection"}
          </button>
          <button
            className="primary"
            disabled={!ready || busy || (!!run && !stopped)}
            onClick={() =>
              operation(async (api, signal) => {
                const session = await api.start(signal);
                setRun(session);
                setStopped(false);
                setEvents([]);
                setSensors([]);
                setAnalysis(null);
                await load(api, signal, session);
              })
            }
          >
            Start live scenario
          </button>
          {run && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  operation((api, signal) => load(api, signal, run))
                }
              >
                Refresh records
              </button>
              <button
                disabled={busy || stopped}
                onClick={() =>
                  operation(async (api, signal) => {
                    await api.stop(run.scenario_id, signal);
                    setStopped(true);
                  })
                }
              >
                Stop live scenario
              </button>
            </>
          )}
        </div>
        {error && (
          <div className="error" role="alert">
            <strong>Live analysis unavailable</strong>
            <p>{error}</p>
            <span>No simulated results have been substituted.</span>
          </div>
        )}
        {run && (
          <>
            <p className="fineprint">
              Closing this panel preserves the session. Use Stop live scenario
              to stop the backend run before leaving the page.
            </p>
            <p className="mono">
              {run.scenario_id} / {run.line_id} ·{" "}
              {stopped ? "Stopped" : "Started"}
            </p>
            <h3>Inspection events</h3>
            {!events.length ? (
              <p>
                No inspection events have arrived. Refresh records to check
                again.
              </p>
            ) : (
              <div className="live-events">
                {events.map((event) => (
                  <button
                    key={event.event_id}
                    disabled={busy}
                    aria-pressed={selected?.event_id === event.event_id}
                    onClick={() =>
                      operation(async (api, signal) => {
                        setSelected(event);
                        setAnalysis(null);
                        setAnalysis(await api.analysis(event, signal));
                      })
                    }
                  >
                    <strong>{event.event_id}</strong>
                    <span>
                      {event.timestamp} · {event.source}
                    </span>
                    <span>
                      {event.detection
                        ? `${event.detection.model} · score ${event.detection.anomaly_score}`
                        : "Model output missing"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <h3>Telemetry records</h3>
            {!sensors.length ? (
              <p>No telemetry returned.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensors.slice(-30).map((s, i) => (
                      <tr key={`${s.sensor_id}-${s.timestamp}-${i}`}>
                        <td>{s.timestamp}</td>
                        <td>{s.metric}</td>
                        <td>
                          {s.value} {s.unit}
                        </td>
                        <td>{s.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  Showing last {Math.min(sensors.length, 30)} of{" "}
                  {sensors.length} records.
                </p>
              </div>
            )}
            {analysis && (
              <section className="live-analysis">
                <h3>Analysis · {analysis.event_id}</h3>
                <p>{analysis.explanation || "No explanation supplied."}</p>
                {analysis.sensor_evidence.map((e) => (
                  <details key={e.evidence_id}>
                    <summary>
                      {e.evidence_id} · {e.metric}
                    </summary>
                    <p>{e.summary}</p>
                  </details>
                ))}
                {analysis.candidate_causes.map((c, i) => (
                  <div className="candidate" key={i}>
                    <strong>{c.label}</strong>
                    <p>
                      Evidence: {c.evidence_ids.join(", ") || "None supplied"}
                    </p>
                    <p>{c.uncertainty}</p>
                  </div>
                ))}
                <h4>Technical documentation</h4>
                {analysis.manual_citations.length ? (
                  analysis.manual_citations.map((c, i) => (
                    <details key={i}>
                      <summary>
                        {c.title} · {c.reference}
                      </summary>
                      <blockquote>{c.excerpt}</blockquote>
                    </details>
                  ))
                ) : (
                  <p>No manual citations supplied.</p>
                )}
                <h4>Suggested action</h4>
                <p>{analysis.recommended_action || "No action supplied."}</p>
              </section>
            )}
          </>
        )}
        <button className="wide-button" onClick={onClose}>
          Return to Guided Simulation
        </button>
      </div>
    </div>
  );
}
