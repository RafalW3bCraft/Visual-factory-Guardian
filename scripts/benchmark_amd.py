#!/usr/bin/env python3
"""AMD ROCm inference benchmark.

Runs the Anomalib PatchCore backend end-to-end on the configured
MVTec AD category, measures inference latency, and prints a JSON
summary that the team can paste into ``docs/AMD_SETUP.md``.

This script NEVER fabricates numbers. On hosts without ROCm (or
without torch+anomalib installed) it prints a clear "skipped"
message and exits 0. The exit code is non-zero only when a real
benchmark run started but failed mid-way.

Usage::

    # 1. Install ROCm + ROCm-matched torch + anomalib
    pip install --index-url https://download.pytorch.org/whl/rocm torch
    pip install anomalib

    # 2. Download MVTec AD (one category is enough for the demo)
    python -m backend.vision.mvtec_download --accept-license \\
        --category bottle --root data/mvtec_ad

    # 3. Run the benchmark
    PYTHONPATH=. python scripts/benchmark_amd.py \\
        --mvtec-root data/mvtec_ad --category bottle --runs 50

The output is one JSON object on stdout and a human-readable
breakdown on stderr.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path


def _env_summary() -> dict:
    from backend.vision.amd_detect import summary

    return summary().to_dict()


def _print_env_summary(log: logging.Logger) -> None:
    summary = _env_summary()
    log.info("AMD environment: recommended_backend=%s", summary["recommended_backend"])
    log.info(
        "AMD GPUs (lspci): %s",
        [g["description"] for g in summary["amd_gpus"]] or "(none reported)",
    )
    log.info("DRI render nodes: %s", summary["dri_render_nodes"] or "(none)")
    log.info("ROCm install: root_exists=%s rocm_smi=%s",
             summary["rocm"]["rocm_root_exists"], summary["rocm"]["rocm_smi_on_path"])
    log.info("torch ROCm: %s", summary["torch"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mvtec-root", default=os.environ.get("VFG_MVTEC_ROOT", "data/mvtec_ad"))
    parser.add_argument("--category", default=os.environ.get("VFG_MVTEC_CATEGORY", "bottle"))
    parser.add_argument("--runs", type=int, default=50)
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--input-size", type=int, default=256)
    parser.add_argument("--output", default="-", help="Path for the JSON result file (- for stdout)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log = logging.getLogger("vfg.benchmark")
    _print_env_summary(log)

    summary = _env_summary()
    if not summary["torch"]["available"]:
        log.warning(
            "torch with ROCm is not available on this host. "
            "Skipping the AMD benchmark — install torch ROCm and re-run."
        )
        record = {
            "skipped": True,
            "reason": "torch_rocm_unavailable",
            "amd_environment": summary,
            "instructions": (
                "Install ROCm + torch ROCm + anomalib, then re-run. "
                "See docs/AMD_VERIFICATION_R1.md for the exact steps."
            ),
        }
        _emit(record, args.output, log)
        return 0

    from backend.vision.anomalib_backend import AnomalibPatchCore, is_available

    if not is_available():
        log.warning("anomalib is not installed. Skipping the AMD benchmark.")
        record = {
            "skipped": True,
            "reason": "anomalib_unavailable",
            "amd_environment": summary,
            "instructions": "pip install anomalib",
        }
        _emit(record, args.output, log)
        return 0

    if not Path(args.mvtec_root, args.category).is_dir():
        log.warning(
            "MVTec AD category directory not found at %s/%s. Skipping the AMD benchmark.",
            args.mvtec_root,
            args.category,
        )
        record = {
            "skipped": True,
            "reason": "mvtec_category_not_found",
            "amd_environment": summary,
            "instructions": (
                "Run `python -m backend.vision.mvtec_download --accept-license "
                f"--category {args.category} --root {args.mvtec_root}` and re-run."
            ),
        }
        _emit(record, args.output, log)
        return 0

    # Real benchmark path
    backend = AnomalibPatchCore(
        category=args.category,
        dataset_root=args.mvtec_root,
        image_size=(args.input_size, args.input_size),
    )
    backend.fit([])

    from backend.vision.mvtec_loader import list_test_images

    test_paths = list_test_images(Path(args.mvtec_root), args.category)
    if not test_paths:
        log.error("MVTec category %s has no test images", args.category)
        return 2
    log.info("Benchmarking on %d test images, %d warm-up + %d measured runs",
             len(test_paths), args.warmup, args.runs)

    from backend.vision.inference import VisionInput

    # Warm-up
    for r in range(args.warmup):
        for p in test_paths:
            backend.predict(VisionInput(image_id=p.stem, image_path=p))
    # Measured runs
    latencies_ms: list[float] = []
    for r in range(args.runs):
        for p in test_paths:
            t0 = time.perf_counter()
            backend.predict(VisionInput(image_id=p.stem, image_path=p))
            latencies_ms.append((time.perf_counter() - t0) * 1000.0)

    latencies_ms.sort()
    n = len(latencies_ms)
    p50 = latencies_ms[n // 2]
    p95 = latencies_ms[int(n * 0.95)] if n > 1 else latencies_ms[-1]
    p99 = latencies_ms[int(n * 0.99)] if n > 1 else latencies_ms[-1]

    import torch

    device_names = []
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            try:
                device_names.append(torch.cuda.get_device_name(i))
            except Exception:  # noqa: BLE001
                device_names.append(f"device:{i}")

    record = {
        "skipped": False,
        "amd_environment": summary,
        "benchmark": {
            "category": args.category,
            "input_size": args.input_size,
            "runs": args.runs,
            "warmup": args.warmup,
            "n_measurements": n,
            "p50_ms": round(p50, 3),
            "p95_ms": round(p95, 3),
            "p99_ms": round(p99, 3),
            "min_ms": round(latencies_ms[0], 3),
            "max_ms": round(latencies_ms[-1], 3),
            "throughput_imgs_per_s": round(1000.0 / p50, 2) if p50 > 0 else None,
        },
        "device": {
            "torch_version": torch.__version__,
            "torch_hip_compiled": bool(getattr(getattr(torch, "version", None), "hip", None)),
            "device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
            "device_names": device_names,
        },
    }
    _emit(record, args.output, log)
    return 0


def _emit(record: dict, output: str, log: logging.Logger) -> None:
    text = json.dumps(record, indent=2)
    if output == "-":
        sys.stdout.write(text + "\n")
    else:
        Path(output).write_text(text + "\n")
        log.info("Wrote benchmark record to %s", output)


if __name__ == "__main__":
    raise SystemExit(main())