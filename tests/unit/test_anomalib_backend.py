"""Unit tests for the Anomalib backend (lazy imports, no torch required)."""
from __future__ import annotations

import pytest

from backend.vision.anomalib_backend import availability, is_available


def test_availability_dataclass_fields() -> None:
    a = availability()
    assert isinstance(a.torch_installed, bool)
    assert isinstance(a.torch_rocm, bool)
    assert isinstance(a.anomalib_installed, bool)
    assert isinstance(a.ready, bool)
    assert isinstance(a.detail, str)


def test_is_available_returns_bool() -> None:
    out = is_available()
    assert isinstance(out, bool)


def test_anomalib_construction_without_torch_raises() -> None:
    # On this CI host we never have torch+ROCm+anomalib installed
    # together; construction must raise a clear RuntimeError rather
    # than an obscure ModuleNotFoundError from inside an import.
    from backend.vision.anomalib_backend import AnomalibPatchCore

    if is_available():
        pytest.skip("anomalib is actually available in this environment")
    with pytest.raises(RuntimeError) as exc_info:
        AnomalibPatchCore(category="bottle", dataset_root="/nonexistent")
    assert "torch" in str(exc_info.value).lower() or "anomalib" in str(exc_info.value).lower()