"""Smoke tests — invoke the real uvicorn server over the network.

These tests boot a real ASGI server on a free port and exercise it via
``httpx``. They prove the documented endpoints work end-to-end on a
real socket, not just inside the FastAPI TestClient.
"""
from __future__ import annotations

import socket
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
            r = c.get(f"{base}/api/v1/analysis/evt-004")
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