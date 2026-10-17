"""Uvicorn launcher.

Run with::

    python -m backend.api.server --backend synthetic --port 8000

The default ``--backend`` is read from ``VFG_VISION_BACKEND`` and
falls back to ``synthetic`` (no model training required).
"""
from __future__ import annotations

import argparse
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--backend",
        default=os.environ.get("VFG_VISION_BACKEND", "synthetic"),
        # ``auto`` and ``anomalib`` align with the environment-variable
        # selections supported by ``backend.api.app``. ``patchcore-lite``
        # and ``synthetic`` remain available as explicit fast paths.
        choices=["auto", "synthetic", "patchcore-lite", "anomalib"],
    )
    parser.add_argument("--fixture-root", default=os.environ.get("VFG_FIXTURE_ROOT", "data/fixtures"))
    parser.add_argument("--scenario", default=os.environ.get("VFG_SCENARIO", "thermal-drift-001"))
    args = parser.parse_args()

    os.environ["VFG_VISION_BACKEND"] = args.backend
    os.environ["VFG_FIXTURE_ROOT"] = args.fixture_root
    os.environ["VFG_SCENARIO"] = args.scenario

    if args.backend == "patchcore-lite" and not os.path.isdir(args.fixture_root):
        # Auto-generate fixture images on first run so a clean checkout
        # still boots. This is for the prototype only — replace with
        # real MVTec AD images for production evaluation.
        from backend.vision.fixtures import generate_for_scenario

        generate_for_scenario(args.scenario, root=args.fixture_root)

    uvicorn.run(
        "backend.api.app:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()