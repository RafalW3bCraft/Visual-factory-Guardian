"""FastAPI app — exposes the documented /api/v1 endpoints.

The app is deliberately minimal: every handler validates its response
with the same Pydantic models the frontend uses, so the OpenAPI
schema matches the Zod validators 1:1.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from ..scenario.loader import list_scenarios
from ..vision.inference import VisionBackend, build_backend
from ..vision.inference import VisionInput
from .payloads import analysis_to_payload, event_to_payload
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
    import logging

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
    try:
        backend: VisionBackend = _resolve_vision_backend()
    except RuntimeError:
        # If backend setup fails we still start (so /health works) but
        # /events will return a 503 with a clear error.
        backend = None  # type: ignore[assignment]
    app.state.registry = registry
    app.state.backend = backend
    app.state.scenarios = list_scenarios()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Visual Factory Guardian", version="0.1.0", lifespan=_lifespan)

    # Permissive CORS for local development. In production the
    # deployment is responsible for restricting origins.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", capabilities=REQUIRED_CAPABILITIES)

    # ------------------------------------------------------------------
    # Scenarios
    # ------------------------------------------------------------------

    @app.post(
        "/api/v1/scenarios/start",
        response_model=ScenarioStartResponse,
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

    @app.get("/api/v1/analysis/{event_id}", response_model=Analysis)
    def analysis(event_id: str, request: Request) -> Analysis:
        registry: RuntimeRegistry = request.app.state.registry
        backend: VisionBackend | None = request.app.state.backend
        if backend is None:
            raise HTTPException(
                status_code=503,
                detail="Vision backend not initialised. Check server logs.",
            )
        # Find the scenario that owns this event
        scenario_id = request.query_params.get("scenario_id")
        if scenario_id is None:
            for sid in request.app.state.scenarios:
                try:
                    rt = registry.get(sid)
                except FileNotFoundError:
                    continue
                if any(i.event_id == event_id for i in rt.scenario.inspections):
                    scenario_id = sid
                    break
        if scenario_id is None:
            raise HTTPException(status_code=404, detail=f"Unknown event_id: {event_id}")
        try:
            runtime = registry.get(scenario_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

        insp = next((i for i in runtime.scenario.inspections if i.event_id == event_id), None)
        if insp is None:
            raise HTTPException(status_code=404, detail=f"Unknown event_id: {event_id}")

        evidence = runtime.evidence_for(event_id)
        fixture_root = _resolve_fixture_root()
        img_path = None
        if fixture_root is not None:
            candidate = fixture_root / runtime.scenario.scenario_id / f"{insp.image_id}.png"
            if candidate.exists():
                img_path = candidate
        vision = backend.predict(VisionInput(image_id=insp.image_id, image_path=img_path))

        payload = analysis_to_payload(
            scenario=runtime.scenario,
            event_id=event_id,
            image_id=insp.image_id,
            inspection_seconds=insp.at_seconds,
            vision=vision,
            evidence=evidence,
        )
        return Analysis.model_validate(payload)

    return app


# ``uvicorn backend.api.app:app`` entrypoint
app = create_app()


__all__ = ["create_app", "app"]