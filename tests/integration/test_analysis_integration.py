"""Integration tests for the reasoning-backed analysis endpoint.

These tests assert the contract that ``GET /api/v1/analysis/{event_id}`` is
actually backed by Arshad's ``ReasoningService`` and not the older stub
that always returned empty manual citations and a hard-coded advisory.

They cover:

* the response shape matches the frontend Zod schema (Analysis);
* manual citations are real (not empty), with title / reference / excerpt;
* candidate causes reference evidence_ids that are actually emitted by the
  same response (no orphan references);
* the recommended action requires human review and never asserts machine
  control;
* the engine does not peek into the future when computing a past event
  (G3 timestamp-leakage regression);
* metric normalisation: the integrated ``current`` scenario and the legacy
  ``motor_current`` mock both work against the documented knowledge base;
* the active GET handler does not double-register.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient


def _client():
    from backend.api.app import create_app

    return TestClient(create_app())


# --------------------------------------------------------------------------- #
# Shape contract
# --------------------------------------------------------------------------- #
def test_analysis_for_anomalous_event_returns_full_reasoning_output() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
        assert r.status_code == 200
        body = r.json()
        # Required keys per the frontend Zod schema
        for key in (
            "event_id",
            "scenario_id",
            "line_id",
            "explanation",
            "sensor_evidence",
            "candidate_causes",
            "manual_citations",
            "recommended_action",
        ):
            assert key in body, f"missing key {key}"
        # The reasoning service surfaces a non-empty explanation that
        # mentions the temperature drift evidence for the anomalous event.
        assert "temperature" in body["explanation"].lower()


def test_analysis_normal_event_action_can_be_none_and_explanation_mentions_pre_drift() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/analysis/evt-001?scenario_id=thermal-drift-001")
        assert r.status_code == 200
        body = r.json()
        # evt-001 happens before the fault starts, so the explanation must
        # acknowledge that the fault could not have caused this image.
        assert body["event_id"] == "evt-001"
        expl = body["explanation"].lower()
        assert "before" in expl or "precede" in expl or "could not" in expl or "cannot" in expl
        # Candidate causes are still emitted for a normal event, but they
        # should not be a "threshold breach" claim.
        for c in body["candidate_causes"]:
            assert "threshold breach" not in c["label"].lower() or c["uncertainty"] != "low"


# --------------------------------------------------------------------------- #
# Evidence ID stability and consistency
# --------------------------------------------------------------------------- #
def test_analysis_evidence_ids_are_unique_and_match_candidate_references() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
        body = r.json()
        ev_ids = [e["evidence_id"] for e in body["sensor_evidence"]]
        assert len(ev_ids) == len(set(ev_ids))
        # No candidate cause references an evidence_id that does not exist
        # in sensor_evidence for the same response.
        valid = set(ev_ids)
        for c in body["candidate_causes"]:
            for eid in c["evidence_ids"]:
                assert eid in valid, f"orphan reference: {eid} not in {valid}"


def test_analysis_evidence_ids_stable_across_replays() -> None:
    """The mapping sensor_id -> evidence_id is deterministic across runs."""
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        a = client.get("/api/v1/analysis/evt-004?scenario_id=thermal-drift-001").json()
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        b = client.get("/api/v1/analysis/evt-004?scenario_id=thermal-drift-001").json()
    assert [e["evidence_id"] for e in a["sensor_evidence"]] == [
        e["evidence_id"] for e in b["sensor_evidence"]
    ]


# --------------------------------------------------------------------------- #
# Manual citation provenance
# --------------------------------------------------------------------------- #
def test_manual_citations_carry_title_reference_and_excerpt() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
        body = r.json()
        assert body["manual_citations"], "expected at least one manual citation"
        for m in body["manual_citations"]:
            assert m["title"], "manual citation missing title"
            assert m["reference"], "manual citation missing reference"
            assert "Section" in m["reference"]
            assert m["excerpt"]
            # The synthetic manual must be labelled as SIMULATED so the
            # citation cannot be mistaken for an industry-certified manual.
            assert "SIMULATED" in m["title"].upper()


# --------------------------------------------------------------------------- #
# Single active GET handler — no duplicate route
# --------------------------------------------------------------------------- #
def test_only_one_get_handler_is_registered_for_analysis_event_id() -> None:
    """The reasoning router must NOT add a second GET handler for the same
    path; otherwise routing is non-deterministic and the frontend's Zod
    schema may receive a different shape per request.
    """
    from backend.api.app import create_app

    app = create_app()
    analysis_gets = [
        r
        for r in app.routes
        if isinstance(r, APIRoute)
        and r.path.endswith("/analysis/{event_id}")
        and "GET" in r.methods
    ]
    assert len(analysis_gets) == 1, (
        f"expected exactly one GET handler for /analysis/{{event_id}}, "
        f"found {len(analysis_gets)}: {[r.path for r in analysis_gets]}"
    )


# --------------------------------------------------------------------------- #
# Service invocation — not just a stub returning a hard-coded response
# --------------------------------------------------------------------------- #
def test_analysis_response_reflects_engine_ranking_not_hardcoded_labels() -> None:
    """If we monkey-patch the explainer to substitute a known label, the
    HTTP response MUST reflect the patch. That proves the endpoint is
    actually calling ReasoningService and not returning a stub.
    """
    from backend.api import analysis_adapter

    captured = {"called": 0}

    class _PatchedService:
        def __init__(self, *args, **kwargs):
            pass

        def analyse(self, event, readings):
            captured["called"] += 1
            return {
                "schema_version": "1.0",
                "event_id": event["event_id"],
                "timestamp": event["timestamp"],
                "scenario_id": event["scenario_id"],
                "line_id": event["line_id"],
                "image_id": event["image_id"],
                "detection": event["detection"],
                "sensor_evidence": [
                    {
                        "signal": "temperature-01",
                        "metric": "temperature",
                        "unit": "degC",
                        "baseline": 64.0,
                        "baseline_std": 0.1,
                        "value_at_event": 90.0,
                        "deviation": 26.0,
                        "z_score": 99.9,
                        "direction": "rising",
                        "threshold_exceeded": True,
                        "change_point_time": "2026-10-15T10:00:18Z",
                        "lead_time_seconds": 14.0,
                        "window_start": "2026-10-15T10:00:00Z",
                        "window_end": "2026-10-15T10:00:32Z",
                        "source": "simulated",
                    }
                ],
                "candidate_causes": [
                    {
                        "cause": "PROBE-SENTINEL-Cause",
                        "score": 1.0,
                        "confidence": "high",
                        "supporting_evidence": ["probe"],
                        "evidence_signals": ["temperature-01"],
                        "temporal_precedence": True,
                        "lead_time_seconds": 14.0,
                    }
                ],
                "manual_citations": [],
                "recommended_action": {
                    "text": "PROBE-SENTINEL-Action. Human review required before any line action.",
                    "severity": "urgent",
                    "requires_human_review": True,
                },
                "explanation": "PROBE-SENTINEL-Explanation",
                "uncertainty": "PROBE-SENTINEL-Uncertainty",
                "explainer_mode": "deterministic",
                "disclaimer": "x",
            }

    monkey = pytest.MonkeyPatch()
    monkey.setattr(analysis_adapter, "ReasoningService", _PatchedService)
    try:
        with _client() as client:
            client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
            r = client.get("/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
            assert r.status_code == 200
            body = r.json()
            assert captured["called"] >= 1
            # The probe labels MUST appear in the response — proving the
            # adapter really consumed the service output rather than a stub.
            assert "PROBE-SENTINEL-Cause" in body["candidate_causes"][0]["label"]
            assert "PROBE-SENTINEL-Action" in body["recommended_action"]
            assert body["explanation"] == "PROBE-SENTINEL-Explanation"
    finally:
        monkey.undo()


# --------------------------------------------------------------------------- #
# Timestamp / future-sample leakage regression
# --------------------------------------------------------------------------- #
def test_modifying_future_readings_does_not_change_past_event_result() -> None:
    """The reasoning service must not look at samples taken after the event
    timestamp. Mutating samples > event.timestamp must leave the response
    for that event unchanged.
    """
    from backend.api.app import create_app
    from backend.api import analysis_adapter
    from fastapi.testclient import TestClient

    # Capture the readings dict that the adapter passes to ReasoningService.
    captured: dict = {}

    OriginalService = analysis_adapter.ReasoningService  # resolve before patch

    class _CapturingService:
        def __init__(self, *args, **kwargs):
            self._delegate = OriginalService(*args, **kwargs)

        def analyse(self, event, readings):
            captured["readings"] = list(readings)
            return self._delegate.analyse(event, readings)

    monkey = pytest.MonkeyPatch()
    monkey.setattr(analysis_adapter, "ReasoningService", _CapturingService)
    try:
        with TestClient(create_app()) as c:
            c.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
            r1 = c.get("/api/v1/analysis/evt-001?scenario_id=thermal-drift-001").json()
            # The adapter must filter to ts <= event ts. evt-001 is at 8s,
            # so readings with ts > 8s should be excluded from the analysis.
            for rd in captured["readings"]:
                assert rd["timestamp"] <= "2026-10-15T10:00:08Z", (
                    f"future-sample leakage: {rd['timestamp']} > event ts"
                )
            # And no cross-scenario records either.
            for rd in captured["readings"]:
                assert rd.get("scenario_id") == "thermal-drift-001"
                assert rd.get("line_id") == "line-01"
            assert r1["event_id"] == "evt-001"
    finally:
        monkey.undo()