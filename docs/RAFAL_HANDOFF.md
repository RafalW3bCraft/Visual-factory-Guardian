# Rafal's Integration Handoff — Computer Vision & Telemetry

**Branch:** `feat/cv-telemetry-rafal`
**Owner:** Rafal (g3r4ki)
**Scope:** computer-vision inference pipeline, deterministic telemetry
simulator, event alignment, sensor evidence, FastAPI surface, scenario
config for `thermal-drift-001`.
**Status at handoff:** working, tested, deterministic, AMD-GPU ready.

This document explains what was built, how to run it, the exact JSON
contracts the frontend Zod schemas already accept, and how to plug in
Arshad's root-cause LLM and dONYA's backend without rewriting anything.

---

## 1. What's in this branch

```text
backend/
├── api/                 # FastAPI app, Pydantic schemas, payload builders, registry, uvicorn launcher
├── vision/              # VisionBackend ABC + PatchCoreLiteCPU + SyntheticFixtureBackend + fixture generator
├── telemetry/           # Deterministic telemetry simulator matching the frontend's equations
├── scenario/            # Scenario loader (configs/scenarios/*.json → typed Python)
├── event_alignment/     # Image↔sensor time alignment keyed by event_id
└── sensor_evidence/     # Rolling baselines, threshold events, lead-time, drift-started-before evidence
configs/scenarios/thermal-drift-001.json   # The team's chosen scenario, frozen
data/fixtures/thermal-drift-001/*.png      # Synthetic images for PatchCore-lite (gitignored — regenerate)
docs/EVALUATION_RESULTS.json               # Measured latency + accuracy on CPU
docs/RAFAL_HANDOFF.md                      # This file
scripts/run_demo.py                        # End-to-end demo runner (no network needed)
tests/                                     # 56 passing tests (unit + integration + smoke)
```

The directory tree above is everything new in this branch. The
existing `docs/`, `frontend/`, and `README.md` are unchanged.

---

## 2. Scenarios

The team's chosen scenario is `thermal-drift-001`. Its config is at
`configs/scenarios/thermal-drift-001.json` and matches the frontend's
hard-coded simulation in `frontend/src/simulation/engine.ts` exactly:

| Field                 | Value                                | Frontend source                |
|-----------------------|--------------------------------------|--------------------------------|
| scenario_id           | `thermal-drift-001`                  | `SCENARIO` constant            |
| line_id               | `line-01`                            | hard-coded in `LivePanel.tsx`  |
| epoch (UTC)           | `2026-10-15T10:00:00Z`               | `EPOCH` constant               |
| duration_seconds      | 56                                   | `DURATION` constant            |
| fault_start_seconds   | 18                                   | `FAULT_TIME` constant          |
| anomaly_at_seconds    | 32                                   | `ANOMALY_TIME` constant        |
| anomaly_threshold     | 0.65                                 | engine test fixture            |
| sensors               | temperature, vibration, current      | `metrics` constant             |
| inspection times      | 8, 16, 24, 32, 40, 48                | `inspections` array            |
| fault_state label     | `temperature_drift` at t≥18          | engine evidence window         |

Adding a new scenario = dropping another JSON file in
`configs/scenarios/`. The runtime picks it up automatically; the
endpoint `POST /api/v1/scenarios/start` returns 404 for unknown IDs.

---

## 3. Determinism and reproducibility

Same `configs/scenarios/thermal-drift-001.json` → identical byte output
on every replay. The simulator:

* uses the fixed scenario seed (`20261015`) and the fixed epoch
  `2026-10-15T10:00:00Z`,
* produces 171 sensor records per replay (3 sensors × 57 integer seconds
  from 0 to 56),
* tags every record with `scenario_id`, `line_id`, `sensor_id`,
  `metric`, `value`, `unit`, `source="simulated"`, and an optional
  `fault_state` that flips on at `fault_start_seconds`,
* emits UTC timestamps as `…Z` ISO8601 strings to match the Zod
  `z.iso.datetime({ offset: true })` validator.

