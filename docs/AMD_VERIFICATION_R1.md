# AMD Verification — Branch `feat/cv-telemetry-rafal`

This file complements the draft `docs/AMD_SETUP.md` template with the
**verified** environment for this branch's CPU build. It is honest
about what was and was not run, per the responsible-claims rule in the
README.

## Detected hardware (this environment)

```bash
$ lspci | grep -iE 'vga|3d|display'
00:01.0 VGA compatible controller: Red Hat, Inc. Virtio 1.0 GPU (rev 01)

$ ls /opt/rocm 2>/dev/null || echo 'rocm not installed'
rocm not installed

$ python -c 'import torch' 2>&1 | head -1
ModuleNotFoundError: No module named 'torch'
```

The "GPU" reported by lspci is a virtualised Virtio device. There is
no AMD GPU, no ROCm runtime, no torch build, no Anomalib installation
on this machine. The Vega iGPU on the host CPU is reachable via
`/dev/dri/renderD128` but has no ROCm userspace.

The autodetect module (`backend.vision.amd_detect.summary()`) returns:

```json
{
  "amd_gpus": [],
  "dri_render_nodes": ["/dev/dri/renderD128"],
  "rocm": { "rocm_root_exists": false, "rocm_smi_on_path": false, "...": "..." },
  "torch": { "available": false, "note": "torch not installed" },
  "recommended_backend": "patchcore-lite"
}
```

The `auto` backend selection (`VFG_VISION_BACKEND=auto`, the default)
uses this summary and falls through to CPU PatchCore-lite, then to
the synthetic fixture.

## What was measured (real numbers)

All measurements are CPU only. They live in
`docs/EVALUATION_RESULTS.json` and are reproducible with the commands
in `docs/RAFAL_HANDOFF.md` §7.

* PatchCore-lite `/api/v1/events` latency: **p50 24.0 ms, p95 30.5 ms**
  (n=20, 3 warm-up). Each request runs 6 inference calls.
* Synthetic-fixture `/api/v1/events` latency: **p50 2.03 ms, p95 2.97 ms**
  (n=50, 3 warm-up).
* Synthetic-fixture `/api/v1/sensors` latency: **p50 3.64 ms, p95 6.16 ms**
  (n=50, 3 warm-up).
* PatchCore-lite accuracy on the synthetic fixture split:
  **6/6 (100%)**.

## What was **not** measured (and why)

* AMD ROCm inference latency — no AMD GPU + ROCm runtime is available.
* Anomalib/PatchCore with a deep CNN backbone — torch/anomalib are not
  installed because there is no ROCm runtime to exercise them on.
* MVTec AD AUROC — MVTec is not downloaded (licence check pending).
  `python -m backend.vision.mvtec_download --print-license` shows the
  licence terms; pass `--accept-license` to actually fetch the data.

## Reproduction on real AMD hardware

When an AMD ROCm machine becomes available:

1. Install the version-matched ROCm stack per
   https://rocm.docs.amd.com/.
2. Install the ROCm-matched PyTorch wheel for that ROCm version:

   ```bash
   pip install --index-url https://download.pytorch.org/whl/rocm torch
   ```

3. `pip install anomalib` (verify the chosen version supports the
   chosen Anomalib/PatchCore).
4. Download MVTec AD (one category is enough for the demo):

   ```bash
   python -m backend.vision.mvtec_download --print-license
   python -m backend.vision.mvtec_download --accept-license \
       --root data/mvtec_ad --category bottle
   ```

5. Run the auto-selected backend:

   ```bash
   export VFG_MVTEC_ROOT=$PWD/data/mvtec_ad
   export VFG_MVTEC_CATEGORY=bottle
   PYTHONPATH=. python -m backend.api.server
   ```

   The autodetect will pick `AnomalibPatchCore` because torch ROCm is
   available and the dataset is present.

6. Run the AMD benchmark:

   ```bash
   PYTHONPATH=. python scripts/benchmark_amd.py \
       --mvtec-root data/mvtec_ad --category bottle --runs 50
   ```

   The benchmark exits 0 with a JSON record on stdout containing the
   measured p50/p95/p99 latency, the device name, the torch version,
   and the ROCm / HIP version. Paste the JSON into the
   `docs/AMD_SETUP.md` template under the "AMD hardware / GPU",
   "ROCm version", "PyTorch version", "Anomalib version", "Model and
   input size", "Batch size", "Warm-up procedure", "Number of
   measured runs", "Median and p95 latency", "Throughput", and
   "Known compatibility issues" rows.

## Autodetect contract

The chain is fully deterministic:

| `has_torch_rocm` | `has_amd_hardware` or `has_rocm_runtime` | Selected backend |
|---|---|---|
| True  | *    | `anomalib` (Anomalib PatchCore) |
| False | True | `patchcore-lite` (CPU PatchCore-lite) |
| False | False| `synthetic` (deterministic fixture) |

Explicit overrides (`VFG_VISION_BACKEND=anomalib|patchcore-lite|synthetic`)
bypass autodetect. The explicit value always wins; an explicit
`anomalib` will raise a clear `RuntimeError` if torch/anomalib are not
importable rather than silently falling back.

## Why a CPU fallback was kept

Even when the host advertises AMD hardware (e.g. via a Vega iGPU),
the autodetect cannot guarantee a working ROCm userspace. The CPU
fallback ensures the API still boots and serves real inference, just
slower. Operators can promote to Anomalib/ROCm by installing the
matched ROCm stack — the autodetect will pick it up automatically.