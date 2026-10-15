"""MVTec AD directory layout helper.

MVTec AD's official layout (per https://www.mvtec.com/company/research/
datasets/mvtec-ad) is::

    <root>/mvtec_anomaly_detection/
        <category>/
            train/
                good/
                    <image>.png        # normal-only training images
            test/
                good/
                    <image>.png        # held-out normal
                <defect_type>/         # one folder per defect type
                    <image>.png
            ground_truth/
                <defect_type>/         # one folder per defect type
                    <image>_mask.png   # pixel-level ground-truth mask

This module enumerates the layout and exposes typed dataclasses for
the splits the anomaly-detection pipeline needs:

  * ``train_normal_paths`` — the "good" training images used to fit
    the memory bank.
  * ``test_normal_paths``  — held-out normal test images.
  * ``test_anomaly_paths`` — every non-good test image, tagged with
    its defect type.
  * ``ground_truth_paths`` — for each anomaly image, its mask path.

It also provides a tiny ``SyntheticMVTec`` fixture builder used by
the test suite to exercise the loader without a 4.9 GB download.
"""
from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .mvtec_download import MVTEC_CATEGORIES


# ---------------------------------------------------------------------------
# Layout dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AnomalySample:
    image_path: Path
    defect_type: str
    ground_truth_path: Path | None


@dataclass(frozen=True)
class CategorySplit:
    category: str
    root: Path
    train_normal_paths: tuple[Path, ...]
    test_normal_paths: tuple[Path, ...]
    test_anomalies: tuple[AnomalySample, ...]
    defect_types: tuple[str, ...]
    ground_truth_dir: Path | None

    @property
    def n_train_normal(self) -> int:
        return len(self.train_normal_paths)

    @property
    def n_test_normal(self) -> int:
        return len(self.test_normal_paths)

    @property
    def n_test_anomalous(self) -> int:
        return len(self.test_anomalies)

    @property
    def n_test_total(self) -> int:
        return self.n_test_normal + self.n_test_anomalous


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def discover_root(path: Path) -> Path:
    """Resolve a user-supplied MVTec path to the directory that contains
    the category subdirectories.

    Accepts:
      * a path that already ends in ``mvtec_anomaly_detection/``
      * a path to a single category (when ``--category`` was used at
        download time)
      * a parent directory containing category subdirectories.
    """
    if not path.exists():
        raise FileNotFoundError(f"MVTec path does not exist: {path}")
    if path.is_dir() and any((path / c).is_dir() for c in MVTEC_CATEGORIES):
        return path
    # Try the conventional "mvtec_anomaly_detection/" subdirectory
    nested = path / "mvtec_anomaly_detection"
    if nested.is_dir() and any((nested / c).is_dir() for c in MVTEC_CATEGORIES):
        return nested
    raise FileNotFoundError(
        f"Could not find an MVTec AD layout under {path}. "
        f"Expected one of: {path}, {path/'mvtec_anomaly_detection'}."
    )


def category_paths(root: Path, category: str) -> CategorySplit:
    """Discover the train/test/ground_truth paths for a category."""
    if category not in MVTEC_CATEGORIES:
        raise ValueError(f"Unknown MVTec category: {category}")
    cat_dir = root / category
    if not cat_dir.is_dir():
        raise FileNotFoundError(f"Category directory not found: {cat_dir}")

    train_dir = cat_dir / "train" / "good"
    test_dir = cat_dir / "test"
    gt_dir = cat_dir / "ground_truth"

    train_normal = _list_images(train_dir)
    test_normal = _list_images(test_dir / "good") if (test_dir / "good").is_dir() else []

    defect_dirs = sorted(p for p in test_dir.iterdir() if p.is_dir() and p.name != "good")
    defects: list[AnomalySample] = []
    defect_types: list[str] = []
    for d in defect_dirs:
        defect_types.append(d.name)
        for img in _list_images(d):
            stem = img.stem
            gt_path = gt_dir / d.name / f"{stem}_mask.png"
            if not gt_path.exists():
                gt_path = None  # type: ignore[assignment]
            defects.append(AnomalySample(image_path=img, defect_type=d.name, ground_truth_path=gt_path))

    return CategorySplit(
        category=category,
        root=cat_dir,
        train_normal_paths=tuple(train_normal),
        test_normal_paths=tuple(test_normal),
        test_anomalies=tuple(defects),
        defect_types=tuple(defect_types),
        ground_truth_dir=gt_dir if gt_dir.is_dir() else None,
    )