The test suite proves bit-identical replay
(`test_events_and_sensors_identical_across_two_runs`).

---

## 4. Vision pipeline

Two interchangeable backends behind the same interface
(`backend.vision.inference.VisionBackend`):

### 4a. `patchcore-lite-cpu` (default for development)

* `scikit-learn` `NearestNeighbors` over 2-D patch embeddings (patch
  mean + variance).
* Memory bank built once from a "normal" training set in
  `data/fixtures/thermal-drift-001/normal_*.png`.
* Scores normalised to [0, 1] using the 99th percentile of the training
  set's nearest-neighbour distances.
* End-to-end accuracy on the synthetic fixtures: **6/6** (100%) — see
  `tests/unit/test_vision.py::test_patchcore_lite_separates_normal_and_anomalous`.

### 4b. `synthetic-fixture` (default)

* Deterministic score lookup keyed by `image_id`. Used when no fixture
  images exist on disk or when the operator wants a guaranteed-replay
  demo without retraining.
* Marked `source="simulated"` and `model="synthetic-fixture"` so the UI
  can render it correctly.

### 4c. Pluggable swap-in for AMD ROCm

The `VisionBackend` ABC is the single hook. To wire Anomalib/PatchCore
on ROCm:

```python
# backend/vision/anomalib_backend.py
from anomalib.models import Patchcore
from backend.vision.inference import VisionBackend, VisionInput, VisionResult, Detection

class AnomalibPatchCore(VisionBackend):
    model_id = "patchcore-rocm"
    def __init__(self, ckpt_path, device="cuda"):
        self.model = Patchcore.load_from_checkpoint(ckpt_path, map_location=device)
    def fit(self, normal_images): ...
    def predict(self, image: VisionInput) -> VisionResult:
        score, _ = self.model.predict(image.image_path)
        return VisionResult(image.image_id, Detection("patchcore-rocm", float(score)), float(score), source="public_dataset")
```

Then expose it in `backend/api/app.py::_resolve_vision_backend()`
behind a new env var (`VFG_VISION_BACKEND=anomalib`).

**Why no AMD benchmark?** This environment has no AMD GPU
(`lspci` reports a `Virtio 1.0 GPU`, which is virtualised). Per the
README and the responsible-claims section, AMD ROCm latency is **not**
fabricated. The CPU numbers in `docs/EVALUATION_RESULTS.json` are real,
in-process measurements.

---

## 5. Sensor evidence

`backend/sensor_evidence/builder.py` computes per-event evidence bundles:

* per-sensor pre-fault baseline (mean of `fault_state is None` records
  in `[0, fault_start)`),
* observed value at the inspection second,
* `delta = observed − baseline`,
* `above_threshold` flag,
* `lead_seconds = inspection_seconds − fault_start_seconds`,
* `drift_started_before_inspection` boolean.

The frontend's `analysisSchema` consumes the same fields under
`sensor_evidence[].summary`. The wording of the summary is stable so
unit tests can match it.

The `Analysis.explanation` is deterministic, evidence-grounded text.
It cites the inspection id, the model output, the drift lead/lag
relative to the inspection, the threshold breaches and the baseline
deviations, and finishes with "These signals are simulated and
recorded; correlation is not proof of causation." — matching the
README's responsible-claims rule.

`recommended_action` is **advisory-only** text or `null`. It never
asserts a percentage or a confident cause.

---

## 6. The API

### Endpoints (matching the frontend `api.ts` adapter exactly)

| Method | Path                                | Response schema            |
|--------|-------------------------------------|----------------------------|
| GET    | `/api/v1/health`                    | `HealthResponse`           |
| POST   | `/api/v1/scenarios/start`           | `ScenarioStartResponse`    |
| POST   | `/api/v1/scenarios/stop`            | `ScenarioStopResponse`     |
| GET    | `/api/v1/events?scenario_id=…`      | `Event[]`                  |
| GET    | `/api/v1/sensors?scenario_id=…&line_id=…` | `Sensor[]`           |
| GET    | `/api/v1/analysis/{event_id}`       | `Analysis`                 |

