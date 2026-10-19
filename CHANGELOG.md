# Changelog

All notable changes to Visual Factory Guardian are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] — Unreleased

### Added (production-readiness sweep)
- `GET /api/v1/health` now reports real readiness: `status` is `"ok"` or
  `"degraded"`, plus `vision_backend_ready`, `vision_backend_kind`,
  `vision_backend_error`, `scenarios_loaded`.
- `GET /api/v1/analysis/health` now also reports vision readiness and
  LLM circuit-breaker state (`llm_failure_count`, `llm_circuit_open`).
- `GET /api/v1/scenarios` lists the scenario ids loaded at startup so
  operators can verify state after a redeploy.
- Bearer-token auth (`VFG_API_BEARER_TOKEN`) on mutating endpoints
  (`/scenarios/start|stop`, `/analysis/{event_id}`). Opt-in: when unset,
  behaviour is unchanged. Read-only endpoints stay open.
- Request-ID middleware: every response carries `X-Request-ID`; inbound
  ids are preserved.
- LLM circuit breaker (`VFG_LLM_CB_FAILS` / `VFG_LLM_CB_COOLDOWN`)
  prevents a sick AMD endpoint from stalling every request.
- LLM failures are now logged (`WARNING` with host + exception type) and
  counted; the counter surfaces in `/analysis/health`.
- Launcher now calls `logging.basicConfig` so backend log lines surface
  in the operator's stdout.
- Frontend `frontend/.env.example` documents `VITE_API_BEARER_TOKEN` so
  the dashboard can authenticate against the backend.
- The `analysis` handler runs the reasoning pipeline on a FastAPI
  thread pool (`run_in_threadpool`) so a stalled LLM call no longer
  blocks the event loop. A slow analysis in flight no longer prevents
  parallel `/health` requests from responding.
- `scripts/production_smoke.py`: operator-runnable end-to-end health gate
  that exercises every endpoint against a live server, with optional
  bearer-token authentication. Use it as the post-deploy smoke in a
  runbook or process supervisor.
- `VFG_KNOWLEDGE_PATH` and `VFG_MANUAL_PATH` env vars wire the domain
  knowledge base and maintenance manual paths through `ReasoningService`
  instead of relying on internal defaults.

### Changed (corrections to existing behaviour)
- Launcher refuses to boot when `VFG_VISION_BACKEND=patchcore-lite` and
  `VFG_FIXTURE_ROOT` is empty. Previously it auto-generated synthetic
  fixtures silently — removed because it could produce synthetic images
  in a production-misconfigured deploy.
- `GET /api/v1/analysis/{event_id}` now requires `?scenario_id=...`. The
  implicit cross-scenario `event_id` scan was a hidden O(N) lookup and
  masked routing bugs.
- `event_to_payload` logs a `WARNING` (instead of silently substituting)
  when a vision backend emits an unknown `source` value.
- `_resolve_vision_backend` logger is created at module level, not
  inside the function.
- `docs/DEPLOYMENT.md` extended with a Backend section covering env
  vars, multi-worker caveats, and the hard-fail checklist.
- README no longer describes the project as a "hackathon prototype".

### Removed
- `backend/api/analysis_router.py` — orphan router that was never
  mounted in `create_app()`. The active path is
  `analysis_adapter.build_analysis_payload`.

### Fixed (without new tests, by behaviour change)
- Backend startup logs a one-line summary (`backend=<kind>
  scenarios=<n> ids=[...]`) so an operator's first log line tells them
  whether the server is healthy.

## [0.1.0] — Initial release

- Single backend scenario `thermal-drift-001`; one deterministic
  synthetic + patchcore-lite + anomalib vision backend; root-cause
  engine, manual retrieval, and explainer layers; AMD LLM integration
  with live integration test; frontend cinematic landing and operator
  dashboard.