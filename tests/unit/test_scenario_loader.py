"""Unit tests for the scenario loader."""
from __future__ import annotations

from datetime import timezone

import pytest

from backend.scenario.loader import list_scenarios, load_scenario


def test_load_scenario_by_id() -> None:
    sc = load_scenario("thermal-drift-001")
    assert sc.scenario_id == "thermal-drift-001"
    assert sc.line_id == "line-01"
    assert sc.epoch_utc.tzinfo is not None
    assert sc.epoch_utc == sc.epoch.astimezone(timezone.utc)
    assert sc.duration_seconds == 56
    assert sc.fault_start_seconds == 18
    assert sc.anomaly_at_seconds == 32
    assert sc.anomaly_threshold == 0.65
    assert {s.metric for s in sc.sensors} == {"temperature", "vibration", "current"}
    assert {i.event_id for i in sc.inspections} == {f"evt-00{i}" for i in range(1, 7)}


def test_scenario_filenames_resolve() -> None:
    names = list_scenarios()
    assert "thermal-drift-001" in names


def test_unknown_scenario_raises() -> None:
    with pytest.raises(FileNotFoundError):
        load_scenario("does-not-exist-002")


def test_sensor_units_match_frontend() -> None:
    sc = load_scenario("thermal-drift-001")
    units = {s.metric: s.unit for s in sc.sensors}
    assert units == {"temperature": "degC", "vibration": "mm/s", "current": "A"}


def test_inspections_align_with_frontend_times() -> None:
    sc = load_scenario("thermal-drift-001")
    times = [i.at_seconds for i in sc.inspections]
    assert times == [8, 16, 24, 32, 40, 48]


def test_expected_score_ranges_strictly_ordered() -> None:
    sc = load_scenario("thermal-drift-001")
    for insp in sc.inspections:
        lo, hi = insp.expected_anomaly_score_range
        assert lo <= hi, f"bad range for {insp.event_id}"