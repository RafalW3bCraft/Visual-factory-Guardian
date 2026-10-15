"""Unit tests for the API Pydantic schemas (mirror of the Zod validators)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.api.schemas import (
    Analysis,
    CandidateCause,
    Detection,
    Event,
    HealthResponse,
    ManualCitation,
    ScenarioStartRequest,
    ScenarioStopRequest,
    Sensor,
    SensorEvidenceItem,
)


def _base_event() -> dict:
    return {
        "schema_version": "1.0",
        "event_id": "evt-001",
        "timestamp": "2026-10-15T10:00:08Z",
        "scenario_id": "thermal-drift-001",
        "line_id": "line-01",
        "image_id": "img-001",
        "source": "simulated",
        "detection": {"model": "patchcore-lite-cpu", "anomaly_score": 0.5, "localization_ref": None},
    }


def _base_sensor() -> dict:
    return {
        "timestamp": "2026-10-15T10:00:00Z",
        "scenario_id": "thermal-drift-001",
        "line_id": "line-01",
        "sensor_id": "temperature-01",
        "metric": "temperature",
        "value": 64.0,
        "unit": "degC",
        "source": "simulated",
        "fault_state": None,
    }


def test_event_accepts_documented_payload() -> None:
    Event.model_validate(_base_event())


def test_event_detection_may_be_null() -> None:
    ev = _base_event()
    ev["detection"] = None
    Event.model_validate(ev)


def test_event_rejects_invalid_source() -> None:
    ev = _base_event()
    ev["source"] = "fabricated"
    with pytest.raises(ValidationError):
        Event.model_validate(ev)


def test_event_rejects_non_finite_score() -> None:
    ev = _base_event()
    ev["detection"]["anomaly_score"] = float("inf")
    with pytest.raises(ValidationError):
        Event.model_validate(ev)


def test_event_rejects_extra_fields() -> None:
    ev = _base_event()
    ev["rogue_field"] = "oops"
    with pytest.raises(ValidationError):
        Event.model_validate(ev)


def test_sensor_accepts_documented_payload() -> None:
    Sensor.model_validate(_base_sensor())


def test_sensor_metric_enum_is_closed() -> None:
    s = _base_sensor()
    s["metric"] = "pressure"
    with pytest.raises(ValidationError):
        Sensor.model_validate(s)


def test_health_response() -> None:
    HealthResponse.model_validate({"status": "ok", "capabilities": ["scenarios"]})


def test_analysis_payload_round_trip() -> None:
    payload = {
        "event_id": "evt-004",
        "scenario_id": "thermal-drift-001",
        "line_id": "line-01",
        "explanation": "Threshold breach.",
        "sensor_evidence": [
            {"evidence_id": "E1", "metric": "temperature", "summary": "82°C > 75°C"}
        ],
        "candidate_causes": [
            {"label": "thermal drift", "evidence_ids": ["E1"], "uncertainty": "medium"}
        ],
        "manual_citations": [
            {"title": "Manual", "reference": "p.10", "excerpt": "see §3"}
        ],
        "recommended_action": "advisory only",
    }
    Analysis.model_validate(payload)


def test_scenario_start_strict() -> None:
    ScenarioStartRequest.model_validate({"scenario_id": "thermal-drift-001"})
    with pytest.raises(ValidationError):
        ScenarioStartRequest.model_validate({})


def test_scenario_stop_strict() -> None:
    ScenarioStopRequest.model_validate({"scenario_id": "thermal-drift-001"})


def test_candidate_cause_requires_evidence_ids() -> None:
    CandidateCause.model_validate(
        {"label": "x", "evidence_ids": ["E1"], "uncertainty": "low"}
    )


def test_sensor_evidence_item_keeps_metric_field() -> None:
    SensorEvidenceItem.model_validate({"evidence_id": "E1", "metric": "temperature", "summary": "x"})


def test_manual_citation_required_fields() -> None:
    ManualCitation.model_validate({"title": "M", "reference": "p.1", "excerpt": "x"})


def test_detection_localization_ref_optional() -> None:
    Detection.model_validate({"model": "m", "anomaly_score": 0.5})
    Detection.model_validate({"model": "m", "anomaly_score": 0.5, "localization_ref": None})
    Detection.model_validate({"model": "m", "anomaly_score": 0.5, "localization_ref": "art://x"})