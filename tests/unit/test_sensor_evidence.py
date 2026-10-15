"""Unit tests for the sensor evidence builder."""
from __future__ import annotations

import pytest

from backend.scenario.loader import load_scenario
from backend.sensor_evidence.builder import build_evidence_for_event
from backend.telemetry.simulator import stream_sensor_records


def test_evidence_pre_event_has_positive_lead_after_fault() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    bundle = build_evidence_for_event(sc, records, "evt-004", 32)
    assert bundle.event_id == "evt-004"
    # 32 − 18 = 14s positive lead → drift precedes inspection
    assert bundle.evidence[0].lead_seconds == 14.0
    assert bundle.evidence[0].drift_started_before_inspection is True


def test_evidence_pre_event_has_negative_lead_before_fault() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    bundle = build_evidence_for_event(sc, records, "evt-001", 8)
    assert bundle.evidence[0].lead_seconds == -10.0
    assert bundle.evidence[0].drift_started_before_inspection is False


def test_evidence_window_bounds() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    bundle = build_evidence_for_event(sc, records, "evt-004", 32)
    # evidence_window_seconds=18, post_window_seconds=8 → [14, 40]
    assert bundle.window_seconds == (14.0, 40.0)


def test_temperature_evidence_crosses_threshold_at_evt_004() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    bundle = build_evidence_for_event(sc, records, "evt-004", 32)
    temp = next(e for e in bundle.evidence if e.metric == "temperature")
    assert temp.above_threshold is True
    assert temp.delta > 0


def test_unknown_event_raises() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    with pytest.raises(KeyError):
        build_evidence_for_event(sc, records, "evt-999", 999)