"""Event alignment.

Image inspection events and sensor records share ``scenario_id`` and
``line_id``; the alignment layer joins them by timestamp and inspection
event id. The result is a unified timeline keyed by event id.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Sequence

from ..scenario.loader import Scenario
from ..telemetry.simulator import SensorRecord


@dataclass(frozen=True)
class AlignedInspection:
    event_id: str
    image_id: str
    product_id: str
    inspection_seconds: float
    inspection_timestamp_utc: str
    pre_window_records: tuple[SensorRecord, ...]
    post_window_records: tuple[SensorRecord, ...]


def iso_to_dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def align(
    scenario: Scenario,
    sensor_records: Sequence[SensorRecord],
    *,
    pre_seconds: int | None = None,
    post_seconds: int | None = None,
) -> list[AlignedInspection]:
    """Align every configured inspection with the sensor records in its window.

    Args:
        scenario: the scenario definition
        sensor_records: the full deterministic telemetry stream for this scenario
        pre_seconds: override scenario.evidence_window_seconds
        post_seconds: override scenario.post_window_seconds

    Returns:
        list of AlignedInspection, ordered by inspection_seconds ascending.
    """
    pre = pre_seconds if pre_seconds is not None else scenario.evidence_window_seconds
    post = post_seconds if post_seconds is not None else scenario.post_window_seconds

    # Group records by sensor_id for O(1) lookup-by-second
    by_sensor: dict[str, list[SensorRecord]] = {}
    for r in sensor_records:
        by_sensor.setdefault(r.sensor_id, []).append(r)

    aligned: list[AlignedInspection] = []
    for insp in scenario.inspections:
        ts = scenario.epoch_utc + timedelta(seconds=insp.at_seconds)
        ts_iso = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
        t0 = insp.at_seconds - pre
        t1 = insp.at_seconds + post

        pre_recs: list[SensorRecord] = []
        post_recs: list[SensorRecord] = []
        for sensor_id, recs in by_sensor.items():
            for r in recs:
                rt = (iso_to_dt(r.timestamp) - scenario.epoch_utc).total_seconds()
                if t0 <= rt < insp.at_seconds:
                    pre_recs.append(r)
                elif insp.at_seconds <= rt <= t1:
                    post_recs.append(r)

        aligned.append(
            AlignedInspection(
                event_id=insp.event_id,
                image_id=insp.image_id,
                product_id=insp.product_id,
                inspection_seconds=float(insp.at_seconds),
                inspection_timestamp_utc=ts_iso,
                pre_window_records=tuple(sorted(pre_recs, key=lambda r: (r.timestamp, r.sensor_id))),
                post_window_records=tuple(sorted(post_recs, key=lambda r: (r.timestamp, r.sensor_id))),
            )
        )
    return aligned


__all__ = ["AlignedInspection", "align"]