"""Generate deterministic synthetic fixture images for the thermal-drift scenario.

These images are *not* real MVTec AD samples. They are designed so that
the PatchCore-lite backend has a clean separation between "normal" and
"anomalous" patches:

  - normal_###.png : smooth radial gradient + low-amplitude noise
  - anomaly_###.png : the same gradient plus a localised bright blob

Both classes are produced from a fixed seed so re-runs produce
byte-identical outputs. The script writes to ``data/fixtures/<scenario>``.

Usage::

    python -m backend.vision.fixtures --scenario thermal-drift-001
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

from ..scenario.loader import load_scenario, list_scenarios


def _normal_image(size: tuple[int, int], seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    h, w = size
    yy, xx = np.mgrid[0:h, 0:w]
    center = np.array([h / 2.0, w / 2.0])
    d = np.sqrt((yy - center[0]) ** 2 + (xx - center[1]) ** 2)
    d /= d.max()
    base = 200 - 60 * d  # brighter in the centre
    noise = rng.normal(0, 4, size).astype(np.float32)
    img = np.clip(base + noise, 0, 255).astype(np.uint8)
    return img


def _anomalous_image(size: tuple[int, int], seed: int) -> np.ndarray:
    img = _normal_image(size, seed)
    rng = np.random.default_rng(seed + 1)
    h, w = size
    cy = int(rng.integers(h // 4, 3 * h // 4))
    cx = int(rng.integers(w // 4, 3 * w // 4))
    r = int(min(h, w) * (0.10 + 0.05 * rng.random()))
    cv2.circle(img, (cx, cy), r, 245, thickness=-1)
    # Add a bright "scratch" line
    angle = float(rng.uniform(0, np.pi))
    length = int(min(h, w) * 0.5)
    x0 = int(max(0, cx - length * np.cos(angle) / 2))
    y0 = int(max(0, cy - length * np.sin(angle) / 2))
    x1 = int(min(w - 1, cx + length * np.cos(angle) / 2))
    y1 = int(min(h - 1, cy + length * np.sin(angle) / 2))
    cv2.line(img, (x0, y0), (x1, y1), 240, thickness=2)
    return img


def generate_for_scenario(scenario_id: str, root: Path | None = None) -> Path:
    sc = load_scenario(scenario_id)
    out = (root or Path("data") / "fixtures") / sc.scenario_id
    out.mkdir(parents=True, exist_ok=True)
    h, w = sc.vision_model.input_size

    rng = np.random.default_rng(sc.random_seed)
    n_normal = 24  # a representative "training" set

    for i in range(n_normal):
        seed = int(rng.integers(0, 2**31 - 1))
        img = _normal_image((h, w), seed)
        cv2.imwrite(str(out / f"normal_{i:04d}.png"), img)

    for insp in sc.inspections:
        seed = int(rng.integers(0, 2**31 - 1))
        if insp.expected_label == "anomalous":
            img = _anomalous_image((h, w), seed)
        else:
            img = _normal_image((h, w), seed)
        cv2.imwrite(str(out / f"{insp.image_id}.png"), img)

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", default="thermal-drift-001")
    parser.add_argument("--root", default=None)
    args = parser.parse_args()
    out = generate_for_scenario(args.scenario, Path(args.root) if args.root else None)
    print(f"Wrote fixtures to {out}")


if __name__ == "__main__":
    main()