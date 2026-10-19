"""Inspection event + analysis builder.

Bridges vision outputs and sensor evidence into the JSON payloads
that the frontend's Zod schemas accept.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from ..scenario.loader import Scenario
from ..sensor_evidence.builder import EvidenceBundle
from ..vision.inference import VisionResult


def _iso_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def event_to_payload(
    scenario: Scenario,
    event_id: str,
    image_id: str,
    inspection_seconds: float,
    vision: VisionResult,
) -> dict:
    """Build an inspection event dict matching the frontend's ``eventSchema``."""
    ts = scenario.epoch_utc + timedelta(seconds=inspection_seconds)
    detection = vision.detection.to_dict()
    # The frontend schema's source enum is closed. If a backend ever emits
    # something outside the four documented values, log it loudly and fall
    # back to ``simulated`` — which is what we previously did silently and
    # what masked a class of upstream bugs (an unknown source is data
    # drift, not a synonym for ``simulated``).
    _ALLOWED_SOURCES = {"public_dataset", "simulated", "real", "recorded"}
    source = vision.source
    if source not in _ALLOWED_SOURCES:
        import logging as _logging

        _logging.getLogger("vfg.api").warning(
            "Vision backend emitted unknown source=%r for event_id=%s; "
            "falling back to 'simulated'",
            source,
            event_id,
        )
        source = "simulated"
    return {
        "schema_version": "1.0",
        "event_id": event_id,
        "timestamp": _iso_utc(ts),
        "scenario_id": scenario.scenario_id,
        "line_id": scenario.line_id,
        "image_id": image_id,
        "source": source,
        "detection": {
            "model": detection["model"],
            "anomaly_score": float(detection["anomaly_score"]),
            "localization_ref": detection.get("localization_ref"),
        },
    }


def analysis_to_payload(
    scenario: Scenario,
    event_id: str,
    image_id: str,
    inspection_seconds: float,
    vision: VisionResult,
    evidence: EvidenceBundle,
) -> dict:
    """Build the analysis dict matching the frontend's ``analysisSchema``.

    The payload includes:

      * structured sensor evidence summaries
      * candidate causes ranked by the available evidence
      * an explanatory text grounded in the inspection event and the
        measured drift — no LLM is invoked
      * a recommended action labelled as advisory
      * an empty ``manual_citations`` list because no maintenance
        manual was supplied for the prototype
    """
    # Build sensor evidence items
    evidence_items = [
        {
            "evidence_id": e.evidence_id,
            "metric": e.metric,
            "summary": e.summary,
        }
        for e in evidence.evidence
    ]

    # Candidate causes: rank by absolute deviation, drop any with delta≈0
    scored = sorted(
        evidence.evidence,
        key=lambda e: (abs(e.delta), 0 if e.above_threshold else 1),
        reverse=True,
    )
    causes = []
    for ev in scored[:3]:
        if abs(ev.delta) < 0.05 and not ev.above_threshold:
            continue
        kind = "threshold breach" if ev.above_threshold else "baseline deviation"
        uncertainty = (
            "low" if ev.above_threshold else ("medium" if abs(ev.delta) > 1.0 else "high")
        )
        causes.append(
            {
                "label": f"{ev.metric} {kind} ({ev.delta:+.2f}{_unit_for(ev.metric)})",
                "evidence_ids": [ev.evidence_id],
                "uncertainty": uncertainty,
            }
        )
    if not causes:
        causes.append(
            {
                "label": "no signal deviation detected",
                "evidence_ids": [],
                "uncertainty": "high",
            }
        )

    # Build an evidence-grounded, deterministic explanation
    drift_lead = inspection_seconds - scenario.fault_start_seconds
    flagged = vision.detection.anomaly_score >= scenario.anomaly_threshold
    drift_signals = [e for e in evidence.evidence if e.above_threshold]
    base_signals = [e for e in evidence.evidence if abs(e.delta) >= 1.0 and not e.above_threshold]

    bits: list[str] = []
    bits.append(
        f"Inspection {event_id} ({image_id}) at t={inspection_seconds:.0f}s."
    )
    if flagged:
        bits.append(
            f"Vision model {vision.detection.model} flagged the image "
            f"(anomaly score {vision.detection.anomaly_score:.2f} ≥ "
            f"threshold {scenario.anomaly_threshold:.2f})."
        )
    else:
        bits.append(
            f"Vision model {vision.detection.model} did not flag the image "
            f"(anomaly score {vision.detection.anomaly_score:.2f} < "
            f"threshold {scenario.anomaly_threshold:.2f})."
        )
    if drift_lead > 0:
        bits.append(
            f"Thermal drift was injected {drift_lead:.0f}s before this inspection, "
            f"so the sensor drift precedes the visual flag."
        )
    elif drift_lead == 0:
        bits.append("Thermal drift injection coincides with this inspection.")
    else:
        bits.append(
            f"This inspection precedes the thermal drift injection by {-drift_lead:.0f}s; "
            "the fault cannot have caused this image."
        )
    if drift_signals:
        names = ", ".join(f"{e.metric}={e.observed:.1f}" for e in drift_signals)
        bits.append(f"Threshold-breaching signals at inspection: {names}.")
    if base_signals:
        names = ", ".join(
            f"{e.metric} Δ={e.delta:+.2f}" for e in base_signals
        )
        bits.append(f"Baseline deviations at inspection: {names}.")
    bits.append(
        "These signals are simulated and recorded; correlation is not proof of causation."
    )

    # Recommended action: advisory only, never asserts certainty
    if flagged and drift_signals:
        action = (
            "Advisory: an operator should verify thermal process stability around the "
            "flagged inspection; consider a temperature sensor calibration check."
        )
    elif flagged:
        action = (
            "Advisory: an operator should visually re-inspect the flagged product and "
            "review recent maintenance records."
        )
    else:
        action = None

    return {
        "event_id": event_id,
        "scenario_id": scenario.scenario_id,
        "line_id": scenario.line_id,
        "explanation": " ".join(bits),
        "sensor_evidence": evidence_items,
        "candidate_causes": causes,
        "manual_citations": [],  # No maintenance manual was supplied for the prototype.
        "recommended_action": action,
    }


def _unit_for(metric: str) -> str:
    return {"temperature": "degC", "vibration": "mm/s", "current": "A"}.get(metric, "")


__all__ = ["event_to_payload", "analysis_to_payload"]