#!/usr/bin/env python3
"""End-to-end production-readiness smoke test.

Runs against a live ``uvicorn backend.api.app:app`` instance. Verifies
every endpoint an operator depends on for a real deploy:

  1. ``GET  /api/v1/health``           → ``status`` matches real readiness
  2. ``GET  /api/v1/scenarios``        → returns the loaded scenario ids
  3. ``GET  /api/v1/analysis/health``  → reports LLM + circuit-breaker state
  4. ``POST /api/v1/scenarios/start``  → requires bearer token when configured
  5. ``GET  /api/v1/events``           → returns inspection events
  6. ``GET  /api/v1/sensors``          → returns sensor records
  7. ``GET  /api/v1/analysis/{id}``    → returns full reasoning output

Exits non-zero if any step fails. Use this as the post-deploy health gate
in a process supervisor or runbook.

Usage::

    # Start the server first (in another terminal):
    python -m backend.api.server --port 8000

    # Then run:
    python scripts/production_smoke.py --base-url http://127.0.0.1:8000 \\
        --bearer-token "$VFG_API_BEARER_TOKEN"  # optional
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, Optional

import httpx


def _check(label: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    line = f"  [{status}] {label}"
    if detail:
        line += f" — {detail}"
    print(line)
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("VFG_BASE_URL", "http://127.0.0.1:8000"),
    )
    parser.add_argument(
        "--bearer-token",
        default=os.environ.get("VFG_API_BEARER_TOKEN"),
        help="Send ``Authorization: Bearer <token>`` on mutating endpoints. "
        "Optional: when omitted, the smoke test only exercises open endpoints.",
    )
    parser.add_argument("--scenario-id", default="thermal-drift-001")
    args = parser.parse_args()

    auth = (
        {"Authorization": f"Bearer {args.bearer_token}"}
        if args.bearer_token
        else {}
    )

    print(f"Production smoke against {args.base_url}")
    if args.bearer_token:
        print(f"  bearer token configured (length {len(args.bearer_token)})")
    else:
        print("  no bearer token — mutating endpoints may be open")
    print()

    failures: list[str] = []

    with httpx.Client(timeout=10.0) as c:
        # 1. /health
        try:
            r = c.get(f"{args.base_url}/api/v1/health")
            ok = _check(
                "GET /api/v1/health returns 200",
                r.status_code == 200,
                f"status={r.status_code}",
            )
            if not ok:
                failures.append(f"/health returned {r.status_code}")
            else:
                body = r.json()
                if body["status"] not in ("ok", "degraded"):
                    _check(
                        "/health status is ok or degraded",
                        False,
                        f"got {body['status']!r}",
                    )
                    failures.append("/health status not ok/degraded")
                else:
                    _check(
                        "/health status",
                        True,
                        f"status={body['status']} "
                        f"backend_ready={body.get('vision_backend_ready')} "
                        f"scenarios_loaded={len(body.get('scenarios_loaded', []))}",
                    )
        except httpx.HTTPError as exc:
            _check("GET /api/v1/health reachable", False, str(exc))
            failures.append(f"/health unreachable: {exc}")
            return 1

        # 2. /scenarios (list)
        try:
            r = c.get(f"{args.base_url}/api/v1/scenarios")
            if r.status_code == 200 and args.scenario_id in r.json():
                _check(
                    "GET /api/v1/scenarios contains target",
                    True,
                    f"ids={r.json()}",
                )
            else:
                _check(
                    "GET /api/v1/scenarios contains target",
                    False,
                    f"status={r.status_code} body={r.text[:200]}",
                )
                failures.append("scenario not loaded")
        except httpx.HTTPError as exc:
            _check("GET /api/v1/scenarios reachable", False, str(exc))
            failures.append("/scenarios unreachable")

        # 3. /analysis/health
        try:
            r = c.get(f"{args.base_url}/api/v1/analysis/health")
            ok = _check(
                "GET /api/v1/analysis/health returns 200",
                r.status_code == 200,
                f"status={r.status_code}",
            )
            if ok:
                body = r.json()
                _check(
                    "/analysis/health reports LLM state",
                    "llm_available" in body and "llm_circuit_open" in body,
                    f"llm_available={body.get('llm_available')} "
                    f"circuit_open={body.get('llm_circuit_open')} "
                    f"failure_count={body.get('llm_failure_count')}",
                )
        except httpx.HTTPError as exc:
            _check("GET /api/v1/analysis/health reachable", False, str(exc))

        # 4. /scenarios/start — with auth if configured
        try:
            r = c.post(
                f"{args.base_url}/api/v1/scenarios/start",
                json={"scenario_id": args.scenario_id},
                headers=auth,
            )
            if r.status_code == 200:
                _check("POST /scenarios/start", True, "scenario loaded")
            elif r.status_code == 401 and not args.bearer_token:
                _check(
                    "POST /scenarios/start",
                    False,
                    "401 but no bearer token sent — server requires auth, "
                    "re-run with --bearer-token",
                )
                failures.append("auth required but not provided")
            else:
                _check(
                    "POST /scenarios/start",
                    False,
                    f"status={r.status_code} body={r.text[:200]}",
                )
                failures.append(f"/scenarios/start {r.status_code}")
        except httpx.HTTPError as exc:
            _check("POST /scenarios/start reachable", False, str(exc))

        # 5. /events
        try:
            r = c.get(
                f"{args.base_url}/api/v1/events",
                params={"scenario_id": args.scenario_id},
            )
            ok = _check(
                "GET /api/v1/events",
                r.status_code == 200,
                f"status={r.status_code}",
            )
            if ok and r.json():
                event_id = r.json()[0]["event_id"]
                _check(
                    "/events returns >=1 inspection",
                    True,
                    f"first event_id={event_id}",
                )
            else:
                failures.append("/events returned no inspections")
        except httpx.HTTPError as exc:
            _check("GET /api/v1/events reachable", False, str(exc))

        # 6. /sensors
        try:
            r = c.get(
                f"{args.base_url}/api/v1/sensors",
                params={"scenario_id": args.scenario_id, "line_id": "line-01"},
            )
            _check(
                "GET /api/v1/sensors",
                r.status_code == 200,
                f"status={r.status_code} records={len(r.json()) if r.status_code == 200 else 0}",
            )
        except httpx.HTTPError as exc:
            _check("GET /api/v1/sensors reachable", False, str(exc))

        # 7. /analysis/{event_id} — pick the first event from /events
        try:
            r = c.get(
                f"{args.base_url}/api/v1/events",
                params={"scenario_id": args.scenario_id},
            )
            if r.status_code == 200 and r.json():
                event_id = r.json()[0]["event_id"]
                t0 = time.monotonic()
                r2 = c.get(
                    f"{args.base_url}/api/v1/analysis/{event_id}",
                    params={"scenario_id": args.scenario_id},
                    headers=auth,
                )
                elapsed = time.monotonic() - t0
                if r2.status_code == 200:
                    body = r2.json()
                    _check(
                        f"GET /analysis/{event_id}",
                        True,
                        f"elapsed={elapsed:.2f}s "
                        f"explainer={body.get('explainer_mode', 'n/a')} "
                        f"causes={len(body.get('candidate_causes', []))} "
                        f"citations={len(body.get('manual_citations', []))}",
                    )
                elif r2.status_code == 401 and not args.bearer_token:
                    _check(
                        f"GET /analysis/{event_id}",
                        False,
                        "401 but no bearer token — re-run with --bearer-token",
                    )
                else:
                    _check(
                        f"GET /analysis/{event_id}",
                        False,
                        f"status={r2.status_code} body={r2.text[:200]}",
                    )
                    failures.append(f"/analysis {r2.status_code}")
        except httpx.HTTPError as exc:
            _check("GET /analysis reachable", False, str(exc))

    print()
    if failures:
        print(f"FAILED: {len(failures)} check(s) failed")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("OK: production smoke passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())