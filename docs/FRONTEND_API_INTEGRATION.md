# Frontend API integration proposal

No backend was present at audit time. These schemas describe the implemented frontend adapter, not a verified deployed service. The original API_CONTRACT.md remains a team draft. Coordinate these additions with backend owners before integrating.

Set `VITE_API_BASE_URL=https://your-backend-origin` in the frontend build environment. Only a public origin belongs here; Vite variables are shipped to browsers. HTTPS deployments need an HTTPS backend. The service must permit the frontend origin with CORS, including GET/POST/OPTIONS and Content-Type. No privileged credentials or authorization tokens are embedded.

All requests time out after eight seconds. Invalid payloads, failed requests, absent model output and missing telemetry/analysis/citations are explicit. Closing the panel aborts in-flight reads and retains session identity locally; use Stop live scenario to stop the remote scenario. A page reload loses local session state; reconnect/recovery endpoints are a backend follow-up.

| Method / path under `/api/v1` | Accepted response |
|---|---|
| GET `/health` | `{ "status":"ok", "capabilities":["scenarios","events","sensors","analysis"] }` |
| POST `/scenarios/start` body `{ "scenario_id":"thermal-drift-001" }` | `{ "scenario_id":"…", "line_id":"…" }` |
| POST `/scenarios/stop` body `{ "scenario_id":"…" }` | `{ "status":"stopped" }` |
| GET `/events?scenario_id=…` | Array of events below |
| GET `/sensors?scenario_id=…&line_id=…` | Array of sensors below |
| GET `/analysis/{event_id}` | Analysis object below |

Readiness checks that the server advertises all required capabilities. Start and retrieval still validate each response and can fail separately. This is not a claim that arbitrary configured servers have been independently verified.

```json
{
  "schema_version": "1.0",
  "event_id": "event-from-server",
  "timestamp": "2026-10-15T10:00:32Z",
  "scenario_id": "scenario-from-server",
  "line_id": "line-from-server",
  "image_id": "image-from-server",
  "source": "recorded",
  "detection": { "model": "model-from-server", "anomaly_score": 0.71, "localization_ref": null }
}
```

This example is a contract fixture, not a real inference result. `detection` may be null. Event source must be `public_dataset`, `simulated`, `real` or `recorded`. `localization_ref` is accepted as metadata but not fetched or rendered in the current live workspace.

Sensor fields: `timestamp` (ISO8601), `scenario_id`, `line_id`, `sensor_id`, `metric` (`temperature`, `vibration`, `current`), finite numeric `value`, `unit`, `source` (`simulated` or `real`), optional nullable `fault_state`. Values are displayed in the server-provided units.

Analysis fields: `event_id`, `scenario_id`, `line_id`, `explanation`, `sensor_evidence` array of `{ evidence_id, metric, summary }`, `candidate_causes` array of `{ label, evidence_ids: string[], uncertainty }`, `manual_citations` array of `{ title, reference, excerpt }`, and nullable `recommended_action`.

Event and sensor records are rejected if they belong to a different session/line. Analysis identity must match the selected event. Text is rendered through React, never injected as HTML. Manual references are displayed as text/expandable excerpts; their factual correctness remains a backend responsibility. Tests use mock HTTP responses and do not prove that a real endpoint exists.
