"""Unit tests for the MVTec AD download + loader.

The downloader is exercised without network: we verify that without
``--accept-license`` the call is refused, that the licence text is
printable, and that the synthetic layout helper produces a directory
tree the loader can then walk.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from backend.vision.mvtec_download import (
    DEFAULT_URL,
    MVTEC_CATEGORIES,
    MVTEC_LICENSE_TEXT,
    download_mvtec,
)
from backend.vision.mvtec_loader import (
    build_synthetic_mvtec,
    category_paths,
    discover_root,
    list_test_images,
    list_train_images,
)


# ---------------------------------------------------------------------------
# Downloader
# ---------------------------------------------------------------------------


def test_download_refused_without_licence(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError) as exc_info:
        download_mvtec(tmp_path, accept_license=False)
    assert "licence" in str(exc_info.value).lower()


def test_download_unknown_category_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        download_mvtec(tmp_path, accept_license=True, category="does-not-exist")


def test_licence_text_non_empty() -> None:
    assert "MVTec" in MVTEC_LICENSE_TEXT
    assert "non-commercial" in MVTEC_LICENSE_TEXT.lower() or "noncommercial" in MVTEC_LICENSE_TEXT.lower()


def test_known_categories_present() -> None:
    assert "bottle" in MVTEC_CATEGORIES
    assert len(MVTEC_CATEGORIES) == 15


def test_default_url_is_set() -> None:
    assert DEFAULT_URL.startswith("https://")


# ---------------------------------------------------------------------------
# Loader — synthetic MVTec layout
# ---------------------------------------------------------------------------


def test_build_synthetic_layout(tmp_path: Path) -> None:
    layout = build_synthetic_mvtec(
        tmp_path,
        categories=("bottle",),
        n_train_normal=4,
        n_test_normal=2,
        defect_types=("broken", "scratched"),
        n_per_defect=3,
    )
    assert "bottle" in layout.categories
    split = layout.categories["bottle"]
    assert split.n_train_normal == 4
    assert split.n_test_normal == 2
    assert split.n_test_anomalous == 6
    assert split.defect_types == ("broken", "scratched")


def test_discover_root_resolves_synthetic_layout(tmp_path: Path) -> None:
    build_synthetic_mvtec(tmp_path, categories=("bottle", "cable"))
    root = discover_root(tmp_path)
    assert root == tmp_path
    assert (root / "bottle" / "train" / "good").is_dir()


def test_category_paths_returns_correct_lists(tmp_path: Path) -> None:
    build_synthetic_mvtec(
        tmp_path,
        categories=("bottle",),
        n_train_normal=3,
        n_test_normal=2,
        defect_types=("broken",),
        n_per_defect=2,
    )
    split = category_paths(tmp_path, "bottle")
    assert len(split.train_normal_paths) == 3
    assert len(split.test_normal_paths) == 2
    assert len(split.test_anomalies) == 2
    for sample in split.test_anomalies:
        assert sample.defect_type == "broken"
        assert sample.ground_truth_path is not None
        assert sample.ground_truth_path.exists()


def test_list_train_and_test_images(tmp_path: Path) -> None:
    build_synthetic_mvtec(
        tmp_path,
        categories=("bottle",),
        n_train_normal=4,
        n_test_normal=2,
        defect_types=("broken", "scratched"),
        n_per_defect=2,
    )
    train = list_train_images(tmp_path, "bottle")
    test = list_test_images(tmp_path, "bottle")
    assert len(train) == 4
    assert len(test) == 2 + 2 * 2  # normal + 2 defects × 2 each


def test_unknown_category_rejected(tmp_path: Path) -> None:
    build_synthetic_mvtec(tmp_path, categories=("bottle",))
    with pytest.raises(ValueError):
        category_paths(tmp_path, "nope")


def test_discover_root_raises_for_bad_path(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        discover_root(tmp_path / "does_not_exist")