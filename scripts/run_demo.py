#!/usr/bin/env python3
"""End-to-end demo runner.

Runs the full visual-factory-guardian pipeline against the in-process
FastAPI app and prints every JSON response the frontend will receive.

Usage::

    # synthetic fixture backend (default — no model training required)
    PYTHONPATH=. python scripts/run_demo.py

    # real PatchCore-lite backend (requires fixture images on disk)
    PYTHONPATH=. python scripts/run_demo.py --backend patchcore-lite

The script never touches the network — it uses FastAPI's ``TestClient``
under the hood so it can run in a clean container without uvicorn.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend",
        default=os.environ.get("VFG_VISION_BACKEND", "auto"),
        choices=["auto", "synthetic", "patchcore-lite", "anomalib"],
    )
    parser.add_argument("--fixture-root", default="data/fixtures")
    args = parser.parse_args()

    os.environ["VFG_VISION_BACKEND"] = args.backend
    os.environ["VFG_FIXTURE_ROOT"] = args.fixture_root
    if not Path(args.fixture_root).exists() and args.backend == "patchcore-lite":
        print(f"Generating synthetic fixtures under {args.fixture_root} …", file=sys.stderr)
        from backend.vision.fixtures import generate_for_scenario

        generate_for_scenario("thermal-drift-001")

    from fastapi.testclient import TestClient

    from backend.api.app import create_app

    with TestClient(create_app()) as client:
        for title, method, path, body, params in [
            ("HEALTH", "GET", "/api/v1/health", None, None),
            (
                "START",
                "POST",
                "/api/v1/scenarios/start",
                {"scenario_id": "thermal-drift-001"},
                None,
            ),
            (
                "EVENTS",
                "GET",
                "/api/v1/events",
                None,
                {"scenario_id": "thermal-drift-001"},
            ),
            (
                "SENSORS",
                "GET",
                "/api/v1/sensors",
                None,
                {"scenario_id": "thermal-drift-001", "line_id": "line-01"},
            ),
            (
                "ANALYSIS evt-004 (anomalous)",
                "GET",
                "/api/v1/analysis/evt-004",
                None,
                {"scenario_id": "thermal-drift-001"},
            ),
            (
                "ANALYSIS evt-001 (normal)",
                "GET",
                "/api/v1/analysis/evt-001",
                None,
                {"scenario_id": "thermal-drift-001"},
            ),
            (
                "STOP",
                "POST",
                "/api/v1/scenarios/stop",
                {"scenario_id": "thermal-drift-001"},
                None,
            ),
        ]:
            print(f"\n=== {title}  {method} {path} ===")
            if method == "GET":
                resp = client.get(path, params=params or {})
            else:
                resp = client.post(path, json=body)
            print(f"status={resp.status_code}")
            try:
                data = resp.json()
            except Exception:
                print(resp.text)
                continue
            if isinstance(data, list) and len(data) > 6:
                print(f"(showing 3 of {len(data)} records)")
                print(json.dumps(data[:3], indent=2))
                print(f"…{len(data) - 3} more")
            else:
                print(json.dumps(data, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())