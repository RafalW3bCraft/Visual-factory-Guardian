"""
RootCauseEngine — ranks plausible contributing factors from MEASURED evidence.

Pipeline:
  1. Group the sensor stream by sensor_id and build SensorEvidence for each
     (statistics.py).
  2. Match each signal's behaviour (direction, deviation, threshold, temporal
     precedence) against a documented knowledge base of failure modes.
  3. Score and rank candidate causes. The score combines:
        - deviation magnitude (|z|, squashed to [0,1])
        - temporal precedence (did the signal change BEFORE the defect?)
        - threshold exceedance
        - a documented base prior for that failure mode
     The score is an explicit, inspectable ranking value — NOT a probability.
  4. Produce a recommended, human-review-gated action.

No LLM is used here. Causation is never asserted.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Optional

from .schema import (
    AnalysisResult,
    CandidateCause,
    InspectionEvent,
    RecommendedAction,
    SensorEvidence,
    SensorReading,
    SCHEMA_VERSION,
)
from .statistics import analyse_signal, group_by_sensor

_DEFAULT_KB = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "knowledge"
    / "tile_kiln_knowledge.json"
)


def _squash(x: float) -> float:
    """Map |z| in [0, inf) to [0, 1) smoothly."""
    return 1.0 - math.exp(-abs(x) / 3.0)


def _confidence_label(score: float, temporal: bool) -> str:
    if score >= 0.6 and temporal:
        return "high"
    if score >= 0.4:
        return "medium"
    return "low"


class RootCauseEngine:
    def __init__(self, knowledge_path: Optional[str] = None):
        path = Path(knowledge_path) if knowledge_path else _DEFAULT_KB
        with open(path, "r", encoding="utf-8") as fh:
            self.kb = json.load(fh)
        self.normal_ranges: Dict[str, dict] = self.kb.get("normal_ranges", {})
        self.failure_modes: List[dict] = self.kb.get("failure_modes", [])
        # Metric aliases allow the same failure-mode definition to apply to
        # different metric names across the legacy mock scenario and the
        # integrated thermal-drift-001 scenario (e.g. ``motor_current`` and
        # ``current`` both describe the same conveyor drive signal).
        raw_aliases = self.kb.get("metric_aliases", {})
        self.metric_aliases: Dict[str, str] = {
            str(k): str(v) for k, v in raw_aliases.items()
        }

    def canonical_metric(self, metric: str) -> str:
        """Return the canonical metric name after alias resolution."""
        return self.metric_aliases.get(metric, metric)

    # ------------------------------------------------------------------ #
    def build_evidence(
        self, readings: List[SensorReading], event_ts: str
    ) -> List[SensorEvidence]:
        evidence: List[SensorEvidence] = []
        for sensor_id, group in group_by_sensor(readings).items():
            metric = group[0].metric
            # Range lookup prefers the raw metric (preserves the actual
            # operating band for legacy mocks that used motor_current);
            # aliases apply only when the raw range is absent.
            rng = self.normal_ranges.get(metric, {})
            if not rng:
                rng = self.normal_ranges.get(self.canonical_metric(metric), {})
            ev = analyse_signal(
                group,
                event_ts,
                normal_low=rng.get("low"),
                normal_high=rng.get("high"),
            )
            if ev is not None:
                evidence.append(ev)
        return evidence

    # ------------------------------------------------------------------ #
    def rank_causes(
        self, evidence: List[SensorEvidence]
    ) -> List[CandidateCause]:
        by_metric: Dict[str, List[SensorEvidence]] = {}
        for ev in evidence:
            canonical = self.canonical_metric(ev.metric)
            by_metric.setdefault(canonical, []).append(ev)

        candidates: List[CandidateCause] = []
        for mode in self.failure_modes:
            metric = mode["metric"]
            want_dir = mode.get("direction")
            evs = by_metric.get(metric, [])
            for ev in evs:
                # Direction must match the failure mode to be considered.
                if want_dir and ev.direction != want_dir:
                    continue

                temporal = bool(
                    ev.lead_time_seconds is not None and ev.lead_time_seconds > 0
                )
                mag = _squash(ev.z_score)                       # [0,1)
                prior = float(mode.get("base_prior", 0.4))

                # Weighted ranking score.
                score = (
                    0.45 * mag
                    + 0.30 * (1.0 if temporal else 0.0)
                    + 0.15 * (1.0 if ev.threshold_exceeded else 0.0)
                    + 0.10 * prior
                )
                score = round(min(1.0, score), 4)

                supporting = [
                    f"{ev.signal} ({ev.metric}) {ev.direction}: "
                    f"{ev.value_at_event}{ev.unit} vs baseline "
                    f"{ev.baseline}{ev.unit} (z={ev.z_score})"
                ]
                if ev.threshold_exceeded:
                    supporting.append(
                        f"{ev.metric} outside documented normal range"
                    )
                if temporal:
                    supporting.append(
                        f"signal shift preceded the defect event by "
                        f"{ev.lead_time_seconds:.0f}s (change-point "
                        f"{ev.change_point_time})"
                    )

                candidates.append(
                    CandidateCause(
                        cause=mode["cause"],
                        score=score,
                        confidence=_confidence_label(score, temporal),
                        supporting_evidence=supporting,
                        evidence_signals=[ev.signal],
                        temporal_precedence=temporal,
                        lead_time_seconds=ev.lead_time_seconds,
                    )
                )

        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates

    # ------------------------------------------------------------------ #
    def recommend(
        self,
        causes: List[CandidateCause],
        anomaly_score: float,
    ) -> RecommendedAction:
        if not causes:
            return RecommendedAction(
                text=(
                    "No sensor signal crossed its documented limits around this "
                    "event. Confirm the image finding manually and keep monitoring."
                ),
                severity="info",
                requires_human_review=True,
            )
        top = causes[0]
        urgent = top.confidence == "high" and anomaly_score >= 0.8
        sev = "urgent" if urgent else "inspect"
        signal = top.evidence_signals[0] if top.evidence_signals else "the flagged signal"
        text = (
            f"Investigate: {top.cause.lower()}. "
            f"Have a technician inspect {signal} and the affected batch, "
            f"verify against the maintenance manual, and isolate the batch if the "
            f"condition is confirmed. Human review required before any line action."
        )
        return RecommendedAction(text=text, severity=sev, requires_human_review=True)

    # ------------------------------------------------------------------ #
    def analyse(
        self,
        event: InspectionEvent,
        readings: List[SensorReading],
    ) -> AnalysisResult:
        """Full analysis for one inspection event. (Explanation added by the
        reasoning layer; see backend/reasoning/explainer.py.)"""
        evidence = self.build_evidence(readings, event.timestamp)
        causes = self.rank_causes(evidence)
        action = self.recommend(causes, event.detection.anomaly_score)

        return AnalysisResult(
            schema_version=SCHEMA_VERSION,
            event_id=event.event_id,
            timestamp=event.timestamp,
            scenario_id=event.scenario_id,
            line_id=event.line_id,
            image_id=event.image_id,
            detection={
                "model": event.detection.model,
                "anomaly_score": event.detection.anomaly_score,
                "localization_ref": event.detection.localization_ref,
            },
            sensor_evidence=evidence,
            candidate_causes=causes,
            recommended_action=action,
        )
