"""Unit tests for the AMD ROCm autodetect module.

These tests do NOT require torch. They probe the environment with
pure-stdlib helpers and assert the dataclass shape is stable.
"""
from __future__ import annotations

from pathlib import Path

from backend.vision.amd_detect import (
    AmdEnvironment,
    detect_amd_gpu,
    detect_rocm_install,
    detect_torch_rocm,
    has_dri_render_node,
    summary,
)


def test_detect_amd_gpu_returns_list() -> None:
    out = detect_amd_gpu()
    assert isinstance(out, list)
    for d in out:
        assert d.is_amd is True
        assert d.slot
        assert d.description


def test_has_dri_render_node_returns_bool() -> None:
    out = has_dri_render_node()
    assert isinstance(out, bool)


def test_detect_rocm_install_returns_dict_with_required_keys() -> None:
    info = detect_rocm_install()
    for k in (
        "rocm_root_exists",
        "rocm_root_path",
        "rocm_smi_on_path",
        "rocm_smi_path",
        "hsa_runtime",
        "hip_path",
        "ld_library_path_has_rocm",
    ):
        assert k in info
    assert isinstance(info["rocm_root_exists"], bool)
    assert isinstance(info["rocm_smi_on_path"], bool)


def test_detect_torch_rocm_is_typed() -> None:
    info = detect_torch_rocm()
    assert isinstance(info.available, bool)
    assert info.note  # always populated


def test_summary_returns_environment_dataclass() -> None:
    env = summary()
    assert isinstance(env, AmdEnvironment)
    d = env.to_dict()
    for k in ("amd_gpus", "dri_render_nodes", "rocm", "torch", "recommended_backend"):
        assert k in d
    assert env.recommended_backend in {"anomalib", "patchcore-lite", "synthetic"}


def test_recommended_backend_is_synthetic_when_no_amd_no_rocm(monkeypatch) -> None:
    # Force the summary to look bare; the contract must still pick a backend.
    fake = AmdEnvironment(
        amd_gpus=[],
        dri_render_nodes=[],
        rocm={
            "rocm_root_exists": False,
            "rocm_root_path": None,
            "rocm_smi_on_path": False,
            "rocm_smi_path": None,
            "hsa_runtime": None,
            "hip_path": None,
            "ld_library_path_has_rocm": False,
        },
        torch=detect_torch_rocm(),
    )
    # No hardware, no ROCm, no torch → synthetic (or patchcore-lite if torch is
    # available but not ROCm). The point is the chain must terminate.
    assert fake.recommended_backend in {"patchcore-lite", "synthetic"}
    # And when AMD hardware is reported via DRI, the property still
    # classifies as patchcore-lite (CPU fallback).
    fake_with_dri = AmdEnvironment(
        amd_gpus=[],
        dri_render_nodes=[Path("/dev/dri/renderD128")],
        rocm={
            "rocm_root_exists": False,
            "rocm_root_path": None,
            "rocm_smi_on_path": False,
            "rocm_smi_path": None,
            "hsa_runtime": None,
            "hip_path": None,
            "ld_library_path_has_rocm": False,
        },
        torch=detect_torch_rocm(),
    )
    assert fake_with_dri.has_amd_hardware is True
    assert fake_with_dri.recommended_backend == "patchcore-lite"


def test_recommended_backend_is_anomalib_when_torch_rocm_available(monkeypatch) -> None:
    from backend.vision.amd_detect import TorchRocmInfo

    fake = AmdEnvironment(
        amd_gpus=[],
        dri_render_nodes=[],
        rocm={
            "rocm_root_exists": False,
            "rocm_root_path": None,
            "rocm_smi_on_path": False,
            "rocm_smi_path": None,
            "hsa_runtime": None,
            "hip_path": None,
            "ld_library_path_has_rocm": False,
        },
        torch=TorchRocmInfo(
            available=True,
            torch_version="2.4.0+rocm5.7",
            cuda_available=True,
            hip_compiled=True,
            device_count=1,
            device_names=["gfx1100"],
            note="",
        ),
    )
    assert fake.recommended_backend == "anomalib"


def test_missing_lspci_does_not_block_backend_startup(monkeypatch) -> None:
    def unavailable(*args, **kwargs):
        raise FileNotFoundError("lspci")

    monkeypatch.setattr("backend.vision.amd_detect.subprocess.run", unavailable)
    assert detect_amd_gpu() == []
    assert summary().amd_gpus == []


def test_fallback_lspci_timeout_returns_no_hardware(monkeypatch) -> None:
    import subprocess

    monkeypatch.setattr("backend.vision.amd_detect._run_lspci", lambda: "")
    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired("lspci", 5)
    monkeypatch.setattr("backend.vision.amd_detect.subprocess.run", timeout)
    assert detect_amd_gpu() == []
