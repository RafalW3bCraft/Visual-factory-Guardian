"""Unit tests for the deterministic telemetry simulator."""
from __future__ import annotations

import math

from backend.scenario.loader import load_scenario
from backend.telemetry.simulator import reading_at, stream_sensor_records


def _sc():
    return load_scenario("thermal-drift-001")


def test_reading_at_baseline_pre_fault() -> None:
    sc = _sc()
    # At t=0 the drift factor is 0 — temperature should sit at baseline.
    assert math.isclose(reading_at(sc, "temperature-01", 0), 64.0, abs_tol=0.001)
    assert math.isclose(reading_at(sc, "vibration-01", 0), 2.1, abs_tol=0.001)
    assert math.isclose(reading_at(sc, "current-01", 0), 42.0, abs_tol=0.001)


def test_drift_starts_exactly_at_fault_time() -> None:
    sc = _sc()
    # At t=18 the drift factor is 0 → only the sinusoidal noise remains.
    pre = reading_at(sc, "temperature-01", 17)
    at_fault = reading_at(sc, "temperature-01", 18)
    after_fault = reading_at(sc, "temperature-01", 19)
    # The first non-fault sample (t=18) should be very close to the last
    # pre-fault sample (t=17) modulo the sine noise — within ±1°C.
    assert abs(at_fault - pre) < 1.0
    # The post-fault sample (t=19) must be higher than the pre-fault mean.
    assert after_fault > pre


def test_stream_records_are_deterministic() -> None:
    sc = _sc()
    a = stream_sensor_records(sc, start=0, end=4)
    b = stream_sensor_records(sc, start=0, end=4)
    assert [r.to_dict() for r in a] == [r.to_dict() for r in b]


def test_stream_records_timestamps_are_utc_and_advance_one_second() -> None:
    sc = _sc()
    records = stream_sensor_records(sc, start=0, end=2)
    assert records[0].timestamp == "2026-10-15T10:00:00Z"
    assert records[3].timestamp == "2026-10-15T10:00:01Z"
    # Every record must end with Z and have a +00:00 offset equivalent
    for r in records:
        assert r.timestamp.endswith("Z")
        assert "scenario_id" in r.to_dict()
        assert r.source == "simulated"


def test_fault_state_tagged_only_after_fault_start() -> None:
    sc = _sc()
    pre = stream_sensor_records(sc, start=17, end=17)[0]
    at_fault = stream_sensor_records(sc, start=18, end=18)[0]
    assert pre.fault_state is None
    assert at_fault.fault_state == "temperature_drift"


def test_stream_invalid_window_raises() -> None:
    sc = _sc()
    try:
        stream_sensor_records(sc, start=-1, end=4)
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for negative start")
    try:
        stream_sensor_records(sc, start=0, end=200)
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for end>duration")


def test_temperature_at_anomaly_is_above_threshold() -> None:
    sc = _sc()
    # At evt-004 (t=32) the temperature should be well above 75°C.
    assert reading_at(sc, "temperature-01", 32) > 75.0
    # At evt-001 (t=8) it must NOT be above 75°C.
    assert reading_at(sc, "temperature-01", 8) < 75.0