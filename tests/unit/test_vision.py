"""Unit tests for the vision backend (PatchCore-lite + Synthetic fixture)."""
from __future__ import annotations

import math
from pathlib import Path

import pytest

from backend.scenario.loader import load_scenario
from backend.vision.fixtures import generate_for_scenario
from backend.vision.inference import (
    PatchCoreLiteCPU,
    SyntheticFixtureBackend,
    VisionInput,
    build_backend,
)


def test_synthetic_backend_separates_normal_and_anomalous() -> None:
    sc = load_scenario("thermal-drift-001")
    fixtures = {
        i.image_id: (0.1 if i.expected_label == "normal" else 0.9, i.expected_label)
        for i in sc.inspections
    }
    backend = SyntheticFixtureBackend(fixtures)
    backend.fit([])
    for insp in sc.inspections:
        result = backend.predict(VisionInput(image_id=insp.image_id, image_path=None))
        if insp.expected_label == "normal":
            assert result.detection.anomaly_score < sc.anomaly_threshold
        else:
            assert result.detection.anomaly_score >= sc.anomaly_threshold


def test_synthetic_backend_unknown_image_raises() -> None:
    backend = SyntheticFixtureBackend({"img-1": (0.1, "normal")})
    backend.fit([])
    with pytest.raises(KeyError):
        backend.predict(VisionInput(image_id="nope", image_path=None))


def test_patchcore_lite_separates_normal_and_anomalous(tmp_path: Path) -> None:
    sc = load_scenario("thermal-drift-001")
    # Use the committed synthetic fixtures (if present) or generate one
    fixture_root = Path("data/fixtures/thermal-drift-001")
    if not (fixture_root / "normal_0000.png").exists():
        generate_for_scenario(sc.scenario_id, root=tmp_path)
        fixture_root = tmp_path / sc.scenario_id
    normals = sorted(fixture_root.glob("normal_*.png"))
    assert normals, "no normal training images available"
    backend = PatchCoreLiteCPU(input_size=sc.vision_model.input_size)
    backend.fit([VisionInput(image_id=p.stem, image_path=p) for p in normals])
    correct = 0
    for insp in sc.inspections:
        p = fixture_root / f"{insp.image_id}.png"
        if not p.exists():
            continue
        result = backend.predict(VisionInput(image_id=insp.image_id, image_path=p))
        flagged = result.detection.anomaly_score >= sc.anomaly_threshold
        expected_flagged = insp.expected_label == "anomalous"
        if flagged == expected_flagged:
            correct += 1
    assert correct == len(sc.inspections)


def test_patchcore_lite_score_normalised_to_unit_interval(tmp_path: Path) -> None:
    sc = load_scenario("thermal-drift-001")
    fixture_root = tmp_path / sc.scenario_id
    fixture_root.mkdir(parents=True, exist_ok=True)
    from backend.vision.fixtures import _normal_image

    for i in range(8):
        from cv2 import imwrite

        img = _normal_image(sc.vision_model.input_size, seed=i)
        imwrite(str(fixture_root / f"normal_{i:04d}.png"), img)
    normals = sorted(fixture_root.glob("normal_*.png"))
    backend = PatchCoreLiteCPU(input_size=sc.vision_model.input_size)
    backend.fit([VisionInput(image_id=p.stem, image_path=p) for p in normals])
    for p in normals:
        result = backend.predict(VisionInput(image_id=p.stem, image_path=p))
        assert 0.0 <= result.detection.anomaly_score <= 1.0 + 1e-6
        assert math.isfinite(result.detection.anomaly_score)


def test_unknown_backend_factory_raises() -> None:
    with pytest.raises(ValueError):
        build_backend("nonsense")