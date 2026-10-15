# Module Addendum — `feat/cv-telemetry-rafal`

This addendum tracks the additions to the Visual Factory Guardian
repository made on the `feat/cv-telemetry-rafal` branch. It is
intentionally scoped to those additions so it can be merged
independently of the existing README.

## 1. MIT licence

The repository now ships an MIT `LICENSE` file
(`Copyright (c) 2026 RafalW3bCraft`) and the `pyproject.toml` reflects
that. The original README still stands; the new licence covers all the
newly added files in `backend/`, `configs/`, `scripts/`, `tests/`, and
the new docs in `docs/AMD_VERIFICATION_R1.md`, `docs/EVALUATION_RESULTS.json`,
and `docs/RAFAL_HANDOFF.md`.

## 2. Vision pipeline — autodetect + Anomalib

The vision backend now autodetects the environment and picks the best
available backend:

| `VFG_VISION_BACKEND` | Behaviour |
|---|---|
| `auto` *(default)* | ROCm → CPU PatchCore-lite → synthetic fixture |
| `anomalib` | Force Anomalib PatchCore (requires torch ROCm + anomalib + MVTec) |
| `patchcore-lite` | Force CPU PatchCore-lite (requires `data/fixtures`) |
| `synthetic` | Force the deterministic synthetic fixture |

Environment variables consumed at boot:

* `VFG_VISION_BACKEND` — see table above
* `VFG_FIXTURE_ROOT` — default `data/fixtures`
* `VFG_MVTEC_ROOT` — required for the `anomalib` backend
* `VFG_MVTEC_CATEGORY` — required for the `anomalib` backend
* `VFG_HEATMAP_DIR` — where the Anomalib backend writes anomaly maps
* `VFG_SCENARIO` — default `thermal-drift-001`

The autodetect chain (`backend.vision.amd_detect.summary()`) probes:

* AMD PCI devices via `lspci`
* `/dev/dri/renderD*` render nodes
* ROCm install at `/opt/rocm`, `rocm-smi` on PATH, ROCm env vars
* Torch ROCm (`torch.version.hip` + `torch.cuda.is_available()`)

When the autodetect fails (this CI host, no ROCm runtime) it falls
through to PatchCore-lite so the API still boots and serves real
inference.

## 3. AMD ROCm benchmark

`scripts/benchmark_amd.py` measures inference latency on a real ROCm
host. On a host without ROCm it exits 0 with a JSON
`{"skipped": true, "reason": "...", "amd_environment": {...}}` record
that the team can paste into `docs/AMD_SETUP.md`. The benchmark never
fabricates numbers — it prints a clear "skipped" message and exits 0
when the ROCm runtime or the dataset is unavailable.

Usage:

```bash
# On the AMD ROCm machine
pip install --index-url https://download.pytorch.org/whl/rocm torch
pip install anomalib
python -m backend.vision.mvtec_download --accept-license \
    --root data/mvtec_ad --category bottle
PYTHONPATH=. python scripts/benchmark_amd.py \
    --mvtec-root data/mvtec_ad --category bottle --runs 50
```

## 4. MVTec AD download

`python -m backend.vision.mvtec_download` is the new downloader:

```bash
python -m backend.vision.mvtec_download --print-license          # read licence
python -m backend.vision.mvtec_download --list-categories        # list categories
python -m backend.vision.mvtec_download --accept-license         # refused without --accept-license
python -m backend.vision.mvtec_download --accept-license \
    --root data/mvtec_ad --category bottle                       # single-category download
```

The downloader:

* requires the explicit `--accept-license` flag (refuses with exit 2 otherwise),
* verifies the XZ magic bytes after download,
* streams the archive into a temp dir and then moves the MVTec root
  into the final location,
* supports a single-category mode that removes all other categories to
  save ~80 % of disk.

The MVTec layout helper (`backend.vision.mvtec_loader`) provides typed
dataclasses over the official directory layout, plus a
`build_synthetic_mvtec` helper used by the test suite to exercise the
loader without a 4.9 GB download.

## 5. New tests

The test suite is now 77 tests (was 56) — the additional 21 cover the
AMD autodetect, the Anomalib backend's lazy-import / construction
contract, the MVTec licence gate, and the synthetic MVTec layout
loader.

```bash
PYTHONPATH=. pytest -ra tests/
# 77 passed in ~4s
```