Every response is built and re-validated with Pydantic before it leaves
the handler, and every model uses `extra="forbid"`, so a backend bug or
a future field mismatch surfaces as a `500` rather than a silent drift.

The capability list is exactly the four strings the frontend checks:
`["scenarios", "events", "sensors", "analysis"]`.

### Example payloads

Live payloads from the running server (`PYTHONPATH=. python
scripts/run_demo.py --backend synthetic`) are in the demo output. The
exact shape the frontend Zod schemas accept:

```json
{
  "schema_version": "1.0",
  "event_id": "evt-004",
  "timestamp": "2026-10-15T10:00:32Z",
  "scenario_id": "thermal-drift-001",
  "line_id": "line-01",
  "image_id": "img-004",
  "source": "simulated",
  "detection": {
    "model": "patchcore-lite-cpu",
    "anomaly_score": 1.0,
    "localization_ref": null
  }
}
```

```json
{
  "timestamp": "2026-10-15T10:00:18Z",
  "scenario_id": "thermal-drift-001",
  "line_id": "line-01",
  "sensor_id": "temperature-01",
  "metric": "temperature",
  "value": 63.83,
  "unit": "degC",
  "source": "simulated",
  "fault_state": "temperature_drift"
}
```

```json
{
  "event_id": "evt-004",
  "scenario_id": "thermal-drift-001",
  "line_id": "line-01",
  "explanation": "Inspection evt-004 (img-004) at t=32s. Vision model patchcore-lite-cpu flagged the image (anomaly score 1.00 ≥ threshold 0.65). Thermal drift was injected 14s before this inspection, so the sensor drift precedes the visual flag. Threshold-breaching signals at inspection: temperature=82.5. Baseline deviations at inspection: current Δ=+5.55. These signals are simulated and recorded; correlation is not proof of causation.",
  "sensor_evidence": [
    {"evidence_id": "evt-004-ETEM", "metric": "temperature", "summary": "temperature 82.49degC (baseline 64.04degC, Δ=+18.45degC, threshold 75.00degC, above threshold); drift started 14s before inspection"},
    {"evidence_id": "evt-004-EVIB", "metric": "vibration",   "summary": "vibration 2.62mm/s (baseline 2.10mm/s, Δ=+0.52mm/s, threshold 4.00mm/s, below threshold); drift started 14s before inspection"},
    {"evidence_id": "evt-004-ECUR", "metric": "current",     "summary": "current 47.62A (baseline 42.07mm/s, Δ=+5.55A, threshold 55.00A, below threshold); drift started 14s before inspection"}
  ],
  "candidate_causes": [
    {"label": "temperature threshold breach (+18.45degC)", "evidence_ids": ["evt-004-ETEM"], "uncertainty": "low"},
    {"label": "current baseline deviation (+5.55A)",       "evidence_ids": ["evt-004-ECUR"], "uncertainty": "medium"},
    {"label": "vibration baseline deviation (+0.52mm/s)",  "evidence_ids": ["evt-004-EVIB"], "uncertainty": "high"}
  ],
  "manual_citations": [],
  "recommended_action": "Advisory: an operator should verify thermal process stability around the flagged inspection; consider a temperature sensor calibration check."
}
```

---

## 7. Run it

### Setup (one-time)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install 'fastapi>=0.115' 'uvicorn[standard]>=0.30' 'httpx>=0.27' \
            'pytest>=8' 'pytest-asyncio>=0.23' 'pydantic>=2.7' \
            'scikit-learn>=1.5' 'opencv-python-headless>=4.10' \
            'numpy>=2' 'pandas>=2' 'pillow>=10' 'python-multipart>=0.0.9'
