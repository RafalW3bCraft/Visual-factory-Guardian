"""FastAPI app — exposes the documented /api/v1 endpoints.

The app is deliberately minimal: every handler validates its response
with the same Pydantic models the frontend uses, so the OpenAPI
schema matches the Zod validators 1:1.
"""
from __future__ import annotations

import logging
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from ..scenario.loader import list_scenarios
from ..vision.inference import VisionBackend, build_backend
from ..vision.inference import VisionInput
from .analysis_adapter import (
    build_analysis_payload,
    build_sensor_id_to_evidence,
)
from .payloads import event_to_payload
from .registry import RuntimeRegistry
from .schemas import (
    Analysis,
    Event,
    HealthResponse,
    ScenarioStartRequest,
    ScenarioStartResponse,
    ScenarioStopRequest,
    ScenarioStopResponse,
    Sensor,
)


REQUIRED_CAPABILITIES = ["scenarios", "events", "sensors", "analysis"]


def _resolve_fixture_root() -> Path | None:
    """Return the fixture image root, or None if not present."""
    root = os.environ.get("VFG_FIXTURE_ROOT", "data/fixtures")
    p = Path(root)
    return p if p.exists() else None


def _resolve_vision_backend() -> VisionBackend:
    """Pick the vision backend based on environment variables.

    Selection rules:

      * ``VFG_VISION_BACKEND=auto`` (default) — autodetect:
        Anomalib ROCm if torch (ROCm build) + anomalib are importable
        and ``VFG_MVTEC_ROOT`` points at a real MVTec AD directory;
        otherwise CPU PatchCore-lite when ``VFG_FIXTURE_ROOT`` has
        fixture images; otherwise the synthetic fixture.
      * ``VFG_VISION_BACKEND=anomalib`` — force Anomalib PatchCore.
        Requires ``VFG_MVTEC_ROOT`` and ``VFG_MVTEC_CATEGORY``.
      * ``VFG_VISION_BACKEND=patchcore-lite`` — CPU PatchCore-lite
        (requires ``VFG_FIXTURE_ROOT`` populated by ``python -m
        backend.vision.fixtures``).
      * ``VFG_VISION_BACKEND=synthetic`` — deterministic fixture.
    """
    log = logging.getLogger("vfg.backend")

    from ..vision.amd_detect import summary as _amd_summary

    env = _amd_summary()
    log.info("AMD environment: %s", env.recommended_backend)
    log.info("AMD detect summary: %s", env.to_dict())

    kind = os.environ.get("VFG_VISION_BACKEND", "auto").lower()

    if kind == "auto":
        # Try Anomalib first when the host supports it AND the dataset
        # is present, else drop down through the chain.
        if env.has_torch_rocm:
            mvtec_root = os.environ.get("VFG_MVTEC_ROOT")
            category = os.environ.get("VFG_MVTEC_CATEGORY")
            if mvtec_root and category and Path(mvtec_root, category).is_dir():
                try:
                    backend = build_backend(
                        "anomalib",
                        anomalib_kwargs={
                            "category": category,
                            "dataset_root": mvtec_root,
                            "save_loc_dir": os.environ.get(
                                "VFG_HEATMAP_DIR", "data/heatmaps"
                            ),
                        },
                    )
                    log.info("Auto-detect: using AnomalibPatchCore (ROCm)")
                    return backend
                except RuntimeError as exc:
                    log.warning("Auto-detect: Anomalib load failed: %s", exc)
        fixture_root = _resolve_fixture_root()
        if fixture_root is not None and env.has_amd_hardware:
            log.info("Auto-detect: AMD hardware present, using PatchCoreLiteCPU")
        elif fixture_root is not None and not env.has_amd_hardware:
            log.info("Auto-detect: fixture images present, using PatchCoreLiteCPU")
        if fixture_root is not None:
            scenario_id = os.environ.get("VFG_SCENARIO", "thermal-drift-001")
            from ..scenario.loader import load_scenario

            scenario = load_scenario(scenario_id)
            fixture_dir = fixture_root / scenario.scenario_id
            normals = sorted(fixture_dir.glob("normal_*.png"))
            if normals:
                from ..vision.inference import VisionInput

                backend = build_backend("patchcore-lite", input_size=scenario.vision_model.input_size)
                backend.fit([VisionInput(image_id=p.stem, image_path=p) for p in normals])
                return backend
        log.info("Auto-detect: no fixtures found, using SyntheticFixtureBackend")
        return build_backend("synthetic")

    if kind in {"patchcore-lite", "patchcore-lite-cpu"}:
        fixture_root = _resolve_fixture_root()
        if fixture_root is None:
            raise RuntimeError(
                "VFG_VISION_BACKEND=patchcore-lite requested but "
                "VFG_FIXTURE_ROOT does not exist. Run "
                "`python -m backend.vision.fixtures --scenario thermal-drift-001` first."
            )
        scenario_id = os.environ.get("VFG_SCENARIO", "thermal-drift-001")
        from ..scenario.loader import load_scenario

        scenario = load_scenario(scenario_id)
        fixture_dir = fixture_root / scenario.scenario_id
        normals = sorted(fixture_dir.glob("normal_*.png"))
        if not normals:
            raise RuntimeError(
                f"No normal training images found under {fixture_dir}. "
                "Run `python -m backend.vision.fixtures` first."
            )
        from ..vision.inference import VisionInput

        backend = build_backend("patchcore-lite", input_size=scenario.vision_model.input_size)
        backend.fit([VisionInput(image_id=p.stem, image_path=p) for p in normals])
        return backend

    if kind in {"synthetic", "fixture"}:
        return build_backend("synthetic")

    if kind in {"anomalib", "anomalib-rocm", "patchcore-rocm"}:
        mvtec_root = os.environ.get("VFG_MVTEC_ROOT")
        category = os.environ.get("VFG_MVTEC_CATEGORY")
        if not mvtec_root or not category:
            raise RuntimeError(
                "VFG_VISION_BACKEND=anomalib requires VFG_MVTEC_ROOT and VFG_MVTEC_CATEGORY."
            )
        return build_backend(
            "anomalib",
            anomalib_kwargs={
                "category": category,
                "dataset_root": mvtec_root,
                "save_loc_dir": os.environ.get("VFG_HEATMAP_DIR", "data/heatmaps"),
            },
        )

    raise RuntimeError(f"Unknown VFG_VISION_BACKEND: {kind}")


