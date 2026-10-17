"""Integration tests for the /api/v1 endpoints.

These spin up the FastAPI app in-process via ``TestClient`` and exercise
the documented contract end-to-end. They run against both the synthetic
fixture backend (default) and the real PatchCore-lite backend when
fixture images exist.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _client():
    # Re-import per call so environment is fresh in subprocesses.
    from backend.api.app import create_app

    return TestClient(create_app())


def test_health_advertises_required_capabilities() -> None:
    with _client() as client:
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        for cap in ("scenarios", "events", "sensors", "analysis"):
            assert cap in body["capabilities"]


def test_scenario_start_returns_line_id() -> None:
    with _client() as client:
        r = client.post(
            "/api/v1/scenarios/start",
            json={"scenario_id": "thermal-drift-001"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["scenario_id"] == "thermal-drift-001"
        assert body["line_id"] == "line-01"


def test_scenario_start_unknown_returns_404() -> None:
    with _client() as client:
        r = client.post(
            "/api/v1/scenarios/start",
            json={"scenario_id": "nope-002"},
        )
        assert r.status_code == 404


def test_events_endpoint_returns_six_events() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/events", params={"scenario_id": "thermal-drift-001"})
        assert r.status_code == 200
        events = r.json()
        assert len(events) == 6
        ids = {e["event_id"] for e in events}
        assert ids == {f"evt-00{i}" for i in range(1, 7)}
        for e in events:
            assert e["schema_version"] == "1.0"
            assert e["source"] in {"public_dataset", "simulated", "real", "recorded"}
            assert e["timestamp"].endswith("Z")
            assert e["detection"] is not None
            assert e["detection"]["anomaly_score"] >= 0.0


def test_events_anomaly_score_separates_normal_and_flagged() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/events", params={"scenario_id": "thermal-drift-001"})
        events = r.json()
        # In the synthetic backend the lower bound of normal range is 0
        # and the upper bound of anomalous range is 1.0. All normal
        # events must be < 0.5 and all anomalous must be > 0.5.
        normals = [e for e in events if e["event_id"] in {"evt-001", "evt-002", "evt-003"}]
        flagged = [e for e in events if e["event_id"] in {"evt-004", "evt-005", "evt-006"}]
        for e in normals:
            assert e["detection"]["anomaly_score"] < 0.5, e
        for e in flagged:
            assert e["detection"]["anomaly_score"] > 0.5, e


def test_sensors_endpoint_returns_57_seconds_of_three_sensors() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get(
            "/api/v1/sensors",
            params={"scenario_id": "thermal-drift-001", "line_id": "line-01"},
        )
        assert r.status_code == 200
        records = r.json()
        assert len(records) == 57 * 3  # 0..56 inclusive, three sensors
        # First record should be at t=0
        first = next(rec for rec in records if rec["sensor_id"] == "temperature-01" and rec["timestamp"] == "2026-10-15T10:00:00Z")
        assert first["value"] == 64.0
        # First record after fault start (t=18) tagged with fault_state
        at18 = next(rec for rec in records if rec["sensor_id"] == "temperature-01" and rec["timestamp"] == "2026-10-15T10:00:18Z")
        assert at18["fault_state"] == "temperature_drift"


def test_sensors_rejects_wrong_line_id() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get(
            "/api/v1/sensors",
            params={"scenario_id": "thermal-drift-001", "line_id": "wrong-line"},
        )
        assert r.status_code == 404


def test_analysis_endpoint_includes_evidence_and_causes() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/analysis/evt-004")
        assert r.status_code == 200
        body = r.json()
        assert body["event_id"] == "evt-004"
        assert body["scenario_id"] == "thermal-drift-001"
        assert body["line_id"] == "line-01"
        # Three sensors -> three evidence items; each is a distinct, stable id
        # emitted by the analysis adapter from the live sensor stream.
        assert len(body["sensor_evidence"]) == 3
        assert any("temperature" in e["summary"] for e in body["sensor_evidence"])
        assert all(
            e["evidence_id"].startswith("evt-004-E") for e in body["sensor_evidence"]
        )
        assert len({e["evidence_id"] for e in body["sensor_evidence"]}) == 3
        assert len(body["candidate_causes"]) >= 1
        # The top-ranked cause must be grounded: it must reference one of the
        # evidence_ids that actually appears in sensor_evidence, never an
        # invented orphan id.
        valid_ids = {e["evidence_id"] for e in body["sensor_evidence"]}
        for c in body["candidate_causes"]:
            assert c["evidence_ids"], "candidate must reference evidence"
            assert all(eid in valid_ids for eid in c["evidence_ids"]), (
                f"orphan evidence id in {c}"
            )
            assert c["uncertainty"] in {"low", "medium", "high"}
        # The synthetic maintenance manual IS supplied for the integrated
        # scenario; the retrieval layer must surface traceable citations,
        # each with title, reference and excerpt. The reference must name
        # the section (and page when available).
        assert body["manual_citations"], "expected manual citations for evt-004"
        for m in body["manual_citations"]:
            assert m["title"]
            assert "Section" in m["reference"]
            assert m["excerpt"]
        # The recommended action must always require human review and never
        # assert certain machine action. The reasoning service emits text
        # that contains "Human review required".
        action = body["recommended_action"]
        assert action is not None
        assert "Human review required" in action or "human" in action.lower()


def test_analysis_endpoint_unknown_event_404() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.get("/api/v1/analysis/evt-999")
        assert r.status_code == 404


def test_stop_endpoint_returns_stopped() -> None:
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        r = client.post("/api/v1/scenarios/stop", json={"scenario_id": "thermal-drift-001"})
        assert r.status_code == 200
        assert r.json() == {"status": "stopped"}


def test_events_and_sensors_identical_across_two_runs() -> None:
    """Replay determinism: same scenario, same responses."""
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        e1 = client.get("/api/v1/events", params={"scenario_id": "thermal-drift-001"}).json()
        s1 = client.get(
            "/api/v1/sensors",
            params={"scenario_id": "thermal-drift-001", "line_id": "line-01"},
        ).json()
    with _client() as client:
        client.post("/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
        e2 = client.get("/api/v1/events", params={"scenario_id": "thermal-drift-001"}).json()
        s2 = client.get(
            "/api/v1/sensors",
            params={"scenario_id": "thermal-drift-001", "line_id": "line-01"},
        ).json()
    assert e1 == e2
    assert s1 == s2


def test_request_validation_rejects_malformed_payload() -> None:
    with _client() as client:
        r = client.post("/api/v1/scenarios/start", json={})
        assert r.status_code == 422
        r = client.post("/api/v1/scenarios/start", json={"scenario_id": ""})
        assert r.status_code == 422
        r = client.post("/api/v1/scenarios/stop", json={"scenario_id": "x", "extra": True})
        assert r.status_code == 422


@pytest.mark.skipif(
    not Path("data/fixtures/thermal-drift-001/normal_0000.png").exists(),
    reason="fixture images not generated",
)
def test_patchcore_lite_backend_end_to_end(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VFG_VISION_BACKEND", "patchcore-lite")
    monkeypatch.setenv("VFG_FIXTURE_ROOT", "data/fixtures")
    # Re-create the app after env change so the lifespan picks the right backend.
    from importlib import reload
    import backend.api.app as app_mod
    reload(app_mod)
    with TestClient(app_mod.create_app()) as client:
        r = client.get("/api/v1/events", params={"scenario_id": "thermal-drift-001"})
        assert r.status_code == 200
        events = r.json()
        for e in events:
            assert e["detection"]["model"] == "patchcore-lite-cpu"