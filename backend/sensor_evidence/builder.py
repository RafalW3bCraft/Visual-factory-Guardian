"""Statistical sensor evidence.

Given a deterministic telemetry stream, compute:

  - per-sensor rolling baseline (mean over the pre-fault window)
  - deviation at the inspection timestamp (observed − baseline)
  - threshold crossings (when did the signal first cross each sensor's threshold)
  - lead time (fault start to inspection, fault start to first threshold crossing)
  - change-point evidence (a binary "did the signal change before the inspection")

The evidence is intentionally simple and explainable — there is no
attempt to discover novel change points with a heavy method; the
deterministic scenario already encodes the fault onset.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from ..scenario.loader import Scenario
from ..telemetry.simulator import SensorRecord


@dataclass(frozen=True)
class SensorEvidence:
    evidence_id: str
    sensor_id: str
    metric: str
    summary: str
    baseline: float
    observed: float
    delta: float
    threshold: float
    above_threshold: bool
    pre_fault_baseline_window: tuple[float, float]
    lead_seconds: float  # inspection_seconds − fault_start_seconds
    drift_started_before_inspection: bool


@dataclass(frozen=True)
class EvidenceBundle:
    event_id: str
    scenario_id: str
    line_id: str
    inspection_seconds: float
    window_seconds: tuple[float, float]
    evidence: tuple[SensorEvidence, ...]


def _pre_fault_baseline(
    records: Sequence[SensorRecord], sensor_id: str, fault_start: int
) -> tuple[float, list[SensorRecord]]:
    relevant = [r for r in records if r.sensor_id == sensor_id and r.fault_state is None]
    if not relevant:
        return 0.0, []
    values = [r.value for r in relevant]
    mean = sum(values) / len(values)
    return mean, relevant


def build_evidence_for_event(
    scenario: Scenario,
    records: Sequence[SensorRecord],
    event_id: str,
    inspection_seconds: float,
) -> EvidenceBundle:
    """Compute the evidence bundle for a single inspection event."""
    insp = next((i for i in scenario.inspections if i.event_id == event_id), None)
    if insp is None:
        raise KeyError(f"Unknown event_id: {event_id}")

    sensor_evidence: list[SensorEvidence] = []
    for sensor in scenario.sensors:
        baseline, _ = _pre_fault_baseline(records, sensor.sensor_id, scenario.fault_start_seconds)
        # observed reading at the inspection second
        from ..telemetry.simulator import reading_at  # local import to avoid cycles

        observed = reading_at(scenario, sensor.sensor_id, inspection_seconds)
        delta = round(observed - baseline, 4)
        above = observed > sensor.threshold
        lead = inspection_seconds - scenario.fault_start_seconds
        drift_before = inspection_seconds > scenario.fault_start_seconds
        summary = (
            f"{sensor.metric} {observed:.2f}{sensor.unit} "
            f"(baseline {baseline:.2f}{sensor.unit}, "
            f"Δ={delta:+.2f}{sensor.unit}, "
            f"threshold {sensor.threshold:.2f}{sensor.unit}, "
            f"{'above' if above else 'below'} threshold); "
            f"drift started {lead:.0f}s {'before' if drift_before else 'after'} inspection"
        )
        sensor_evidence.append(
            SensorEvidence(
                evidence_id=f"{event_id}-E{sensor.metric[:3].upper()}",
                sensor_id=sensor.sensor_id,
                metric=sensor.metric,
                summary=summary,
                baseline=round(baseline, 4),
                observed=round(observed, 4),
                delta=delta,
                threshold=sensor.threshold,
                above_threshold=above,
                pre_fault_baseline_window=(0.0, float(scenario.fault_start_seconds)),
                lead_seconds=lead,
                drift_started_before_inspection=drift_before,
            )
        )

    return EvidenceBundle(
        event_id=event_id,
        scenario_id=scenario.scenario_id,
        line_id=scenario.line_id,
        inspection_seconds=float(inspection_seconds),
        window_seconds=(
            max(0.0, inspection_seconds - scenario.evidence_window_seconds),
            min(float(scenario.duration_seconds), inspection_seconds + scenario.post_window_seconds),
        ),
        evidence=tuple(sensor_evidence),
    )


__all__ = ["SensorEvidence", "EvidenceBundle", "build_evidence_for_event"]