@asynccontextmanager
async def _lifespan(app: FastAPI):
    registry = RuntimeRegistry()
    backend: VisionBackend | None = None
    backend_kind = "none"
    backend_error: str | None = None
    try:
        backend = _resolve_vision_backend()
        backend_kind = type(backend).__name__
    except RuntimeError as exc:
        # Make init failure loud so operators notice via /health AND in logs.
        # The server still boots so /health can report the failure rather
        # than silently 503-ing every other endpoint.
        backend_error = str(exc)
        logging.getLogger("vfg.backend").error(
            "Vision backend init failed: %s", exc, exc_info=True
        )
    app.state.registry = registry
    app.state.backend = backend
    app.state.backend_kind = backend_kind
    app.state.backend_error = backend_error
    app.state.scenarios = list_scenarios()
    # Loud startup summary so an operator's first log line tells them
    # whether the server is healthy and which scenarios are wired in.
    scenarios_list = list(app.state.scenarios)
    logging.getLogger("vfg.backend").info(
        "Startup: backend=%s scenarios=%d ids=%s",
        backend_kind,
        len(scenarios_list),
        scenarios_list,
    )
    yield


def _resolve_cors_origins() -> list[str]:
    """Restrict CORS by default; allow operators to widen via env.

    Production deployments should set ``VFG_CORS_ORIGINS`` to the exact
    origin(s) of the operator dashboard, comma-separated. When unset we
    allow only ``http://localhost:*`` (Vite dev / preview) and the
    documented 4173 port. The default is intentionally narrow so a
    production server cannot accidentally serve any browser origin.
    """
    raw = os.environ.get("VFG_CORS_ORIGINS")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def _bearer_token_configured() -> str | None:
    """Return the configured bearer token, or None if auth is disabled.

    Auth is opt-in: when ``VFG_API_BEARER_TOKEN`` is unset, the API is open
    (matches the prior dev workflow). When set, mutating endpoints and the
    analysis endpoint require ``Authorization: Bearer <token>``. Read-only
    endpoints (``/events``, ``/sensors``, ``/health``, ``/analysis/health``)
    stay open so monitoring tools can poll them without a credential.
    """
    tok = os.environ.get("VFG_API_BEARER_TOKEN", "").strip()
    return tok or None


