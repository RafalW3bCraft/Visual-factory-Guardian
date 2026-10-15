"""Vision inference backend.

This module provides:

  * ``VisionBackend`` — abstract interface that any vision backend
    (PatchCore-lite, Anomalib PatchCore on ROCm, a remote inference
    service, etc.) must implement.
  * ``PatchCoreLiteCPU`` — a working CPU-only PatchCore-style baseline
    implemented with scikit-learn. It extracts patch embeddings from
    grayscale images, fits a memory bank on the normal training set, and
    scores a test image as the maximum nearest-neighbour distance.
  * ``SyntheticFixtureBackend`` — a deterministic *fixture* backend
    used when no real images are available. It is clearly labelled
    ``source="simulated"`` and is suitable only for end-to-end wiring
    tests, not for measuring model quality.

The contract that every backend produces is the same ``Detection``
dict so the API layer and downstream consumers can stay backend-agnostic.
"""
from __future__ import annotations

import abc
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import cv2
import numpy as np
from sklearn.neighbors import NearestNeighbors

# ---------------------------------------------------------------------------
# Common contract
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Detection:
    model: str
    anomaly_score: float  # higher == more anomalous, in [0, 1]
    localization_ref: str | None = None
    note: str = ""

    def to_dict(self) -> dict:
        return {
            "model": self.model,
            "anomaly_score": float(self.anomaly_score),
            "localization_ref": self.localization_ref,
        }


@dataclass(frozen=True)
class VisionInput:
    image_id: str
    image_path: Path | None  # None when the image is supplied inline (synthetic fixtures)


@dataclass(frozen=True)
class VisionResult:
    image_id: str
    detection: Detection
    raw_score: float
    source: str  # "public_dataset" | "simulated" | "real" | "recorded"


class VisionBackend(abc.ABC):
    """Abstract vision backend."""

    model_id: str = "abstract"

    @abc.abstractmethod
    def fit(self, normal_images: Sequence[VisionInput]) -> None:
        """Fit the model on normal training images."""

    @abc.abstractmethod
    def predict(self, image: VisionInput) -> VisionResult:
        """Score a single image. Returns a normalized Detection."""


# ---------------------------------------------------------------------------
# PatchCore-lite (CPU)
# ---------------------------------------------------------------------------


def _load_grayscale(path: Path, size: tuple[int, int]) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(f"Could not load image: {path}")
    if img.shape[:2] != size:
        img = cv2.resize(img, (size[1], size[0]), interpolation=cv2.INTER_AREA)
    return img


def _patch_embeddings(img: np.ndarray, patch: int = 16, stride: int | None = None) -> np.ndarray:
    """Extract mean/var patch embeddings for an HxW grayscale image.

    Each patch produces a 2-D embedding (mean, variance). This is a
    cheap stand-in for a learned CNN feature; it is sufficient to
    separate clearly normal and anomalous synthetic patterns.
    """
    h, w = img.shape
    stride = stride or patch
    rows = (h - patch) // stride + 1
    cols = (w - patch) // stride + 1
    if rows <= 0 or cols <= 0:
        raise ValueError(f"Image too small for patch={patch}: got {h}x{w}")
    out = np.empty((rows * cols, 2), dtype=np.float32)
    idx = 0
    for r in range(rows):
        for c in range(cols):
            p = img[r * stride : r * stride + patch, c * stride : c * stride + patch]
            out[idx, 0] = p.mean()
            out[idx, 1] = p.var()
            idx += 1
    # Standardise so equal-mean patches with different variance still register
    out /= 255.0
    return out


