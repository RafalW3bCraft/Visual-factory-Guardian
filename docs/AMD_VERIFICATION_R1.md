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
on this machine.

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

* AMD ROCm inference latency — no AMD GPU is available.
* Anomalib/PatchCore with a deep CNN backbone — torch/anomalib is not
  installed because there is no GPU to exercise it on, and the team's
  compatibility gate forbids installing a CUDA-only PyTorch on this
  host.
* MVTec AD AUROC — MVTec is not downloaded (licence check pending).
  The branch ships a deterministic synthetic fixture generator
  (`python -m backend.vision.fixtures`) so the integration can be
  exercised end-to-end without it.

## Reproduction on real AMD hardware

When an AMD ROCm machine becomes available:

1. Install the version-matched ROCm stack per
   https://rocm.docs.amd.com/.
2. Install the corresponding PyTorch wheel for that ROCm version.
3. `pip install anomalib` and verify its compatible PatchCore API.
4. Implement `AnomalibPatchCore` (sketch in `docs/RAFAL_HANDOFF.md`
   §4c) and select it with `VFG_VISION_BACKEND=anomalib`.
5. Re-run:

   ```bash
   PYTHONPATH=. python -m pytest -ra tests/
   ```

   Then run the latency benchmark block in `docs/RAFAL_HANDOFF.md` §4a
   and record the GPU model, ROCm version, PyTorch version,
   Anomalib version, model, input size, batch size, warm-up,
   measured runs, p50/p95 latency, throughput, and known issues in the
   `docs/AMD_SETUP.md` template. Do not copy results from another
   machine.