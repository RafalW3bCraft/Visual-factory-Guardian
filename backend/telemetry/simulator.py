"""Deterministic telemetry simulator.

The drift/noise formulas are the same ones the team's frontend uses
(`frontend/src/simulation/engine.ts`). We replicate them exactly in
Python so the backend can serve live scenario data that the UI already
knows how to render — same numbers, same scenario IDs, same UTC
timestamps.

Per-record shape (matches the documented API contract):

    {
      "timestamp": ISO8601 UTC,
      "scenario_id": str,
      "line_id": str,
      "sensor_id": str,
      "metric": "temperature" | "vibration" | "current",
      "value": float,
      "unit": str,
      "source": "simulated",
      "fault_state": str | None
    }
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterator, Sequence

from ..scenario.loader import Scenario, SensorConfig


@dataclass(frozen=True)
class SensorRecord:
    timestamp: str
    scenario_id: str
    line_id: str
    sensor_id: str
    metric: str
    value: float
    unit: str
    source: str
    fault_state: str | None

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "scenario_id": self.scenario_id,
            "line_id": self.line_id,
            "sensor_id": self.sensor_id,
            "metric": self.metric,
            "value": self.value,
            "unit": self.unit,
            "source": self.source,
            "fault_state": self.fault_state,
        }


def _iso_utc(dt: datetime) -> str:
    # Always return a 'Z'-suffixed ISO8601 UTC timestamp.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _drift_factor(t: int | float, fault_start: int, ramp_seconds: int = 18) -> float:
    """Linear ramp from 0 (at fault_start) to 1 (fault_start + ramp_seconds), clamped."""
    if t <= fault_start:
        return 0.0
    if t >= fault_start + ramp_seconds:
        return 1.0
    return (t - fault_start) / float(ramp_seconds)


def _synth_value(sensor: SensorConfig, t: float) -> float:
    """Mirror of the frontend's per-metric signal formula."""
    drift = _drift_factor(t, fault_start=18, ramp_seconds=18)
    sin_term = math.sin(t * sensor.noise_frequency) * sensor.noise_amplitude
    if sensor.metric == "temperature":
        return sensor.baseline + sensor.drift_amplitude * drift + sin_term
    if sensor.metric == "vibration":
        return sensor.baseline + sensor.drift_amplitude * drift + sin_term
    if sensor.metric == "current":
        return sensor.baseline + sensor.drift_amplitude * drift + sin_term
    raise ValueError(f"Unsupported metric: {sensor.metric}")


def _fault_state_for(sensor: SensorConfig, t: int) -> str | None:
    """Tag a record with a fault state when drift is active."""
    if t < 18:
        return None
    return sensor.fault_state


def stream_sensor_records(
    scenario: Scenario,
    *,
    sampling: int | None = None,
    start: int = 0,
    end: int | None = None,
) -> list[SensorRecord]:
    """Emit deterministic sensor records for ``[start, end]`` seconds (inclusive).

    Args:
        scenario: loaded Scenario definition
        sampling: override scenario.sampling_interval_seconds
        start: first second (inclusive)
        end: last second (inclusive); defaults to scenario.duration_seconds

    Returns:
        list of SensorRecord, sorted by timestamp ascending, value rounded to 2 dp.
    """
    if end is None:
        end = scenario.duration_seconds
    if start < 0 or end > scenario.duration_seconds or start > end:
        raise ValueError(f"Invalid window: [{start}, {end}] for duration {scenario.duration_seconds}")
    step = sampling if sampling is not None else scenario.sampling_interval_seconds

    out: list[SensorRecord] = []
    for t in range(start, end + 1, step):
        ts = scenario.epoch_utc + timedelta(seconds=t)
        iso = _iso_utc(ts)
        for sensor in scenario.sensors:
            value = round(_synth_value(sensor, float(t)), 2)
            out.append(
                SensorRecord(
                    timestamp=iso,
                    scenario_id=scenario.scenario_id,
                    line_id=scenario.line_id,
                    sensor_id=sensor.sensor_id,
                    metric=sensor.metric,
                    value=value,
                    unit=sensor.unit,
                    source="simulated",
                    fault_state=_fault_state_for(sensor, t),
                )
            )
    return out


def iter_sensor_records(scenario: Scenario) -> Iterator[SensorRecord]:
    """Streaming iterator variant of stream_sensor_records."""
    return iter(stream_sensor_records(scenario))


def reading_at(scenario: Scenario, sensor_id: str, at_seconds: float) -> float:
    """Point estimate for a single sensor reading — useful for evidence windows.

    Uses the same formula as stream_sensor_records but does not round to
    two decimals; rounding is a display/storage concern only.
    """
    sensor = next((s for s in scenario.sensors if s.sensor_id == sensor_id), None)
    if sensor is None:
        raise KeyError(f"Unknown sensor_id: {sensor_id}")
    return _synth_value(sensor, at_seconds)


__all__ = [
    "SensorRecord",
    "stream_sensor_records",
    "iter_sensor_records",
    "reading_at",
]