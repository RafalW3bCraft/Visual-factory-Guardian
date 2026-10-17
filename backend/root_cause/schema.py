"""
Shared data structures for the reasoning layer (Arshad's module).

These dataclasses implement the cross-team contract described in the project
README. They are intentionally dependency-free (standard library only) so the
engine, retrieval and explainer can run and be tested without FastAPI, pydantic
or any network access. The API layer (backend/api) converts these to/from JSON.

Provenance tags follow the README: "public_dataset" | "simulated" | "real".
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

SCHEMA_VERSION = "1.0"


# --------------------------------------------------------------------------- #
# Inputs                                                                       #
# --------------------------------------------------------------------------- #
@dataclass
class SensorReading:
    """One timestamped sensor sample, following the README sensor-event shape."""
    timestamp: str          # ISO-8601, e.g. "2026-10-12T10:15:00Z"
    scenario_id: str
    line_id: str
    sensor_id: str
    metric: str             # "temperature" | "vibration" | "motor_current" | ...
    value: float
    unit: str
    source: str = "simulated"          # provenance
    fault_state: Optional[str] = None  # label from the simulator, if any

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "SensorReading":
        return SensorReading(
            timestamp=d["timestamp"],
            scenario_id=d.get("scenario_id", ""),
            line_id=d.get("line_id", ""),
            sensor_id=d.get("sensor_id", d.get("metric", "")),
            metric=d["metric"],
            value=float(d["value"]),
            unit=d.get("unit", ""),
            source=d.get("source", "simulated"),
            fault_state=d.get("fault_state"),
        )


@dataclass
class Detection:
    """Vision output for an inspected image (Rafal's module)."""
    model: str
    anomaly_score: float
    localization_ref: Optional[str] = None

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "Detection":
        return Detection(
            model=d.get("model", "unknown"),
            anomaly_score=float(d.get("anomaly_score", 0.0)),
            localization_ref=d.get("localization_ref"),
        )


@dataclass
class InspectionEvent:
    """An image-inspection event the operator is investigating."""
    event_id: str
    timestamp: str
    scenario_id: str
    line_id: str
    image_id: str
    detection: Detection
    schema_version: str = SCHEMA_VERSION

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "InspectionEvent":
        return InspectionEvent(
            event_id=d["event_id"],
            timestamp=d["timestamp"],
            scenario_id=d.get("scenario_id", ""),
            line_id=d.get("line_id", ""),
            image_id=d.get("image_id", ""),
            detection=Detection.from_dict(d.get("detection", {})),
            schema_version=d.get("schema_version", SCHEMA_VERSION),
        )


# --------------------------------------------------------------------------- #
# Evidence / outputs                                                           #
# --------------------------------------------------------------------------- #
@dataclass
class SensorEvidence:
    """
    Structured statistical evidence for a single sensor signal around the event.
    Produced by the statistics module; the LLM may ONLY explain these numbers.
    """
    signal: str                 # sensor_id
    metric: str
    unit: str
    baseline: float             # rolling baseline (pre-event) mean
    baseline_std: float
    value_at_event: float
    deviation: float            # value_at_event - baseline
    z_score: float              # standardized deviation
    direction: str              # "rising" | "falling" | "stable"
    threshold_exceeded: bool
    change_point_time: Optional[str]   # ISO timestamp of detected shift, or None
    lead_time_seconds: Optional[float] # >0 => change preceded the defect event
    window_start: str
    window_end: str
    source: str = "simulated"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ManualCitation:
    source: str                 # document title
    section: str                # e.g. "3. Crack Defect Troubleshooting"
    page: Optional[int]
    snippet: str
    score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CandidateCause:
    """
    A plausible contributing factor, RANKED FROM MEASURED EVIDENCE.
    `score` is a relative ranking score in [0, 1], NOT a calibrated probability.
    """
    cause: str
    score: float
    confidence: str             # "low" | "medium" | "high" (qualitative)
    supporting_evidence: List[str]      # human-readable evidence references
    evidence_signals: List[str]         # sensor_ids backing this cause
    temporal_precedence: bool           # did the signal change precede the defect?
    lead_time_seconds: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RecommendedAction:
    text: str
    severity: str               # "info" | "inspect" | "urgent"
    requires_human_review: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AnalysisResult:
    """Full reasoning-layer output attached to an inspection event."""
    schema_version: str
    event_id: str
    timestamp: str
    scenario_id: str
    line_id: str
    image_id: str
    detection: Dict[str, Any]
    sensor_evidence: List[SensorEvidence] = field(default_factory=list)
    candidate_causes: List[CandidateCause] = field(default_factory=list)
    manual_citations: List[ManualCitation] = field(default_factory=list)
    recommended_action: Optional[RecommendedAction] = None
    explanation: str = ""
    uncertainty: str = ""
    explainer_mode: str = "deterministic"   # "deterministic" | "llm:<model>"
    disclaimer: str = (
        "Root-cause outputs are evidence-supported hypotheses, not causal proof. "
        "Temporal correlation between simulated telemetry and a detected image "
        "anomaly does not establish causation. A human must review before any action."
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "scenario_id": self.scenario_id,
            "line_id": self.line_id,
            "image_id": self.image_id,
            "detection": self.detection,
            "sensor_evidence": [e.to_dict() for e in self.sensor_evidence],
            "candidate_causes": [c.to_dict() for c in self.candidate_causes],
            "manual_citations": [m.to_dict() for m in self.manual_citations],
            "recommended_action": (
                self.recommended_action.to_dict() if self.recommended_action else None
            ),
            "explanation": self.explanation,
            "uncertainty": self.uncertainty,
            "explainer_mode": self.explainer_mode,
            "disclaimer": self.disclaimer,
        }
