"""
ReasoningService — the single entry point the rest of the team calls.

Combines the statistical RootCauseEngine with the Explainer so integration code
(Devid's backend / API) only needs one object and one method:

    service = ReasoningService()
    result_dict = service.analyse(event_dict, sensor_reading_dicts)

Everything is JSON-in / JSON-dict-out, matching the repo's event contract.

Environment:
  VFG_KNOWLEDGE_PATH  optional override for the domain knowledge base file
                      (default: ``data/knowledge/tile_kiln_knowledge.json``).
  VFG_MANUAL_PATH     optional override for the maintenance manual file
                      (default: ``data/manuals/tile_line_maintenance_manual.md``).
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from backend.root_cause.engine import RootCauseEngine
from backend.root_cause.schema import InspectionEvent, SensorReading
from .explainer import Explainer


class ReasoningService:
    def __init__(
        self,
        knowledge_path: Optional[str] = None,
        manual_path: Optional[str] = None,
        prefer_llm: Optional[bool] = None,
    ):
        # Read env at construction time so an operator can change the KB or
        # manual without restarting the process — at the cost of requiring
        # a process restart for the change to take effect, which is the
        # only safe semantic for a deployed reasoning service.
        self.knowledge_path = (
            knowledge_path
            if knowledge_path is not None
            else os.environ.get("VFG_KNOWLEDGE_PATH")
        )
        self.manual_path = (
            manual_path
            if manual_path is not None
            else os.environ.get("VFG_MANUAL_PATH")
        )
        self.engine = RootCauseEngine(knowledge_path=self.knowledge_path)
        self.explainer = Explainer(manual_path=self.manual_path)
        if prefer_llm is None:
            prefer_llm = bool(os.environ.get("VFG_LLM_ENDPOINT", "").strip())
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
