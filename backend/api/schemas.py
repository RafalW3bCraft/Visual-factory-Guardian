"""Pydantic schemas that mirror the frontend Zod validators 1:1.

These models drive FastAPI request/response validation. They are kept
deliberately narrow — every field the frontend expects must appear
here, and every extra field is rejected.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"]
    capabilities: list[str]


class Detection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model: Annotated[str, Field(min_length=1)]
    anomaly_score: float
    localization_ref: str | None = None

    @field_validator("anomaly_score")
    @classmethod
    def _finite(cls, v: float) -> float:
        if v != v or v in (float("inf"), float("-inf")):
            raise ValueError("anomaly_score must be finite")
        return v


class Event(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1.0"]
    event_id: Annotated[str, Field(min_length=1)]
    timestamp: str
    scenario_id: Annotated[str, Field(min_length=1)]
    line_id: Annotated[str, Field(min_length=1)]
    image_id: Annotated[str, Field(min_length=1)]
    source: Literal["public_dataset", "simulated", "real", "recorded"]
    detection: Detection | None = None


class Sensor(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timestamp: str
    scenario_id: Annotated[str, Field(min_length=1)]
    line_id: Annotated[str, Field(min_length=1)]
    sensor_id: Annotated[str, Field(min_length=1)]
    metric: Literal["temperature", "vibration", "current"]
    value: float
    unit: Annotated[str, Field(min_length=1)]
    source: Literal["simulated", "real"]
    fault_state: str | None = None

    @field_validator("value")
    @classmethod
    def _finite(cls, v: float) -> float:
        if v != v or v in (float("inf"), float("-inf")):
            raise ValueError("value must be finite")
        return v


class SensorEvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evidence_id: Annotated[str, Field(min_length=1)]
    metric: Annotated[str, Field(min_length=1)]
    summary: str


class CandidateCause(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: Annotated[str, Field(min_length=1)]
    evidence_ids: list[str]
    uncertainty: str


class ManualCitation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, Field(min_length=1)]
    reference: Annotated[str, Field(min_length=1)]
    excerpt: str


class Analysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: Annotated[str, Field(min_length=1)]
    scenario_id: Annotated[str, Field(min_length=1)]
    line_id: Annotated[str, Field(min_length=1)]
    explanation: str
    sensor_evidence: list[SensorEvidenceItem]
    candidate_causes: list[CandidateCause]
    manual_citations: list[ManualCitation]
    recommended_action: str | None = None


class ScenarioStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_id: Annotated[str, Field(min_length=1)]


class ScenarioStartResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_id: Annotated[str, Field(min_length=1)]
    line_id: Annotated[str, Field(min_length=1)]


class ScenarioStopRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_id: Annotated[str, Field(min_length=1)]


class ScenarioStopResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["stopped"]


__all__ = [
    "HealthResponse",
    "Detection",
    "Event",
    "Sensor",
    "SensorEvidenceItem",
    "CandidateCause",
    "ManualCitation",
    "Analysis",
    "ScenarioStartRequest",
    "ScenarioStartResponse",
    "ScenarioStopRequest",
    "ScenarioStopResponse",
]