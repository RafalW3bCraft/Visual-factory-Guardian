import numpy as np

from backend.root_cause.statistics import (
    cusum_change_point,
    direction_of_change,
    rolling_baseline,
    analyse_signal,
)
from backend.root_cause.schema import SensorReading


def _series(values, start="2026-10-12T10:00:00Z", step_s=30, metric="temperature",
            unit="degC", sensor_id="temperature-01"):
    from datetime import datetime, timedelta, timezone
    t0 = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
    out = []
    for i, v in enumerate(values):
        ts = (t0 + timedelta(seconds=i * step_s)).strftime("%Y-%m-%dT%H:%M:%SZ")
        out.append(SensorReading(ts, "s1", "line-01", sensor_id, metric,
                                  float(v), unit))
    return out


def test_rolling_baseline_mean_std():
    vals = np.array([10.0, 10.0, 10.0, 10.0, 20.0, 20.0])
    mean, std = rolling_baseline(vals, pre_event_count=4)
    assert abs(mean - 10.0) < 1e-9
    assert std < 1e-9


def test_cusum_detects_upward_shift():
    vals = np.concatenate([np.full(20, 10.0), np.full(20, 18.0)])
    idx = cusum_change_point(vals, baseline_mean=10.0, baseline_std=0.5)
    assert idx is not None
    assert 20 <= idx <= 24  # shortly after the shift


def test_cusum_no_change_on_flat_series():
    rng = np.random.default_rng(0)
    vals = rng.normal(10.0, 0.3, 50)
    idx = cusum_change_point(vals, baseline_mean=10.0, baseline_std=0.3)
    assert idx is None


def test_direction():
    assert direction_of_change(5.0, 0.5) == "rising"
    assert direction_of_change(-5.0, 0.5) == "falling"
    assert direction_of_change(0.0, 0.5) == "stable"


def test_analyse_signal_flags_rising_with_lead_time():
    # 30 normal then rising; event at index 45 (after the shift).
    vals = [68.0] * 30 + [68.0 + 1.2 * (i + 1) for i in range(30)]
    readings = _series(vals)
    event_ts = readings[45].timestamp
    ev = analyse_signal(readings, event_ts, normal_low=60.0, normal_high=75.0)
    assert ev is not None
    assert ev.direction == "rising"
    assert ev.threshold_exceeded is True
    assert ev.z_score > 3
    assert ev.lead_time_seconds is not None and ev.lead_time_seconds > 0


def test_analyse_signal_stable_in_band():
    rng = np.random.default_rng(1)
    vals = rng.normal(68.0, 0.3, 50)
    readings = _series(vals)
    ev = analyse_signal(readings, readings[40].timestamp,
                        normal_low=60.0, normal_high=75.0)
    assert ev.direction == "stable"
    assert ev.threshold_exceeded is False
