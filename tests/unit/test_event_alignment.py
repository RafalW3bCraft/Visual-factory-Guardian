"""Unit tests for the event-alignment layer."""
from __future__ import annotations

from backend.event_alignment.aligner import align
from backend.scenario.loader import load_scenario
from backend.telemetry.simulator import stream_sensor_records


def test_align_emits_one_record_per_inspection() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    aligned = align(sc, records)
    assert [a.event_id for a in aligned] == [i.event_id for i in sc.inspections]


def test_aligned_window_contains_window_records() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    aligned = align(sc, records)
    a = aligned[3]  # evt-004
    # pre-window covers 14s..31s inclusive for evt-004 (default pre=18)
    pre_ts = {r.timestamp for r in a.pre_window_records}
    assert any("T10:00:14Z" in t for t in pre_ts)
    assert any("T10:00:31Z" in t for t in pre_ts)
    # post-window covers 32s..40s inclusive
    post_ts = {r.timestamp for r in a.post_window_records}
    assert any("T10:00:32Z" in t for t in post_ts)
    assert any("T10:00:40Z" in t for t in post_ts)


def test_aligned_window_clamps_to_scenario_bounds() -> None:
    sc = load_scenario("thermal-drift-001")
    records = stream_sensor_records(sc)
    aligned = align(sc, records, pre_seconds=18, post_seconds=8)
    first = aligned[0]  # evt-001 at t=8 → window [0, 16]
    pre_ts = {r.timestamp for r in first.pre_window_records}
    # No pre-window record should be before t=0
    assert all(t >= "2026-10-15T10:00:00Z" for t in pre_ts)