class PatchCoreLiteCPU(VisionBackend):
    """PatchCore-lite: nearest-neighbour anomaly detection over patch embeddings.

    The full PatchCore algorithm uses a deep CNN backbone; this CPU
    fallback uses a hand-crafted 2-D embedding. That keeps the
    computational footprint trivial while preserving the architectural
    shape: a memory bank of normal patches, scored by max distance to
    the bank, then normalised to [0, 1] with the 99th-percentile
    statistic from the training set.
    """

    model_id = "patchcore-lite-cpu"

    def __init__(self, input_size: tuple[int, int] = (128, 128), patch: int = 16) -> None:
        self.input_size = input_size
        self.patch = patch
        self._memory_bank: np.ndarray | None = None
        self._nn: NearestNeighbors | None = None
        self._normalisation: float = 1.0

    def fit(self, normal_images: Sequence[VisionInput]) -> None:
        if not normal_images:
            raise ValueError("PatchCoreLiteCPU.fit needs at least one normal image.")
        all_embeddings: list[np.ndarray] = []
        for item in normal_images:
            if item.image_path is None:
                raise ValueError(f"PatchCoreLiteCPU.fit needs image_path for {item.image_id}")
            img = _load_grayscale(item.image_path, self.input_size)
            emb = _patch_embeddings(img, patch=self.patch)
            all_embeddings.append(emb)
        bank = np.vstack(all_embeddings).astype(np.float32)
        self._memory_bank = bank
        self._nn = NearestNeighbors(n_neighbors=1, algorithm="auto").fit(bank)
        # Use the 99th percentile of training-set scores as the normaliser
        train_scores = self._score_all(bank)
        self._normalisation = float(np.percentile(train_scores, 99)) or 1.0

    def _score_all(self, embeddings: np.ndarray) -> np.ndarray:
        if self._nn is None:
            raise RuntimeError("PatchCoreLiteCPU: must call fit() before scoring")
        dists, _ = self._nn.kneighbors(embeddings, n_neighbors=1, return_distance=True)
        return dists[:, 0]

    def _score_embedding(self, emb: np.ndarray) -> float:
        return float(self._score_all(emb).max())

    def predict(self, image: VisionInput) -> VisionResult:
        if image.image_path is None:
            raise ValueError(f"PatchCoreLiteCPU.predict needs image_path for {image.image_id}")
        img = _load_grayscale(image.image_path, self.input_size)
        emb = _patch_embeddings(img, patch=self.patch)
        raw = self._score_embedding(emb)
        norm = min(1.0, raw / self._normalisation) if self._normalisation > 0 else raw
        # NaN/Inf guard
        if not math.isfinite(norm):
            norm = 0.0
        return VisionResult(
            image_id=image.image_id,
            detection=Detection(
                model=self.model_id,
                anomaly_score=round(norm, 4),
                localization_ref=None,
                note="CPU PatchCore-lite (sklearn KNN over patch mean/var embeddings)",
            ),
            raw_score=raw,
            source="simulated",
        )


# ---------------------------------------------------------------------------
# Synthetic fixture backend
# ---------------------------------------------------------------------------


class SyntheticFixtureBackend(VisionBackend):
    """Deterministic score lookup for the thermal-drift fixture scenario.

    The fixture scenario encodes expected per-inspection scores
    (``expected_anomaly_score_range``). This backend picks a stable
    value inside the range using a deterministic hash so the same
    ``image_id`` always produces the same score across runs. The
    labels are explicitly tagged ``source="simulated"`` and the model
    id is clearly marked as a fixture.
    """

    model_id = "synthetic-fixture"

    def __init__(self, fixtures: dict[str, tuple[float, str]]) -> None:
        # fixtures: image_id -> (score, expected_label)
        self._fixtures = fixtures

    def fit(self, normal_images: Sequence[VisionInput]) -> None:  # noqa: ARG002
        # No fitting required for a deterministic fixture
        return

    def predict(self, image: VisionInput) -> VisionResult:
        if image.image_id not in self._fixtures:
            raise KeyError(f"SyntheticFixtureBackend: no fixture for {image.image_id}")
        score, label = self._fixtures[image.image_id]
        return VisionResult(
            image_id=image.image_id,
            detection=Detection(
                model=self.model_id,
                anomaly_score=float(score),
                localization_ref=None,
                note=f"Deterministic fixture ({label})",
            ),
            raw_score=float(score),
            source="simulated",
        )


# ---------------------------------------------------------------------------
# Backend selection
# ---------------------------------------------------------------------------


def build_backend(
    kind: str,
    *,
    fixtures: dict[str, tuple[float, str]] | None = None,
    input_size: tuple[int, int] = (128, 128),
) -> VisionBackend:
    """Factory used by the API layer."""
    kind = kind.lower()
    if kind in {"patchcore-lite", "patchcore-lite-cpu"}:
        return PatchCoreLiteCPU(input_size=input_size)
    if kind in {"synthetic", "fixture"}:
        if fixtures is None:
            raise ValueError("Synthetic backend requires fixtures")
        return SyntheticFixtureBackend(fixtures)
    raise ValueError(f"Unknown vision backend: {kind}")


__all__ = [
    "Detection",
    "VisionInput",
    "VisionResult",
    "VisionBackend",
    "PatchCoreLiteCPU",
    "SyntheticFixtureBackend",
    "build_backend",
]