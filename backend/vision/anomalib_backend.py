"""Anomalib PatchCore backend with conditional torch/anomalib imports.

This module is the AMD ROCm plug-in for the vision pipeline. It is
intentionally NOT imported by ``backend.vision.inference`` at module
load — the imports are deferred to first use so a developer running
``python scripts/run_demo.py --backend patchcore-lite`` does not need
torch or anomalib installed.

Usage on AMD ROCm hardware::

    pip install --index-url https://download.pytorch.org/whl/rocm torch
    pip install anomalib

    VFG_VISION_BACKEND=anomalib \\
    VFG_MVTEC_ROOT=./data/mvtec_ad \\
    VFG_MVTEC_CATEGORY=bottle \\
    python -m backend.api.server

When torch/anomalib are not installed, :func:`is_available` returns
False and the autodetect chain in :mod:`backend.vision.inference`
silently falls back to the CPU PatchCore-lite backend.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from .inference import Detection, VisionBackend, VisionInput, VisionResult

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Soft availability probe
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BackendAvailability:
    torch_installed: bool
    torch_rocm: bool
    anomalib_installed: bool
    detail: str = ""

    @property
    def ready(self) -> bool:
        return self.torch_installed and self.torch_rocm and self.anomalib_installed


def _probe_availability() -> BackendAvailability:
    """Soft-import torch and anomalib; do not raise if absent."""
    try:
        import torch  # type: ignore
    except Exception as exc:  # noqa: BLE001
        return BackendAvailability(
            torch_installed=False,
            torch_rocm=False,
            anomalib_installed=False,
            detail=f"torch import failed: {exc.__class__.__name__}",
        )
    hip = bool(getattr(getattr(torch, "version", None), "hip", None))
    try:
        import anomalib  # type: ignore  # noqa: F401
        anomalib_installed = True
        anomalib_detail = getattr(anomalib, "__version__", "unknown")
    except Exception as exc:  # noqa: BLE001
        return BackendAvailability(
            torch_installed=True,
            torch_rocm=hip,
            anomalib_installed=False,
            detail=f"anomalib import failed: {exc.__class__.__name__}",
        )
    return BackendAvailability(
        torch_installed=True,
        torch_rocm=hip,
        anomalib_installed=True,
        detail=f"torch={torch.__version__} anomalib={anomalib_detail} hip={hip}",
    )


def is_available() -> bool:
    """True iff torch (ROCm build) and anomalib are importable."""
    return _probe_availability().ready


# ---------------------------------------------------------------------------
# Anomalib PatchCore backend
# ---------------------------------------------------------------------------


class AnomalibPatchCore(VisionBackend):
    """Anomalib PatchCore on ROCm (or CUDA, depending on the torch build).

    The training step delegates to ``anomalib.models.Patchcore`` which
    wraps the full PatchCore algorithm (pretrained ResNet backbone,
    coreset-subsampled memory bank, FAISS nearest-neighbour search).
    Inference uses ``predict()`` which returns anomaly_score and
    anomaly_map (the latter is exposed as ``localization_ref`` when
    written to disk).
    """

    model_id = "patchcore-anomalib-rocm"

    def __init__(
        self,
        *,
        category: str,
        dataset_root: str | Path,
        device: str = "auto",
        image_size: tuple[int, int] | None = None,
        save_loc_dir: str | Path | None = None,
    ) -> None:
        avail = _probe_availability()
        if not avail.ready:
            raise RuntimeError(
                "AnomalibPatchCore requires torch (ROCm build) and anomalib. "
                f"Current availability: {avail}. "
                "Install with: "
                "`pip install --index-url https://download.pytorch.org/whl/rocm torch` "
                "and `pip install anomalib`."
            )
        # Imports are deferred to here so a developer without torch can
        # still import the rest of the package.
        import torch  # type: ignore
        from anomalib.engine import Engine  # type: ignore
        from anomalib.models import Patchcore  # type: ignore
        from anomalib.data import MVTec  # type: ignore

        self._torch = torch
        self._Patchcore = Patchcore
        self._Engine = Engine
        self._MVTec = MVTec
        self.category = category
        self.dataset_root = Path(dataset_root)
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        self.image_size = image_size
        self.save_loc_dir = Path(save_loc_dir) if save_loc_dir else None
        self._model: Any | None = None
        self._threshold: float = 0.5

    # ------------------------------------------------------------------
    # VisionBackend API
    # ------------------------------------------------------------------

    def fit(self, normal_images: Sequence[VisionInput]) -> None:  # noqa: ARG002
        """Train PatchCore on the MVTec AD category.

        ``normal_images`` is accepted for interface compatibility but
        the actual training data path is taken from ``dataset_root``
        (MVTec's official directory layout).
        """
        if not self.dataset_root.exists():
            raise FileNotFoundError(
                f"MVTec dataset root not found: {self.dataset_root}. "
                "Run `python -m backend.vision.mvtec_download --accept-license` first."
            )
        cat_dir = self.dataset_root / self.category
        if not cat_dir.is_dir():
            raise FileNotFoundError(
                f"MVTec category directory not found: {cat_dir}. "
                f"Expected MVTec AD layout: <root>/{self.category}/{{train,test,ground_truth}}"
            )

        log.info(
            "Training Anomalib PatchCore on MVTec AD category=%s root=%s device=%s",
            self.category,
            self.dataset_root,
            self.device,
        )

        # Anomalib's high-level Engine expects a datamodule; construct
        # one for MVTec and train Patchcore for a single epoch (the
        # memory bank build is the expensive step).
        datamodule = self._MVTec(
            root=str(self.dataset_root),
            category=self.category,
            train_batch_size=1,
            eval_batch_size=1,
            image_size=self.image_size,
        )
        model = self._Patchcore(
            backbone="resnet18",
            pre_trained=True,
            coreset_sampling_ratio=0.1,
        )
        engine = self._Engine(device=self.device, default_root="/tmp/vfg_anomalib_logs")
        engine.fit(datamodule=datamodule, model=model)
        self._model = model
        # A real validation pass would set this; for the demo we use a
        # conservative default and rely on the scenario's anomaly_threshold.
        self._threshold = 0.5

    def predict(self, image: VisionInput) -> VisionResult:
        if self._model is None:
            raise RuntimeError("AnomalibPatchCore: must call fit() before predict()")
        if image.image_path is None:
            raise ValueError(
                f"AnomalibPatchCore.predict needs image_path for {image.image_id}"
            )
        # Anomalib's predict returns a list[ImageResult]; one per image.
        from anomalib.data import PredictDataset  # type: ignore

        dataset = PredictDataset(path=str(image.image_path.parent))
        # Engine.predict yields torchmetrics ImageResults
        from anomalib.engine import Engine  # type: ignore

        engine = self._Engine(device=self.device, default_root="/tmp/vfg_anomalib_logs")
        results = engine.predict(model=self._model, dataset=dataset)
        score = float(results[0].pred_score) if results else 0.0
        if not math.isfinite(score):
            score = 0.0
        # Optional: persist anomaly_map as a PNG and return its path
        localization_ref: str | None = None
        if self.save_loc_dir is not None and results:
            try:
                self.save_loc_dir.mkdir(parents=True, exist_ok=True)
                map_path = self.save_loc_dir / f"{image.image_id}_heatmap.png"
                anomaly_map = getattr(results[0], "anomaly_map", None)
                if anomaly_map is not None:
                    # Save as a normalised PNG; require torch for the
                    # GPU-side normalisation step.
                    import numpy as np
                    from PIL import Image

                    arr = anomaly_map.detach().cpu().numpy() if hasattr(anomaly_map, "detach") else np.asarray(anomaly_map)
                    if arr.ndim == 3:
                        arr = arr[0]
                    arr = (arr - arr.min()) / max(arr.max() - arr.min(), 1e-8)
                    Image.fromarray((arr * 255).astype("uint8")).save(map_path)
                    localization_ref = str(map_path)
            except Exception as exc:  # noqa: BLE001
                log.warning("Could not write localization heatmap for %s: %s", image.image_id, exc)
        return VisionResult(
            image_id=image.image_id,
            detection=Detection(
                model=self.model_id,
                anomaly_score=round(score, 4),
                localization_ref=localization_ref,
                note=(
                    f"Anomalib PatchCore on {self.device}; "
                    f"MVTec category={self.category}; "
                    f"threshold={self._threshold:.3f}"
                ),
            ),
            raw_score=score,
            source="public_dataset",
        )


# ---------------------------------------------------------------------------
# Module-level singleton helpers (used by the API layer)
# ---------------------------------------------------------------------------


def availability() -> BackendAvailability:
    return _probe_availability()


__all__ = [
    "BackendAvailability",
    "AnomalibPatchCore",
    "is_available",
    "availability",
]