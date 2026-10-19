"""Smoke tests — invoke the real uvicorn server over the network.

These tests boot a real ASGI server on a free port and exercise it via
``httpx``. They prove the documented endpoints work end-to-end on a
real socket, not just inside the FastAPI TestClient.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time

import httpx
import pytest

import uvicorn


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _Server(uvicorn.Server):
    def install_signal_handlers(self) -> None:  # noqa: D401
        # uvicorn installs SIGINT/SIGTERM handlers; not needed in tests
        pass


def _start_server(app):
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=_free_port(),
        log_level="warning",
        access_log=False,
    )
    server = _Server(config=config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    # Wait for ready
    for _ in range(80):
        if server.started:
            break
        time.sleep(0.05)
    return server, thread, config


def _stop_server(server: "_Server", thread: threading.Thread) -> None:  # type: ignore[name-defined]
    server.should_exit = True
    thread.join(timeout=5)


def test_real_uvicorn_server_serves_full_flow() -> None:
    # Imported here so the env-var override from conftest is honoured.
    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            r = c.get(f"{base}/api/v1/health")
            assert r.status_code == 200
            assert r.json()["status"] == "ok"
            r = c.post(f"{base}/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
            assert r.status_code == 200
            r = c.get(f"{base}/api/v1/events", params={"scenario_id": "thermal-drift-001"})
            assert r.status_code == 200
            assert len(r.json()) == 6
            r = c.get(
                f"{base}/api/v1/sensors",
                params={"scenario_id": "thermal-drift-001", "line_id": "line-01"},
            )
            assert r.status_code == 200
            assert len(r.json()) == 171
            r = c.get(f"{base}/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
            assert r.status_code == 200
            body = r.json()
            assert body["event_id"] == "evt-004"
            assert body["scenario_id"] == "thermal-drift-001"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_real_uvicorn_health_negative_case() -> None:
    """GET /api/v1/events without a scenario_id must fail."""
    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            r = c.get(f"{base}/api/v1/events")
            # FastAPI returns 422 for missing required query params
            assert r.status_code == 422
            r = c.post(f"{base}/api/v1/scenarios/start", json={"scenario_id": "nope-001"})
            assert r.status_code == 404
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_real_uvicorn_analysis_health_endpoint() -> None:
    """GET /api/v1/analysis/health must report LLM availability.

    The reasoning-layer readiness probe must not be captured by the
    /analysis/{event_id} catch-all (regression: 'health' must not be
    dispatched as an event_id).
    """
    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            r = c.get(f"{base}/api/v1/analysis/health")
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["status"] == "ok"
            assert "llm_available" in body
            assert "explainer_default" in body
            # Conftest unsets VFG_LLM_ENDPOINT, so the LLM must NOT be
            # available here; the deterministic explainer is the default.
            assert body["llm_available"] is False
            assert body["explainer_default"] == "deterministic"
            # P1 item 12: vision-backend readiness is part of the same call.
            assert body["vision_backend_ready"] is True
            assert body["vision_backend_kind"] != "none"
            assert body["vision_backend_error"] is None
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_real_uvicorn_health_reports_degraded_when_backend_init_fails() -> None:
    """P0-1: /health must reflect real readiness.

    When the vision backend fails to initialize, the server still boots so
    /health can report the failure — but the response must say ``degraded``
    and surface the error string instead of a lying ``ok``.
    """
    from backend.api import app as app_module
    from backend.api.app import create_app

    # Monkeypatch the resolver to raise so the lifespan catches the failure.
    original = app_module._resolve_vision_backend

    def _boom() -> None:
        raise RuntimeError("synthetic test failure: VFG_MVTEC_ROOT missing")

    app_module._resolve_vision_backend = _boom
    try:
        server, thread, config = _start_server(create_app())
        try:
            base = f"http://127.0.0.1:{config.port}"
            with httpx.Client(timeout=5.0) as c:
                r = c.get(f"{base}/api/v1/health")
                assert r.status_code == 200, r.text
                body = r.json()
                assert body["status"] == "degraded", body
                assert body["vision_backend_ready"] is False
                assert body["vision_backend_kind"] == "none"
                assert "VFG_MVTEC_ROOT missing" in (
                    body["vision_backend_error"] or ""
                )
                # ``events`` capability must be dropped when backend is gone.
                assert "events" not in body["capabilities"]
                # ``/api/v1/analysis/health`` must also report degraded.
                r2 = c.get(f"{base}/api/v1/analysis/health")
                assert r2.status_code == 200
                a_body = r2.json()
                assert a_body["status"] == "degraded"
                assert a_body["vision_backend_ready"] is False
                assert "VFG_MVTEC_ROOT missing" in (
                    a_body["vision_backend_error"] or ""
                )
        finally:
            server.should_exit = True
            thread.join(timeout=5)
    finally:
        app_module._resolve_vision_backend = original


def test_launcher_refuses_to_boot_without_fixture_dir() -> None:
    """P0-3: ``patchcore-lite`` must hard-fail when VFG_FIXTURE_ROOT is empty.

    Previously the launcher auto-generated synthetic fixtures so a clean
    checkout would boot — that path was removed because it would silently
    produce synthetic images in a production-misconfigured deploy.
    """
    import subprocess
    import sys

    env = {
        # Minimal env so the launcher parses cleanly; no AMD creds so the
        # reasoning layer stays offline. Path is inherited from the parent.
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "VFG_VISION_BACKEND": "patchcore-lite",
        "VFG_FIXTURE_ROOT": "/tmp/vfg-nonexistent-fixture-root-XXXXX",
        "VFG_SCENARIO": "thermal-drift-001",
        # Strip AMD creds so the launcher never reaches the network.
        "VFG_LLM_ENDPOINT": "",
        "VFG_LLM_API_KEY": "",
    }
    proc = subprocess.run(
        [sys.executable, "-m", "backend.api.server"],
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert proc.returncode != 0, proc.stdout + proc.stderr
    assert "VFG_FIXTURE_ROOT" in proc.stderr
    assert "python -m backend.vision.fixtures" in proc.stderr


def test_bearer_auth_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """P1-9/10: when VFG_API_BEARER_TOKEN is unset, endpoints stay open.

    Back-compat regression guard — the existing dev workflow must keep
    working without any token configured.
    """
    monkeypatch.delenv("VFG_API_BEARER_TOKEN", raising=False)
    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            # Mutating endpoint without token — must succeed (auth disabled).
            r = c.post(f"{base}/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
            assert r.status_code == 200, r.text
            # Analysis endpoint without token — must succeed.
            r = c.get(f"{base}/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
            assert r.status_code == 200, r.text
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_bearer_auth_enforced_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """P1-9/10: when VFG_API_BEARER_TOKEN is set, mutating endpoints require it.

    Read-only endpoints (``/events``, ``/sensors``, ``/health``, ``/analysis/health``)
    stay open so monitoring tools can poll them without a credential.
    """
    monkeypatch.setenv("VFG_API_BEARER_TOKEN", "test-secret-abc123")
    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            # No token → 401 on mutating endpoints.
            r = c.post(f"{base}/api/v1/scenarios/start", json={"scenario_id": "thermal-drift-001"})
            assert r.status_code == 401, r.text
            assert r.headers.get("www-authenticate") == "Bearer"
            r = c.post(f"{base}/api/v1/scenarios/stop", json={"scenario_id": "thermal-drift-001"})
            assert r.status_code == 401, r.text
            r = c.get(f"{base}/api/v1/analysis/evt-004?scenario_id=thermal-drift-001")
            assert r.status_code == 401, r.text
            # Wrong token → 401.
            r = c.get(
                f"{base}/api/v1/analysis/evt-004?scenario_id=thermal-drift-001",
                headers={"Authorization": "Bearer wrong-token"},
            )
            assert r.status_code == 401, r.text
            # Correct token → 200.
            r = c.get(
                f"{base}/api/v1/analysis/evt-004?scenario_id=thermal-drift-001",
                headers={"Authorization": "Bearer test-secret-abc123"},
            )
            assert r.status_code == 200, r.text
            # Read-only endpoints stay open.
            r = c.get(f"{base}/api/v1/health")
            assert r.status_code == 200, r.text
            r = c.get(f"{base}/api/v1/analysis/health")
            assert r.status_code == 200, r.text
            r = c.get(f"{base}/api/v1/events", params={"scenario_id": "thermal-drift-001"})
            assert r.status_code == 200, r.text
            r = c.get(
                f"{base}/api/v1/sensors",
                params={"scenario_id": "thermal-drift-001", "line_id": "line-01"},
            )
            assert r.status_code == 200, r.text
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_request_id_middleware_round_trips() -> None:
    """P1-13: every response carries X-Request-ID; an inbound header is preserved."""
    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            # No inbound id → server mints one.
            r = c.get(f"{base}/api/v1/health")
            assert "x-request-id" in r.headers
            assert len(r.headers["x-request-id"]) == 16  # token_hex(8)
            # Inbound id is preserved.
            r = c.get(
                f"{base}/api/v1/health",
                headers={"X-Request-ID": "client-correlation-1234"},
            )
            assert r.headers["x-request-id"] == "client-correlation-1234"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_analysis_handler_runs_llm_off_the_event_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """P1-6: a slow LLM call must not stall other concurrent requests.

    Patches the LLM client to sleep long enough that, if it ran on the
    event loop, a parallel ``/api/v1/health`` call would time out. The
    ``/health`` response must return well before the slow LLM would have
    finished, proving the heavy work was offloaded to a thread pool.
    """
    import time as _t

    from backend.api import app as app_module

    # Point the LLM client at a real, slow-to-respond endpoint: a local TCP
    # socket that accepts connections but never sends bytes. We patch
    # ``urllib.request.urlopen`` to sleep, simulating a stalled AMD call.
    import urllib.request as _ur

    class _SlowResp:
        def __init__(self):
            _t.sleep(1.5)  # longer than the 1.0s health timeout below

        def read(self):
            return b'{"choices":[{"message":{"content":"x"}}]}'

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def _slow(*a, **kw):
        return _SlowResp()

    monkeypatch.setenv("VFG_LLM_ENDPOINT", "http://127.0.0.1:1")
    monkeypatch.setenv("VFG_LLM_TIMEOUT", "5")
    monkeypatch.setattr(_ur, "urlopen", _slow)

    from backend.api.app import create_app

    server, thread, config = _start_server(create_app())
    try:
        base = f"http://127.0.0.1:{config.port}"
        with httpx.Client(timeout=5.0) as c:
            # Kick off the slow analysis in the background.
            import threading as _th

            result: dict = {}

            def _hit_analysis() -> None:
                r = c.get(
                    f"{base}/api/v1/analysis/evt-004",
                    params={"scenario_id": "thermal-drift-001"},
                )
                result["status"] = r.status_code

            t = _th.Thread(target=_hit_analysis)
            t.start()
            # Give the slow request a moment to enter the thread pool.
            _t.sleep(0.1)
            # While the LLM is blocked in the thread pool, the event loop
            # must still serve /health in well under the LLM's sleep.
            t0 = _t.monotonic()
            r = c.get(f"{base}/api/v1/health", timeout=1.0)
            elapsed = _t.monotonic() - t0
            assert r.status_code == 200, r.text
            assert elapsed < 0.5, (
                f"/health took {elapsed:.3f}s while a slow /analysis was "
                f"in flight — the LLM call is blocking the event loop"
            )
            t.join(timeout=5)
    finally:
        server.should_exit = True
        thread.join(timeout=5)