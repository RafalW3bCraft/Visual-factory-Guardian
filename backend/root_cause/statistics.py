"""
Statistical evidence generation for the root-cause engine.

Pure NumPy. No model, no network. Given a time series of sensor readings and
the timestamp of an inspection (defect) event, this module computes:

  * a rolling baseline (mean / std) from the pre-event window
  * the deviation and z-score of the reading at the event time
  * the direction of change (rising / falling / stable)
  * whether a documented threshold was exceeded
  * a change-point time via a CUSUM detector
  * the lead time: how many seconds the change-point PRECEDED the event
    (positive lead time is the key signal that a sensor shift came first)

The statistics engine produces structured evidence; the LLM only explains it.
Nothing here asserts causation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

import numpy as np

from .schema import SensorReading, SensorEvidence


# --------------------------------------------------------------------------- #
# Time helpers                                                                 #
# --------------------------------------------------------------------------- #
def parse_ts(ts: str) -> datetime:
    """Parse an ISO-8601 timestamp, tolerating a trailing 'Z'."""
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def to_epoch(ts: str) -> float:
    return parse_ts(ts).timestamp()


# --------------------------------------------------------------------------- #
# Core detectors                                                              #
# --------------------------------------------------------------------------- #
def cusum_change_point(
    values: np.ndarray,
    baseline_mean: float,
    baseline_std: float,
    threshold_sigma: float = 5.0,
    drift_sigma: float = 1.0,
) -> Optional[int]:
    """
    Two-sided CUSUM change-point detector.

    Returns the index at which a sustained mean shift is first detected, or None.
    `threshold_sigma` is the decision threshold (h) and `drift_sigma` is the
    slack (k), both expressed in units of the baseline standard deviation.
    """
    if baseline_std <= 0:
        baseline_std = 1e-9
    k = drift_sigma * baseline_std
    h = threshold_sigma * baseline_std

    s_pos = 0.0
    s_neg = 0.0
    for i, x in enumerate(values):
        diff = x - baseline_mean
        s_pos = max(0.0, s_pos + diff - k)
        s_neg = min(0.0, s_neg + diff + k)
        if s_pos > h or s_neg < -h:
            return i
    return None


def rolling_baseline(
    values: np.ndarray, pre_event_count: int
) -> Tuple[float, float]:
    """Mean and std of the pre-event window (robust to tiny windows)."""
    if pre_event_count <= 0:
        pre_event_count = max(1, len(values) // 4)
    window = values[:pre_event_count]
    if window.size == 0:
        window = values[: max(1, len(values))]
    mean = float(np.mean(window))
    std = float(np.std(window, ddof=1)) if window.size > 1 else 0.0
    return mean, std


def direction_of_change(z_score: float, z_threshold: float = 2.0) -> str:
    """Direction is only asserted when the shift is statistically meaningful."""
    if z_score >= z_threshold:
        return "rising"
    if z_score <= -z_threshold:
        return "falling"
    return "stable"


# --------------------------------------------------------------------------- #
# Per-signal evidence                                                         #
# --------------------------------------------------------------------------- #
def analyse_signal(
    readings: List[SensorReading],
    event_ts: str,
    normal_low: Optional[float] = None,
    normal_high: Optional[float] = None,
) -> Optional[SensorEvidence]:
    """
    Build SensorEvidence for a single sensor's time series around an event.

    `readings` must be for ONE sensor_id, in chronological order.
    `normal_low` / `normal_high` are documented operating limits (from the
    machine manual / scenario config) used only for the threshold_exceeded flag.
    """
    if not readings:
        return None

    readings = sorted(readings, key=lambda r: to_epoch(r.timestamp))
    times = np.array([to_epoch(r.timestamp) for r in readings], dtype=float)
    values = np.array([r.value for r in readings], dtype=float)
    event_epoch = to_epoch(event_ts)

    # Index of the last sample at or before the event.
    pre_mask = times <= event_epoch
    if not pre_mask.any():
        event_idx = 0
    else:
        event_idx = int(np.max(np.where(pre_mask)[0]))
    # Seed a preliminary baseline from an early "warm-up" window of
    # known-normal operation, so an in-progress drift does not contaminate it.
    warmup = max(5, int(0.25 * len(values)))
    prelim_mean, prelim_std = rolling_baseline(values, warmup)

    # Detect a sustained shift using the preliminary baseline.
    cp_idx = cusum_change_point(values, prelim_mean, prelim_std)
    change_point_time: Optional[str] = None
    lead_time_seconds: Optional[float] = None

    # Final baseline = statistics of the normal period BEFORE the change point
    # (fall back to the warm-up window when no shift is detected).
    if cp_idx is not None and cp_idx >= 3:
        baseline_mean, baseline_std = rolling_baseline(values, cp_idx)
        change_point_time = readings[cp_idx].timestamp
        lead_time_seconds = float(event_epoch - times[cp_idx])  # >0 => precedes
    else:
        baseline_mean, baseline_std = prelim_mean, prelim_std

    value_at_event = float(values[event_idx])
    deviation = value_at_event - baseline_mean
    # Floor the std so a shift off a (near-)constant baseline still registers;
    # real sensor noise is always well above this floor, so it is a no-op there.
    eff_std = max(baseline_std, 1e-3)
    z = deviation / eff_std

    threshold_exceeded = False
    if normal_low is not None and value_at_event < normal_low:
        threshold_exceeded = True
    if normal_high is not None and value_at_event > normal_high:
        threshold_exceeded = True

    r0 = readings[0]
    return SensorEvidence(
        signal=r0.sensor_id,
        metric=r0.metric,
        unit=r0.unit,
        baseline=round(baseline_mean, 4),
        baseline_std=round(baseline_std, 4),
        value_at_event=round(value_at_event, 4),
        deviation=round(deviation, 4),
        z_score=round(float(z), 4),
        direction=direction_of_change(float(z)),
        threshold_exceeded=threshold_exceeded,
        change_point_time=change_point_time,
        lead_time_seconds=lead_time_seconds,
        window_start=readings[0].timestamp,
        window_end=readings[-1].timestamp,
        source=r0.source,
    )


def group_by_sensor(readings: List[SensorReading]) -> dict:
    """Group a mixed stream of readings by sensor_id."""
    groups: dict = {}
    for r in readings:
        groups.setdefault(r.sensor_id, []).append(r)
    return groups