def list_test_images(root: Path, category: str) -> list[Path]:
    """All test images (normal + anomalous) for the benchmark loop."""
    split = category_paths(root, category)
    return [*split.test_normal_paths, *(a.image_path for a in split.test_anomalies)]


def list_train_images(root: Path, category: str) -> list[Path]:
    """Training (normal-only) images used to fit the memory bank."""
    return list(category_paths(root, category).train_normal_paths)


def _list_images(dir_: Path) -> list[Path]:
    if not dir_.is_dir():
        return []
    return sorted(p for p in dir_.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"})


# ---------------------------------------------------------------------------
# Synthetic MVTec (for tests)
# ---------------------------------------------------------------------------


@dataclass
class SyntheticMVTecLayout:
    root: Path
    categories: dict[str, CategorySplit] = field(default_factory=dict)


def build_synthetic_mvtec(
    base: Path,
    *,
    categories: Iterable[str] = ("bottle",),
    n_train_normal: int = 5,
    n_test_normal: int = 3,
    defect_types: Iterable[str] = ("broken", "scratched"),
    n_per_defect: int = 3,
    image_ext: str = ".png",
) -> SyntheticMVTecLayout:
    """Create a synthetic MVTec AD layout under ``base``.

    Used by the test suite so the loader is exercised without a
    4.9 GB download. The image bytes are not meaningful — only the
    file layout matters.
    """
    import cv2
    import numpy as np

    base.mkdir(parents=True, exist_ok=True)
    out = SyntheticMVTecLayout(root=base)

    rng = np.random.default_rng(20261015)

    for cat in categories:
        cat_dir = base / cat
        train_good = cat_dir / "train" / "good"
        test_good = cat_dir / "test" / "good"
        gt_dir = cat_dir / "ground_truth"
        train_good.mkdir(parents=True, exist_ok=True)
        test_good.mkdir(parents=True, exist_ok=True)

        for i in range(n_train_normal):
            img = (rng.integers(60, 200, (32, 32), dtype=np.uint8))
            cv2.imwrite(str(train_good / f"{i:04d}{image_ext}"), img)

        for i in range(n_test_normal):
            img = (rng.integers(60, 200, (32, 32), dtype=np.uint8))
            cv2.imwrite(str(test_good / f"{i:04d}{image_ext}"), img)

        defects: list[AnomalySample] = []
        defects_dir = cat_dir / "test"
        for d in defect_types:
            d_dir = defects_dir / d
            d_gt = gt_dir / d
            d_dir.mkdir(parents=True, exist_ok=True)
            d_gt.mkdir(parents=True, exist_ok=True)
            for i in range(n_per_defect):
                img = (rng.integers(60, 200, (32, 32), dtype=np.uint8))
                cv2.imwrite(str(d_dir / f"{i:04d}{image_ext}"), img)
                mask = (rng.integers(0, 2, (32, 32), dtype=np.uint8) * 255)
                cv2.imwrite(str(d_gt / f"{i:04d}_mask{image_ext}"), mask)
                defects.append(
                    AnomalySample(
                        image_path=d_dir / f"{i:04d}{image_ext}",
                        defect_type=d,
                        ground_truth_path=d_gt / f"{i:04d}_mask{image_ext}",
                    )
                )

        out.categories[cat] = CategorySplit(
            category=cat,
            root=cat_dir,
            train_normal_paths=tuple(sorted(train_good.glob(f"*{image_ext}"))),
            test_normal_paths=tuple(sorted(test_good.glob(f"*{image_ext}"))),
            test_anomalies=tuple(defects),
            defect_types=tuple(defect_types),
            ground_truth_dir=gt_dir,
        )
    return out


def remove_synthetic_mvtec(layout: SyntheticMVTecLayout) -> None:
    """Remove a synthetic MVTec layout created by ``build_synthetic_mvtec``."""
    if layout.root.exists():
        shutil.rmtree(layout.root, ignore_errors=True)


__all__ = [
    "AnomalySample",
    "CategorySplit",
    "SyntheticMVTecLayout",
    "discover_root",
    "category_paths",
    "list_test_images",
    "list_train_images",
    "build_synthetic_mvtec",
    "remove_synthetic_mvtec",
]