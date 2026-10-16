"""
Deterministic mock-scenario generator for the reasoning layer.

Produces one inspection event plus a synchronized, SIMULATED sensor stream for a
tile-kiln line, with a temperature drift injected before the defect so the
root-cause logic has a clear, reproducible signal to find. This lets the
reasoning module run end-to-end BEFORE the vision and sensor modules are wired
in (Phase 1 exit condition: "Reasoning: consume mock evidence").

Usage:
    from scripts.mock_scenario import make_mock_scenario
    event, readings = make_mock_scenario()
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

import numpy as np

SCENARIO_ID = "scenario-001"
LINE_ID = "tile-kiln-line-01"


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_mock_scenario(
    seed: int = 7,
    n: int = 60,
    interval_s: int = 30,
    fault_start_idx: int = 30,
    event_idx: int = 45,
) -> Tuple[Dict, List[Dict]]:
    """
    Returns (inspection_event, sensor_readings).

    - temperature: normal ~68 degC, drifts up to ~82 degC from fault_start_idx
      (crosses the documented 75 degC limit) -> should surface as top cause.
    - vibration: stays in band (mild noise) -> should NOT be flagged.
    - motor_current: stays in band -> should NOT be flagged.
    The defect (inspection) event occurs AFTER the temperature drift begins, so
    the change-point precedes the event (positive lead time).
    """
    rng = np.random.default_rng(seed)
    t0 = datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc)
    times = [t0 + timedelta(seconds=i * interval_s) for i in range(n)]

    temp = rng.normal(68.0, 0.6, n)
    for i in range(fault_start_idx, n):
        temp[i] += 1.0 * (i - fault_start_idx + 1)      # steady upward drift
    vib = rng.normal(2.0, 0.25, n)
    cur = rng.normal(11.0, 0.4, n)

    readings: List[Dict] = []

    def emit(metric: str, sensor_id: str, unit: str, series: np.ndarray,
             fault_from: int = None):
        for i, dt in enumerate(times):
            fault = None
            if fault_from is not None and i >= fault_from:
                fault = "temperature_drift"
            readings.append({
                "timestamp": _iso(dt),
                "scenario_id": SCENARIO_ID,
                "line_id": LINE_ID,
                "sensor_id": sensor_id,
                "metric": metric,
                "value": round(float(series[i]), 3),
                "unit": unit,
                "source": "simulated",
                "fault_state": fault,
            })

    emit("temperature", "temperature-01", "degC", temp, fault_from=fault_start_idx)
    emit("vibration", "vibration-01", "mm_s", vib)
    emit("motor_current", "motor-01", "A", cur)

    event = {
        "schema_version": "1.0",
        "event_id": "evt-0001",
        "timestamp": _iso(times[event_idx]),
        "scenario_id": SCENARIO_ID,
        "line_id": LINE_ID,
        "image_id": "tile-sample-0042",
        "detection": {
            "model": "patchcore",
            "anomaly_score": 0.91,
            "localization_ref": None,
        },
    }
    return event, readings