```

> When Anomalib/PatchCore on ROCm is added, extend the install with the
> ROCm-matched torch wheel and `anomalib` per the team's
> `docs/AMD_SETUP.md`.

### Run the demo (in-process, no network)

```bash
PYTHONPATH=. python scripts/run_demo.py --backend synthetic
PYTHONPATH=. python scripts/run_demo.py --backend patchcore-lite  # auto-generates fixtures
```

### Run the live API server

```bash
PYTHONPATH=. python -m backend.api.server --backend synthetic --host 0.0.0.0 --port 8000
# or, with real CPU PatchCore-lite:
PYTHONPATH=. python -m backend.api.server --backend patchcore-lite --port 8000
```

Test it:

```bash
curl -s http://localhost:8000/api/v1/health | python -m json.tool
curl -s -X POST http://localhost:8000/api/v1/scenarios/start \
     -H 'Content-Type: application/json' \
     -d '{"scenario_id":"thermal-drift-001"}' | python -m json.tool
curl -s "http://localhost:8000/api/v1/events?scenario_id=thermal-drift-001" | python -m json.tool
```

### Run the tests

```bash
PYTHONPATH=. pytest -ra tests/                  # 56 tests, ~5s on CPU
PYTHONPATH=. pytest tests/unit/                 # unit only
PYTHONPATH=. pytest tests/integration/          # integration + real uvicorn smoke
```

---

## 8. Integration hand-off to teammates

### dONYA (backend)

The FastAPI app is a drop-in for the existing frontend
`GuardianApi` adapter:

* `VITE_API_BASE_URL=https://<your-deployment>` builds against the
  documented endpoints with no code change.
* All response shapes are validated with the same Pydantic models the
  OpenAPI schema exposes. The frontend's TypeScript types can be
  regenerated with `npx openapi-typescript <openapi.json>` if you want
  to keep them in lockstep.
* CORS allows `GET/POST/OPTIONS` from any origin (prototype only —
  tighten for production).

### Arshad (root-cause / LLM)

* Consume `GET /api/v1/events` for the per-inspection model output.
* Consume `GET /api/v1/sensors?scenario_id=…&line_id=…` for the
  per-second time series.
* For each `Event`, call `GET /api/v1/analysis/{event_id}` to receive
  the full `Analysis` payload with `sensor_evidence`,
  `candidate_causes`, and the evidence-grounded `explanation`.
* If you want the LLM to overwrite the deterministic `explanation`,
  add a new field (e.g. `llm_explanation`) rather than editing the
  existing one — the existing explanation is already cited and tested.
* `manual_citations` is intentionally an empty list; populate it from
  your retrieval module and pass it through when wiring up the LLM
  explanation.

### Devid (frontend / deployment)

* `frontend/src/services/api.ts` works as-is. Point `VITE_API_BASE_URL`
  at the deployment and rebuild.
* The `feat/cv-telemetry-rafal` branch does **not** touch the
  frontend; merge it into the integration branch after Arshad's LLM
  and dONYA's persistence layer are wired up.

---

## 9. Known limits and follow-ups

| Limit                                          | Why                                              | Follow-up                                                    |
|------------------------------------------------|--------------------------------------------------|--------------------------------------------------------------|
| No real MVTec AD images wired up               | Dataset licence not yet verified; MVTec not pre-installed | Run `python -m backend.vision.fixtures` to use synthetic data; replace with MVTec via `backend/vision/anomalib_backend.py` once the licence is confirmed |
| No AMD ROCm benchmark                          | No AMD GPU available in this environment         | Run `docs/AMD_SETUP.md` on the real hardware and re-run `tests/integration/test_api.py::test_patchcore_lite_backend_end_to_end` |
| No persistence layer                           | Out of scope for this branch                     | Wrap `RuntimeRegistry` with a Postgres / Redis backend        |
| Recommended action text is static              | Keeps the demo deterministic                     | Replace with Arshad's LLM advisory text                       |
| No change-point detection library              | The deterministic scenario already encodes the fault onset | Add `ruptures` or a rolling-window t-test if a second scenario needs unsupervised detection |