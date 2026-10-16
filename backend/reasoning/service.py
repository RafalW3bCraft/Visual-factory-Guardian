"""
ReasoningService — the single entry point the rest of the team calls.

Combines the statistical RootCauseEngine with the Explainer so integration code
(Devid's backend / API) only needs one object and one method:

    service = ReasoningService()
    result_dict = service.analyse(event_dict, sensor_reading_dicts)

Everything is JSON-in / JSON-dict-out, matching the repo's event contract.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from backend.root_cause.engine import RootCauseEngine
from backend.root_cause.schema import InspectionEvent, SensorReading
from .explainer import Explainer


class ReasoningService:
    def __init__(
        self,
        knowledge_path: Optional[str] = None,
        manual_path: Optional[str] = None,
        prefer_llm: bool = True,
    ):
        self.engine = RootCauseEngine(knowledge_path=knowledge_path)
        self.explainer = Explainer(manual_path=manual_path)
        self.prefer_llm = prefer_llm

    def analyse(
        self,
        event: Dict[str, Any],
        readings: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        ev = InspectionEvent.from_dict(event)
        rs = [SensorReading.from_dict(r) for r in readings]
        result = self.engine.analyse(ev, rs)
        result = self.explainer.explain(result, prefer_llm=self.prefer_llm)
        return result.to_dict()
