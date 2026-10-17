"""Adapter that converts ``ReasoningService`` output into the frontend's
``Analysis`` schema shape.

The reasoning layer returns a rich ``AnalysisResult.to_dict()`` with detailed
evidence, ranked causes, manual citations, recommended action, explanation,
uncertainty and explainer mode. The frontend's Zod validator expects a
narrower shape:

    {
      event_id, scenario_id, line_id,
      explanation: str,
      sensor_evidence: [{evidence_id, metric, summary}],
      candidate_causes: [{label, evidence_ids, uncertainty}],
      manual_citations: [{title, reference, excerpt}],
      recommended_action: str | None
    }

This module is the single place that knows both shapes. It is the ONLY
output mapping the integration uses for ``GET /api/v1/analysis/{event_id}``.
No duplicate analysis routes are exposed; the endpoint here replaces the
older deterministic stub and is backed by Arshad's ``ReasoningService``.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Iterable, List, Optional, Tuple

from ..reasoning.service import ReasoningService
from ..root_cause.schema import SensorReading, InspectionEvent

_log = logging.getLogger("vfg.analysis_adapter")


# --------------------------------------------------------------------------- #
# Stable, distinct evidence_ids keyed by (event_id, sensor_id) so the API and
# the frontend agree on identifiers regardless of execution order.
# --------------------------------------------------------------------------- #
def _evidence_ids_for(event_id: str, sensor_ids: Iterable[str]) -> Dict[str, str]:
    """Return a deterministic ``sensor_id -> evidence_id`` mapping."""
    out: Dict[str, str] = {}
    for idx, sensor_id in enumerate(sorted(set(sensor_ids)), start=1):
        out[sensor_id] = f"{event_id}-E{idx:02d}"
    return out


def _build_summary(ev: Dict[str, Any]) -> str:
    """Produce a single-line, operator-facing evidence summary.

    Keeps the units and z-score so the dashboard can render the same string
    verbatim; avoids any LLM verbalisation here.
    """
    metric = ev.get("metric", "")
    value = ev.get("value_at_event", "")
    unit = ev.get("unit", "")
    baseline = ev.get("baseline", "")
    deviation = float(ev.get("deviation", 0.0))
    z_score = ev.get("z_score", 0)
    direction = ev.get("direction", "stable")

    summary = (
        f"{metric} {value}{unit} "
        f"(baseline {baseline}{unit}, Δ={deviation:+.2f}{unit}, "
        f"z={z_score}, dir={direction}"
    )
    if ev.get("threshold_exceeded"):
        summary += ", threshold exceeded"
    lead = ev.get("lead_time_seconds")
    if isinstance(lead, (int, float)) and lead is not None:
        if lead > 0:
            summary += f", preceded event by {lead:.0f}s"
        elif lead <= 0 and direction != "stable":
            summary += f", change after event ({lead:.0f}s)"
    summary += ")"
    return summary


def _filter_readings_for_event(
    readings: List[Dict[str, Any]],
    *,
    scenario_id: str,
    line_id: str,
    event_ts: str,
) -> List[Dict[str, Any]]:
    """Restrict readings to the matching scenario/line and to the historical
    window (timestamp <= event timestamp).

    The reasoning service computes baselines from the supplied stream. In a
    live investigation we must not leak samples from after the event into the
    baseline or change-point statistics — that would let modifying the future
    change the verdict about the past. Also restrict by scenario_id/line_id
    so a multi-scenario registry never mixes streams.
    """
    from datetime import datetime
    try:
        if event_ts.endswith("Z"):
            event_ts = event_ts[:-1] + "+00:00"
        event_dt = datetime.fromisoformat(event_ts)
    except ValueError:
        event_dt = None

    out: List[Dict[str, Any]] = []
    for r in readings:
        if r.get("scenario_id") and r.get("scenario_id") != scenario_id:
            continue
        if r.get("line_id") and r.get("line_id") != line_id:
            continue
        ts = r.get("timestamp")
        if event_dt is not None and ts:
            try:
                if ts.endswith("Z"):
                    ts_norm = ts[:-1] + "+00:00"
                else:
                    ts_norm = ts
                if datetime.fromisoformat(ts_norm) > event_dt:
                    continue
            except ValueError:
                continue
        out.append(r)
    return out


def _to_frontend_analysis(
    *,
    event_id: str,
    scenario_id: str,
    line_id: str,
    service_result: Dict[str, Any],
    sensor_id_to_evidence: Dict[str, str],
) -> Dict[str, Any]:
    """Map ``ReasoningService.analyse()`` output to the frontend Analysis shape.

    - ``sensor_evidence``: stable ``evidence_id`` per sensor; one item per
      sensor with a short operator-facing summary. The ``metric`` field
      preserves the original (un-aliased) sensor metric so the dashboard can
      label rows consistently.
    - ``candidate_causes``: ``label`` mirrors the service ``cause``;
      ``evidence_ids`` are filtered to IDs that exist in
      ``sensor_evidence`` (no orphan references); ``uncertainty`` reports
      the service's qualitative confidence, never a calibrated probability.
    - ``manual_citations``: always populated from the retrieval index; if
      retrieval legitimately returns nothing, the list is ``[]`` (the
      frontend already handles an empty list explicitly).
    - ``recommended_action``: the service text, or ``None`` when no signal
      shifted around the event. The service text always asserts
      ``Human review required``; the action never triggers machine control.
    """
    evidence_items = service_result.get("sensor_evidence", [])
    sensor_ids_in_order: List[str] = []
    seen_signal = set()
    for ev in evidence_items:
        sid = ev.get("signal", "")
        if sid and sid not in seen_signal:
            seen_signal.add(sid)
            sensor_ids_in_order.append(sid)
    if not sensor_ids_in_order:
        sensor_ids_in_order = sorted(sensor_id_to_evidence.keys())

    # If the service returned evidence for sensors that weren't in the
    # mapping (e.g. registered after the adapter was constructed), append
    # them so every evidence_id is still unique and stable.
    for ev in evidence_items:
        sid = ev.get("signal", "")
        if sid and sid not in sensor_id_to_evidence:
            sensor_id_to_evidence[sid] = f"{event_id}-E{len(sensor_id_to_evidence) + 1:02d}"
    id_by_signal = dict(sensor_id_to_evidence)

    sensor_evidence_payload: List[Dict[str, Any]] = []
    for ev in evidence_items:
        sid = ev.get("signal", "")
        ev_id = id_by_signal.get(sid)
        if ev_id is None:
            continue
        sensor_evidence_payload.append(
            {
                "evidence_id": ev_id,
                "metric": ev.get("metric", ""),
                "summary": _build_summary(ev),
            }
        )

    valid_ids = {item["evidence_id"] for item in sensor_evidence_payload}
    candidate_payload: List[Dict[str, Any]] = []
    for c in service_result.get("candidate_causes", []):
        cause_text = c.get("cause", "")
        signals = c.get("evidence_signals", []) or []
        eids: List[str] = []
        for s in signals:
            mapped = id_by_signal.get(s)
            if mapped and mapped in valid_ids and mapped not in eids:
                eids.append(mapped)
        candidate_payload.append(
            {
                "label": cause_text,
                "evidence_ids": eids,
                # The service exposes a qualitative confidence label
                # (low/medium/high) and a ranking score. Per the contract
                # we surface the confidence, never the raw score, as
                # ``uncertainty`` — ranking scores are not calibrated
                # probabilities.
                "uncertainty": c.get("confidence", "low"),
            }
        )

    citations_payload: List[Dict[str, Any]] = []
    for m in service_result.get("manual_citations", []) or []:
        source = m.get("source", "")
        section = m.get("section", "")
        page = m.get("page")
        reference = f"Section {section}" if section else source
        if page is not None:
            reference = f"{reference}, p.{page}"
        citations_payload.append(
            {
                "title": source,
                "reference": reference,
                "excerpt": m.get("snippet", ""),
            }
        )

    action_obj = service_result.get("recommended_action") or {}
    action_text = action_obj.get("text") if isinstance(action_obj, dict) else None

    return {
        "event_id": event_id,
        "scenario_id": scenario_id,
        "line_id": line_id,
        "explanation": service_result.get("explanation", ""),
        "sensor_evidence": sensor_evidence_payload,
        "candidate_causes": candidate_payload,
        "manual_citations": citations_payload,
        "recommended_action": action_text,
    }


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def build_analysis_payload(
    *,
    event_id: str,
    scenario_id: str,
    line_id: str,
    event_timestamp: str,
    event_dict: Dict[str, Any],
    readings: List[Dict[str, Any]],
    sensor_id_to_evidence: Optional[Dict[str, str]] = None,
    prefer_llm: Optional[bool] = None,
    service: Optional[ReasoningService] = None,
) -> Dict[str, Any]:
    """Run the reasoning service and adapt its output to the frontend shape.

    ``sensor_id_to_evidence`` is the optional pre-computed mapping from the
    live sensor stream (used by the API handler so the evidence_ids line up
    with the live ``/events`` data). When omitted, IDs are generated from the
    service output in alphabetical order of ``sensor_id``.
    """
    if prefer_llm is None:
        prefer_llm = os.environ.get("VFG_LLM_ENDPOINT", "").strip() != ""
    service_obj = service or ReasoningService(prefer_llm=prefer_llm)

    # Filter the live stream before it reaches the statistical engine to
    # avoid future-sample leakage and cross-scenario contamination.
    safe_readings = _filter_readings_for_event(
        readings,
        scenario_id=scenario_id,
        line_id=line_id,
        event_ts=event_timestamp,
    )

    # Materialise the IDs in advance so the same mapping is reused after the
    # service runs (the service re-emits them, but we keep this as the source
    # of truth for stability).
    if sensor_id_to_evidence is None:
        ids = sorted({r.get("sensor_id", "") for r in safe_readings if r.get("sensor_id")})
        sensor_id_to_evidence = _build_stable_ids(event_id, ids)

    service_result = service_obj.analyse(event_dict, safe_readings)

    return _to_frontend_analysis(
        event_id=event_id,
        scenario_id=scenario_id,
        line_id=line_id,
        service_result=service_result,
        sensor_id_to_evidence=sensor_id_to_evidence,
    )


def _build_stable_ids(event_id: str, sensor_ids: List[str]) -> Dict[str, str]:
    return _evidence_ids_for(event_id, sensor_ids)


def build_sensor_id_to_evidence(
    event_id: str, sensor_records: Iterable[Dict[str, Any]]
) -> Dict[str, str]:
    """Build the stable mapping from the live sensor stream (no API calls)."""
    ids = sorted(
        {
            r.get("sensor_id", "")
            for r in sensor_records
            if r.get("sensor_id")
        }
    )
    return _evidence_ids_for(event_id, ids)


__all__ = [
    "build_analysis_payload",
    "build_sensor_id_to_evidence",
]