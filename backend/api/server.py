"""Uvicorn launcher.

Run with::

    python -m backend.api.server --backend synthetic --port 8000

The default ``--backend`` is read from ``VFG_VISION_BACKEND`` and
falls back to ``synthetic`` (no model training required).

A project-root ``.env`` is loaded automatically so AMD LLM credentials and
vision backend choices made there take effect without ``export``-ing them
in the shell. CLI flags always win over ``.env`` and over the current
process environment.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import uvicorn


def _load_dotenv(path: Path) -> None:
    """Tiny .env loader — set vars only if not already in the environment.

    Existing process env wins, so ``export VFG_LLM_API_KEY=...`` in the
    shell still overrides .env. Comments and blank lines are ignored.
    """
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    _load_dotenv(repo_root / ".env")

    # Configure root logging once, here, so the ``logging.info(...)`` calls
    # in ``_resolve_vision_backend`` and elsewhere actually surface.
    # Operators control verbosity with ``VFG_LOG_LEVEL`` (default INFO).
    # Without this, uvicorn's own access log appears but the backend's
    # AMD-detect / scenario-resolution messages are invisible.
    import logging as _logging

    _logging.basicConfig(
        level=os.environ.get("VFG_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

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

    # ``patchcore-lite`` requires real fixture images on disk. We refuse to
    # boot rather than silently auto-generate synthetic ones — auto-generation
    # would produce images that look like real data but are not, and there is
    # no way for a downstream consumer to tell the difference. The fixture
    # generator remains available as a CLI for development:
    #     python -m backend.vision.fixtures --scenario thermal-drift-001
    if args.backend == "patchcore-lite" and not os.path.isdir(args.fixture_root):
        raise SystemExit(
            f"VFG_VISION_BACKEND=patchcore-lite requires VFG_FIXTURE_ROOT to "
            f"point at a populated fixture directory. Got {args.fixture_root!r} "
            f"which does not exist. To create fixtures for development run:\n"
            f"    python -m backend.vision.fixtures "
            f"--scenario {args.scenario} --root {args.fixture_root}\n"
            f"For production use, point VFG_FIXTURE_ROOT at real MVTec AD "
            f"images or switch to VFG_VISION_BACKEND=anomalib with "
            f"VFG_MVTEC_ROOT."
        )

    uvicorn.run(
        "backend.api.app:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()