def require_bearer_if_configured(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """FastAPI dependency: enforces the bearer token when one is configured.

    Back-compat: when no token is configured this dependency is a no-op so
    existing dev/test setups keep working unchanged.
    """
    expected = _bearer_token_configured()
    if expected is None:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    presented = authorization[7:].strip()
    # Constant-time compare to avoid leaking token length via timing.
    if not secrets.compare_digest(presented, expected):
        raise HTTPException(
            status_code=401,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def create_app() -> FastAPI:
    app = FastAPI(title="Visual Factory Guardian", version="0.1.0", lifespan=_lifespan)

    # Request-ID middleware: attach a stable correlation id to every request
    # so logs from the handler, the LLM client, and any downstream service
    # can be tied together. Respects an incoming ``X-Request-ID`` so a
    # frontend or upstream proxy can propagate the id through the call.
    @app.middleware("http")
    async def _request_id_middleware(request: Request, call_next):
        rid = request.headers.get("x-request-id") or secrets.token_hex(8)
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

    # CORS — narrow by default; widen via VFG_CORS_ORIGINS if needed.
    # Set VFG_CORS_ALLOW_ALL=1 only for local development.
    if os.environ.get("VFG_CORS_ALLOW_ALL") == "1":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            allow_credentials=False,
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=_resolve_cors_origins(),
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            allow_credentials=False,
        )

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health(request: Request) -> HealthResponse:
        backend: VisionBackend | None = request.app.state.backend
        backend_kind: str = getattr(request.app.state, "backend_kind", "none")
        backend_error: str | None = getattr(
            request.app.state, "backend_error", None
        )
        scenarios_loaded: list[str] = list(
            getattr(request.app.state, "scenarios", []) or []
        )
        # ``degraded`` when the server boots but a downstream dep is missing.
        # ``unready`` is reserved for a future state where we cannot serve any
        # request; for now, a missing vision backend still lets /events fail
        # loudly with 503 rather than hanging.
        if backend is None:
            status: Literal["ok", "degraded", "unready"] = "degraded"
            caps = [c for c in REQUIRED_CAPABILITIES if c != "events"]
        else:
            status = "ok"
            caps = list(REQUIRED_CAPABILITIES)
        return HealthResponse(
            status=status,
            capabilities=caps,
            vision_backend_ready=backend is not None,
            vision_backend_kind=backend_kind,
            vision_backend_error=backend_error,
            scenarios_loaded=scenarios_loaded,
        )

    # ------------------------------------------------------------------
    # Scenarios
    # ------------------------------------------------------------------

    @app.get(
        "/api/v1/scenarios",
        response_model=list[str],
    )
    def scenarios_list(request: Request) -> list[str]:
        """List the scenario ids the server has loaded at startup.

        Read-only; lets an operator verify which scenarios are wired in
        after a redeploy without reading logs.
        """
        return list(getattr(request.app.state, "scenarios", []) or [])

    @app.post(
        "/api/v1/scenarios/start",
        response_model=ScenarioStartResponse,
        dependencies=[Depends(require_bearer_if_configured)],
    )
    def scenarios_start(
        req: ScenarioStartRequest, request: Request
    ) -> ScenarioStartResponse:
        registry: RuntimeRegistry = request.app.state.registry
        if req.scenario_id not in request.app.state.scenarios:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown scenario_id: {req.scenario_id}. Known: {request.app.state.scenarios}",
            )
        runtime = registry.get(req.scenario_id)
        return ScenarioStartResponse(
            scenario_id=runtime.scenario.scenario_id,
            line_id=runtime.scenario.line_id,
        )

    @app.post(
        "/api/v1/scenarios/stop",
        response_model=ScenarioStopResponse,
        dependencies=[Depends(require_bearer_if_configured)],
    )
    def scenarios_stop(
        req: ScenarioStopRequest, request: Request
    ) -> ScenarioStopResponse:
        registry: RuntimeRegistry = request.app.state.registry
        registry.stop(req.scenario_id)
        return ScenarioStopResponse(status="stopped")

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------

    @app.get("/api/v1/events", response_model=list[Event])
    def events(
        request: Request,
        scenario_id: str = Query(..., min_length=1),
    ) -> list[Event]:
        registry: RuntimeRegistry = request.app.state.registry
        backend: VisionBackend | None = request.app.state.backend
        if backend is None:
            raise HTTPException(
                status_code=503,
                detail="Vision backend not initialised. Check server logs.",
            )
        try:
            runtime = registry.get(scenario_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

        out: list[Event] = []
        for aligned in runtime.aligned:
            # Use a synthetic zero-bytes VisionInput because the synthetic
            # backend doesn't need the file path. The PatchCore backend
            # does — try to attach the file path if fixtures are present.
            fixture_root = _resolve_fixture_root()
            img_path = None
            if fixture_root is not None:
                candidate = fixture_root / runtime.scenario.scenario_id / f"{aligned.image_id}.png"
                if candidate.exists():
                    img_path = candidate
            vision_input = VisionInput(image_id=aligned.image_id, image_path=img_path)
            vision = backend.predict(vision_input)
            payload = event_to_payload(
                scenario=runtime.scenario,
                event_id=aligned.event_id,
                image_id=aligned.image_id,
                inspection_seconds=aligned.inspection_seconds,
                vision=vision,
            )
            out.append(Event.model_validate(payload))
        return out

    # ------------------------------------------------------------------
    # Sensors
    # ------------------------------------------------------------------

    @app.get("/api/v1/sensors", response_model=list[Sensor])
    def sensors(
        request: Request,
        scenario_id: str = Query(..., min_length=1),
        line_id: str = Query(..., min_length=1),
    ) -> list[Sensor]:
        registry: RuntimeRegistry = request.app.state.registry
        try:
            runtime = registry.get(scenario_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        if runtime.scenario.line_id != line_id:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"line_id mismatch: scenario {scenario_id} runs on "
                    f"{runtime.scenario.line_id}, not {line_id}"
                ),
            )
        return [
            Sensor.model_validate(r.to_dict())
            for r in runtime.sensor_records_for_window()
        ]

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------

    # Static reasoning-layer readiness probe MUST be declared before the
    # /analysis/{event_id} catch-all or FastAPI will dispatch "health" as
    # an event_id and return 404.
    @app.get("/api/v1/analysis/health")
    def analysis_health(request: Request) -> dict:
        """Report whether the AMD-hosted LLM explainer is reachable.

        Operators use this to verify .env credentials at deploy time
        without running a full analysis. Returns ``llm_available=False`` if
        the endpoint is unset / unreachable — the pipeline still works via
        the deterministic fallback. Also reports vision-backend readiness so
        operators see the full dependency picture in one call.
        """
        from backend.reasoning.service import ReasoningService

        svc = ReasoningService()
        backend: VisionBackend | None = request.app.state.backend
        llm = svc.explainer.llm
        return {
            "status": "ok" if backend is not None else "degraded",
            "llm_available": bool(llm.available),
            "explainer_default": (
                f"llm:{llm.config.model}" if llm.available else "deterministic"
            ),
            "llm_endpoint_configured": bool(llm.config.endpoint),
            "llm_model": llm.config.model,
            # Circuit-breaker observability — operators can see how the
            # AMD endpoint has been behaving since process start.
            "llm_failure_count": llm.failure_count,
            "llm_circuit_open": llm.circuit_open,
            "vision_backend_ready": backend is not None,
            "vision_backend_kind": getattr(
                request.app.state, "backend_kind", "none"
            ),
            "vision_backend_error": getattr(
                request.app.state, "backend_error", None
            ),
        }

    @app.get(
        "/api/v1/analysis/{event_id}",
        response_model=Analysis,
        dependencies=[Depends(require_bearer_if_configured)],
    )
    async def analysis(
        event_id: str,
        request: Request,
        scenario_id: Annotated[
            str,
            Query(
                min_length=1,
                description="Required: which scenario owns this event_id. "
                "Removing the implicit cross-scenario scan eliminates a "
                "hidden O(scenarios × inspections) lookup per request.",
            ),
        ],
    ) -> Analysis:
        registry: RuntimeRegistry = request.app.state.registry
        backend: VisionBackend | None = request.app.state.backend
        if backend is None:
            raise HTTPException(
                status_code=503,
                detail="Vision backend not initialised. Check server logs.",
            )
        # Caller MUST supply scenario_id. Cross-scenario event_id scanning
        # was a hidden O(N) lookup that also masked routing bugs.
        if scenario_id not in request.app.state.scenarios:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Unknown scenario_id: {scenario_id}. Known: "
                    f"{request.app.state.scenarios}"
                ),
            )
        try:
            runtime = registry.get(scenario_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

        insp = next((i for i in runtime.scenario.inspections if i.event_id == event_id), None)
        if insp is None:
            raise HTTPException(status_code=404, detail=f"Unknown event_id: {event_id}")

        fixture_root = _resolve_fixture_root()
        img_path = None
        if fixture_root is not None:
            candidate = fixture_root / runtime.scenario.scenario_id / f"{insp.image_id}.png"
            if candidate.exists():
                img_path = candidate
        vision = backend.predict(VisionInput(image_id=insp.image_id, image_path=img_path))

        # The event timestamp the frontend and the rest of the system use is
        # epoch_utc + at_seconds. Reconstruct the matching ISO Z timestamp so
        # the reasoning service sees the same wall-clock the live API returns.
        from datetime import datetime, timedelta, timezone

        event_dt = runtime.scenario.epoch_utc + timedelta(seconds=insp.at_seconds)
        if event_dt.tzinfo is None:
            event_dt = event_dt.replace(tzinfo=timezone.utc)
        event_ts_iso = event_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Convert the live sensor records to plain dicts for the adapter.
        readings_dicts = [r.to_dict() for r in runtime.sensor_records]
        # Stable mapping live stream sensor_id -> frontend evidence_id; the
        # adapter fills in any extras it observes from the service output.
        sensor_id_map = build_sensor_id_to_evidence(event_id, readings_dicts)

        event_dict = {
            "schema_version": "1.0",
            "event_id": event_id,
            "timestamp": event_ts_iso,
            "scenario_id": runtime.scenario.scenario_id,
            "line_id": runtime.scenario.line_id,
            "image_id": insp.image_id,
            "detection": {
                "model": vision.detection.model,
                "anomaly_score": float(vision.detection.anomaly_score),
                "localization_ref": vision.detection.localization_ref,
            },
        }

        payload = await run_in_threadpool(
            build_analysis_payload,
            event_id=event_id,
            scenario_id=runtime.scenario.scenario_id,
            line_id=runtime.scenario.line_id,
            event_timestamp=event_ts_iso,
            event_dict=event_dict,
            readings=readings_dicts,
            sensor_id_to_evidence=sensor_id_map,
        )
        return Analysis.model_validate(payload)

    return app


# ``uvicorn backend.api.app:app`` entrypoint
app = create_app()


__all__ = ["create_app", "app"]