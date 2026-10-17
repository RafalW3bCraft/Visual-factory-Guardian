"""AMD ROCm environment autodetection.

Pure stdlib — does NOT import torch. The detection helpers are safe to
call from any Python process, including the lightweight FastAPI worker
and the pytest suite.

Three independent layers are probed:

  1. ``detect_amd_gpu()`` — hardware: parse ``lspci`` and ``/dev/dri``
     for AMD/ATI display and render nodes.
  2. ``detect_rocm_install()`` — runtime: check for ``/opt/rocm``,
     ``rocm-smi`` on PATH, and the usual ROCm env vars.
  3. ``detect_torch_rocm()`` — bindings: try to import torch and check
     ``torch.version.hip`` / ``torch.cuda.is_available()``. Returns
     ``None`` (not raises) if torch is not installed.

A consolidated :func:`summary` returns everything in one dict so the
caller can decide which backend to load.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable


# ---------------------------------------------------------------------------
# Layer 1 — AMD GPU hardware
# ---------------------------------------------------------------------------

_AMD_PCI_VENDOR_RE = re.compile(
    r"\b(AMD|Advanced Micro Devices|ATI Technologies)\b", re.IGNORECASE
)
_VGA_CLASS_RE = re.compile(r"\b(VGA compatible controller|3D controller|Display controller)\b", re.IGNORECASE)


@dataclass(frozen=True)
class PciDevice:
    slot: str
    description: str
    vendor: str

    @property
    def is_amd(self) -> bool:
        return bool(_AMD_PCI_VENDOR_RE.search(self.description))


def _parse_lspci(text: str) -> list[PciDevice]:
    out: list[PciDevice] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Example: "00:01.0 VGA compatible controller: Red Hat, Inc. Virtio 1.0 GPU (rev 01)"
        m = re.match(r"^([0-9a-fA-F:.]+)\s+(.+?):\s+(.+)$", line)
        if not m:
            continue
        slot, klass, desc = m.group(1), m.group(2), m.group(3)
        out.append(PciDevice(slot=slot, description=desc, vendor=klass))
    return out


def _run_lspci() -> str:
    try:
        return subprocess.run(
            ["lspci", "-mm"], capture_output=True, text=True, timeout=5, check=False
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def _dri_render_nodes() -> list[Path]:
    dri = Path("/dev/dri")
    if not dri.is_dir():
        return []
    return sorted(dri.glob("renderD*"))


def detect_amd_gpu() -> list[PciDevice]:
    """Return the list of AMD/ATI PCI devices on this host."""
    raw_mm = _run_lspci()
    try:
        devices = _parse_lspci(raw_mm) if raw_mm else _parse_lspci(
            subprocess.run(
                ["lspci"], capture_output=True, text=True, timeout=5, check=False
            ).stdout
        )
    except (OSError, subprocess.SubprocessError):
        # lspci is optional (and normally absent on macOS/Windows).
        # An unavailable probe must not prevent the CPU/synthetic API starting.
        return []
    return [d for d in devices if d.is_amd]


def has_dri_render_node() -> bool:
    """True if at least one ``/dev/dri/renderD*`` exists."""
    return bool(_dri_render_nodes())


# ---------------------------------------------------------------------------
# Layer 2 — ROCm install
# ---------------------------------------------------------------------------


def detect_rocm_install() -> dict[str, object]:
    """Inspect the host for a ROCm installation.

    Returns a dict with boolean flags and discovered paths. Does not
    raise; an absent ROCm install simply yields all-False.
    """
    rocm_root = Path("/opt/rocm")
    info: dict[str, object] = {
        "rocm_root_exists": rocm_root.is_dir(),
        "rocm_root_path": str(rocm_root) if rocm_root.is_dir() else None,
        "rocm_smi_on_path": shutil.which("rocm-smi") is not None,
        "rocm_smi_path": shutil.which("rocm-smi"),
        "hsa_runtime": os.environ.get("HSA_RUNTIME") or os.environ.get("HSA_PATH"),
        "hip_path": os.environ.get("HIP_PATH"),
        "ld_library_path_has_rocm": False,
    }
    ld = os.environ.get("LD_LIBRARY_PATH", "")
    info["ld_library_path_has_rocm"] = "/opt/rocm" in ld or "rocm" in ld.lower()
    return info


# ---------------------------------------------------------------------------
# Layer 3 — torch ROCm bindings
# ---------------------------------------------------------------------------


@dataclass
class TorchRocmInfo:
    available: bool
    torch_version: str | None = None
    cuda_available: bool | None = None
    hip_compiled: bool | None = None
    device_count: int | None = None
    device_names: list[str] = field(default_factory=list)
    note: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


def detect_torch_rocm() -> TorchRocmInfo:
    """Try to import torch and check whether it is ROCm-enabled.

    Returns an info object whose ``available`` flag is True only when
    torch is importable AND built with HIP AND can see at least one
    device. Returns ``available=False`` with a descriptive note when
    torch is missing or ROCm is not configured.
    """
    try:
        import torch  # type: ignore
    except Exception as exc:  # noqa: BLE001
        return TorchRocmInfo(available=False, note=f"torch not installed: {exc.__class__.__name__}")

    hip_compiled = bool(getattr(getattr(torch, "version", None), "hip", None))
    cuda_available = bool(torch.cuda.is_available())
    device_count = int(torch.cuda.device_count()) if cuda_available else 0
    names: list[str] = []
    if device_count:
        for i in range(device_count):
            try:
                names.append(torch.cuda.get_device_name(i))
            except Exception:  # noqa: BLE001
                names.append(f"device:{i}")

    available = hip_compiled and cuda_available and device_count > 0
    note = ""
    if not hip_compiled:
        note = "torch is installed but not built with HIP/ROCm"
    elif not cuda_available:
        note = "torch sees no devices (ROCm runtime not initialised)"
    elif not device_count:
        note = "torch sees no devices"

    return TorchRocmInfo(
        available=available,
        torch_version=torch.__version__,
        cuda_available=cuda_available,
        hip_compiled=hip_compiled,
        device_count=device_count,
        device_names=names,
        note=note,
    )


# ---------------------------------------------------------------------------
# Consolidated summary
# ---------------------------------------------------------------------------


@dataclass
class AmdEnvironment:
    amd_gpus: list[PciDevice]
    dri_render_nodes: list[Path]
    rocm: dict[str, object]
    torch: TorchRocmInfo

    @property
    def has_amd_hardware(self) -> bool:
        return bool(self.amd_gpus) or bool(self.dri_render_nodes)

    @property
    def has_rocm_runtime(self) -> bool:
        return bool(self.rocm.get("rocm_root_exists")) or bool(self.rocm.get("rocm_smi_on_path"))

    @property
    def has_torch_rocm(self) -> bool:
        return self.torch.available

    @property
    def recommended_backend(self) -> str:
        """Pick the best backend this environment can actually run.

        Returns one of ``"anomalib"``, ``"patchcore-lite"``, or
        ``"synthetic"``. ``anomalib`` is only recommended when both
        the ROCm runtime and a ROCm-enabled torch build are present.
        """
        if self.has_torch_rocm:
            return "anomalib"
        if self.has_rocm_runtime or self.has_amd_hardware:
            # ROCm or AMD hardware is partially set up; use a CPU
            # backend but tell the caller that ROCm was detected so the
            # operator can finish the install.
            return "patchcore-lite"
        return "synthetic"

    def to_dict(self) -> dict:
        return {
            "amd_gpus": [
                {"slot": d.slot, "description": d.description, "vendor": d.vendor}
                for d in self.amd_gpus
            ],
            "dri_render_nodes": [str(p) for p in self.dri_render_nodes],
            "rocm": self.rocm,
            "torch": self.torch.to_dict(),
            "recommended_backend": self.recommended_backend,
        }


def summary() -> AmdEnvironment:
    return AmdEnvironment(
        amd_gpus=detect_amd_gpu(),
        dri_render_nodes=_dri_render_nodes(),
        rocm=detect_rocm_install(),
        torch=detect_torch_rocm(),
    )


__all__ = [
    "PciDevice",
    "TorchRocmInfo",
    "AmdEnvironment",
    "detect_amd_gpu",
    "has_dri_render_node",
    "detect_rocm_install",
    "detect_torch_rocm",
    "summary",
]