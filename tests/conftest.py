"""Shared pytest fixtures."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def vfg_venv() -> Path:
    return Path("/home/watcher/.hermes/cache/scratch/vfg-venv")


@pytest.fixture(scope="session", autouse=True)
def patch_environ():
    # Tests run against the synthetic backend by default so they don't
    # need fixture images, MVTec, or a GPU. Override with env vars or
    # monkeypatch.setenv() per test.
    os.environ.setdefault("VFG_VISION_BACKEND", "synthetic")
    os.environ.setdefault("VFG_SCENARIO", "thermal-drift-001")
    os.environ.setdefault("VFG_FIXTURE_ROOT", str(REPO_ROOT / "data" / "fixtures"))
    yield