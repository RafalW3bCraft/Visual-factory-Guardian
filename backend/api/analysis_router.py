"""
Optional FastAPI router exposing the reasoning layer.

This is import-guarded: the core engine/retrieval/explainer run without FastAPI.
Devid's backend can `include_router(router)` to serve:

    POST /api/v1/analysis            -> analyse {event, readings}, store, return result
    GET  /api/v1/analysis/{event_id} -> fetch a previously computed analysis
    GET  /api/v1/analysis/health     -> readiness + explainer mode

The GET-by-id endpoint matches the repo's API contract. Analyses are kept in a
simple in-memory store for the demo; swap for the shared event store when
integrating.
"""
from __future__ import annotations

from typing import Any, Dict, List

try:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel
    _FASTAPI = True
except Exception:  # pragma: no cover - FastAPI optional
    _FASTAPI = False

from backend.reasoning.service import ReasoningService

_service = ReasoningService()
_store: Dict[str, Dict[str, Any]] = {}


if _FASTAPI:
    router = APIRouter(prefix="/api/v1", tags=["analysis"])

    class AnalyseRequest(BaseModel):
        event: Dict[str, Any]
        readings: List[Dict[str, Any]]

    @router.get("/analysis/health")
    def health() -> Dict[str, Any]:
        return {
            "status": "ok",
            "llm_available": _service.explainer.llm.available,
            "explainer_default": (
                f"llm:{_service.explainer.llm.config.model}"
                if _service.explainer.llm.available else "deterministic"
            ),
            "stored_analyses": len(_store),
        }

    @router.post("/analysis")
    def analyse(req: AnalyseRequest) -> Dict[str, Any]:
        result = _service.analyse(req.event, req.readings)
        _store[result["event_id"]] = result
        return result

    @router.get("/analysis/{event_id}")
    def get_analysis(event_id: str) -> Dict[str, Any]:
        if event_id not in _store:
            raise HTTPException(status_code=404, detail=f"No analysis for {event_id}")
        return _store[event_id]
else:  # pragma: no cover
    router = None
