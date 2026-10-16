# Visual Factory Guardian

**Evidence-driven industrial anomaly detection on AMD infrastructure**

Visual Factory Guardian is a hackathon prototype for helping production-line operators identify suspicious products, inspect related machine telemetry, and investigate plausible contributing factors with traceable evidence.

> **Project status:** The seven-chapter cinematic landing page and interactive guided investigation are implemented in `frontend/`. Python vision, telemetry and API modules are present (see the branch addendum below). The landing story uses explicitly synthetic visuals and telemetry; its explanation is deterministic. Manual retrieval and AMD inference validation remain unverified. The original project plan below is retained for the team.

## Run the interactive factory

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`, then `npm run preview -- --port 4173`. Use Node 22.12+ (or a supported newer LTS). The implementation was tested with Node 25.8.1; see the test report for the complete environment.

Open `/` for the continuous seven-chapter scroll story, or `/dashboard` for the existing operator investigation application. The landing uses one persistent React Three Fiber Canvas and GSAP ScrollTrigger to synchronize camera travel, product inspection, machine disassembly, sensor evidence and reassembly. It is a bundled guided simulation and needs no backend.

The React/TypeScript/Vite dashboard uses Three.js, React Three Fiber and Drei for a real procedural factory. Orbit and focus machinery, compare synthetic product inspections, scrub temperature/vibration/current, inspect event-linked evidence, and record a local demo review. Nine scenes and keyboard-accessible Presentation mode support a short judge walkthrough. Replay resets one deterministic 56-second scenario.

**Guided Simulation** is bundled and needs no backend after loading. Every score, signal and product illustration is explicitly synthetic. **Live Analysis** is a separate workspace that stays gated until a configured API passes its readiness check. It validates server records and never replaces errors with fixtures. Configure the public `VITE_API_BASE_URL` via `frontend/.env.example`; never place credentials in a Vite environment variable.

Verification commands: `npm test`, `npm run build`, `npm run format:check`, and `npm run test:e2e`. For browser tests, install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome binary. Playwright starts the production preview on port 4173.

Modern WebGL2 browsers receive the interactive scene; unsupported WebGL receives a textual process diagram with the investigation controls intact. Reduced-motion and mobile layouts are supported. All geometry/illustrations are original procedural assets; no dataset or third-party 3D asset is redistributed. The repository is MIT-licensed. The cinematic landing bundles Barlow Condensed and DM Sans under the SIL Open Font License; copies ship in `frontend/public/licenses/`.

- [Cinematic design and reference study](docs/CINEMATIC_DESIGN.md)
- [Cinematic verification and performance](docs/CINEMATIC_VERIFICATION.md)
- [Implementation audit](docs/FRONTEND_IMPLEMENTATION_AUDIT.md)
- [Frontend architecture and limitations](docs/FRONTEND_ARCHITECTURE.md)
- [Deterministic scenario and controls](docs/INTERACTIVE_DEMO.md)
- [Presentation guide](docs/PRESENTATION_GUIDE.md)
- [Live API integration proposal](docs/FRONTEND_API_INTEGRATION.md)
- [Executed tests and measured performance](docs/FRONTEND_TEST_REPORT.md)
- [Deployment and asset notes](docs/DEPLOYMENT.md)

---

## Contents

- [Vision and mission](#vision-and-mission)
- [The problem](#the-problem)
- [Proposed solution](#proposed-solution)
- [Demo workflow](#demo-workflow)
- [System architecture](#system-architecture)
- [Technology stack](#technology-stack)
- [Data and simulation strategy](#data-and-simulation-strategy)
- [Sensor component scope](#sensor-component-scope)
- [Team responsibilities](#team-responsibilities)
- [Implementation plan](#implementation-plan)
- [Success metrics](#success-metrics)
- [Repository structure](#repository-structure)
- [Planned backend setup](#planned-backend-setup)
- [API contract proposal](#api-contract-proposal)
- [Responsible claims and limitations](#responsible-claims-and-limitations)
- [References](#references)

## Vision and mission

### Vision
Help manufacturers identify quality problems earlier and make better maintenance decisions by turning fragmented production data into understandable, evidence-based action.

### Mission
Build a working simulated production-line workflow that combines visual anomaly detection, timestamped machine telemetry, statistical evidence, and technical-manual retrieval in one operator-facing application.

### Intended user
A production-line operator or maintenance technician investigating a defective product or an unexpected production-quality change.

### Core value
Instead of showing an isolated model score, the product connects an image inspection event to the sensor history around that event, shows what changed, explains uncertainty, and presents a traceable next step.

## The problem

Factories generate images, machine sensor readings, production records, maintenance reports, and technical manuals. The challenge is deciding which signals matter and what to investigate next.

Visual Factory Guardian aims to demonstrate a narrow, testable use case:

1. Flag an image that differs from normal product appearance.
2. Inspect machine signals before and after the inspection event.
3. Identify statistically unusual sensor behaviour and its timing.
4. Retrieve relevant instructions from a technical manual.
5. Present the evidence and a cautious recommended inspection step.

The prototype is not a certified industrial control system and will not directly control machinery.

## Proposed solution

The first version will support **one simulated production line, one selected image category, one deterministic fault scenario, and one end-to-end operator workflow**.

The pipeline:

1. **Image source:** Load images from a documented industrial anomaly-detection dataset and present them as a simulated conveyor stream.
2. **Computer vision:** Use Anomalib/PatchCore or a compatible baseline to score images for anomalies and produce localization maps when supported by the selected model.
3. **Telemetry simulator:** Generate timestamped normal sensor readings, then inject a configurable and repeatable signal drift or change.
4. **Event alignment:** Link image inspection events and sensor readings by scenario, line, and timestamps.
5. **Evidence analysis:** Compute rolling baselines, deviations, threshold events, and change points; report whether the signal change preceded or followed a defect event.
6. **Root-cause reasoning:** Rank plausible contributing factors from measured evidence. An LLM may explain the evidence but must not invent causal proof.
7. **Manual retrieval:** Retrieve relevant passages from a provided technical document and show source/page/section references where available.
8. **Dashboard:** Show the inspected image, anomaly score, localization, sensor trends, event timeline, evidence, confidence/uncertainty, and recommended next step.
9. **AMD workload:** Run and demonstrate a meaningful inference workload on AMD infrastructure using a compatible AMD/ROCm setup. Record the actual hardware/software configuration and measured latency.

## Demo workflow

A judge should be able to:

1. Open the dashboard and start a named scenario.
2. Watch normal and anomalous sample images enter the inspection flow.
3. See the vision model flag a suspicious image.
4. Inspect synchronized sensor history around that event.
5. See which signals changed, by how much, and whether the change occurred before or after the defect event.
6. Open the evidence-based explanation and its manual references.
7. Review a recommended human inspection action.
8. Replay the same scenario and obtain reproducible results.

The demo must clearly label which data is public benchmark data and which telemetry/fault timing is simulated.

## System architecture

```text
Industrial image dataset
        |
        v
Simulated conveyor / image event producer
        |
        v
Computer vision inference (Anomalib / PatchCore)
        |
        +-------------------------+
        |                         |
        v                         v
Image event + score       Timestamped sensor simulator
        |                         |
        +------------+------------+
                     v
           Event alignment layer
                     |
                     v
       Statistical evidence / change points
                     |
             +-------+--------+
             |                |
             v                v
     Manual retrieval    Root-cause candidate ranking
             |                |
             +-------+--------+
                     v
       Evidence-grounded explanation layer
                     |
                     v
           FastAPI backend / event store
                     |
                     v
           Operator-facing dashboard
```

### Design rules

- Every event uses a consistent timestamp format, `scenario_id`, and `line_id`.
- Sensor source is explicitly tagged as `simulated` or `real`.
- Keep model inference, sensor simulation, statistical analysis, and LLM explanation as separate modules.
- The statistical engine produces structured evidence; the LLM explains it.
- Do not treat an anomaly score as a calibrated probability unless calibration has been implemented and evaluated.
- Do not label temporal correlation as proven causation.
- Start with a mock/CPU mode so the whole pipeline can be integrated before AMD GPU access is available.

## Technology stack

| Layer | Proposed choice | Purpose |
|---|---|---|
| Language | Python | ML, simulation, backend, analysis |
| Computer vision | Anomalib + PatchCore baseline | Industrial image anomaly detection and localization |
| ML runtime | PyTorch with a verified AMD ROCm environment | Demonstrate meaningful AMD inference |
| API | FastAPI | Scenario, image event, telemetry, and analysis endpoints |
| Telemetry | Python simulator; NumPy/Pandas as needed | Repeatable sensor time series and fault injection |
| Statistical analysis | NumPy/Pandas + explicit rules/change-point method | Evidence generation and timing analysis |
| Manual retrieval | Lightweight text/chunk retrieval initially | Source-backed maintenance instructions |
| LLM | Optional open model served through vLLM on AMD infrastructure | Explain structured evidence and retrieved passages |
| Frontend | Team-selected web stack | Operator dashboard and event timeline |
| Testing | pytest + integration tests | Reproducibility and API/model contracts |
| Packaging | Docker/Compose if feasible | Repeatable launch and judge evaluation |

**Compatibility gate:** validate the chosen Anomalib, PyTorch, ROCm, GPU, and Python versions early. Do not assume that a generic CUDA installation or every model dependency will work unchanged on AMD. The exact AMD hardware and software versions used must be documented after testing.

## Data and simulation strategy

### Vision dataset

Recommended starting point: **MVTec AD**, using one category rather than attempting all 15. It contains normal training images and anomalous test images with pixel-level anomaly annotations. Select a category after checking which defects best support a clear demo and which files the team can legally download and use.

- Dataset site: https://www.mvtec.com/company/research/datasets/mvtec-ad
- Dataset paper: https://openaccess.thecvf.com/content_CVPR_2019/papers/Bergmann_MVTec_AD_--_A_Comprehensive_Real-World_Dataset_for_Unsupervised_Anomaly_CVPR_2019_paper.pdf

Review the current dataset licence and attribution requirements before redistributing images. Do not commit the dataset to this repository unless its licence permits it; provide download instructions and expected directory structure instead.

### Sensor data

For the first demo, generate a deterministic synthetic stream with documented normal ranges, noise, sampling interval, fault injection time, and units. Public image datasets do not contain synchronized readings for the same inspection events, so the sensor fault and its relation to the image stream are part of the simulation.

An industrial predictive-maintenance dataset such as AI4I 2020 may be explored as an additional reference, but it should not be presented as paired with MVTec images. Avoid adding a second dataset unless it improves the working demo.

### Reproducible scenario

A scenario configuration should define:

- Scenario and production-line IDs
- Random seed
- Sampling interval
- Sensor names, units, normal baseline, and noise
- Fault type, start time, duration, and magnitude
- Image sequence and inspection event times
- When the simulated defect rate changes
- Expected analysis outputs for tests

The same scenario should be replayable with the same event ordering and expected signals.

## Sensor component scope

The sensor owner is responsible for:

1. Implementing the telemetry generator and scenario configuration.
2. Generating temperature, vibration, and motor current/load; add RPM only if useful.
3. Implementing configurable normal and fault periods with deterministic fault injection.
4. Emitting timestamped records that follow the shared schema.
5. Calculating rolling statistics, baseline deviations, threshold events, and change-point evidence.
6. Exposing readings through the backend contract and supporting dashboard time-series views.
7. Writing tests for timestamps, units, reproducibility, and expected fault detection.
8. Documenting that telemetry and fault/defect synchronization are simulated.

**Interface to the rest of the team:** provide a stream of sensor records and a structured evidence summary. Do not implement the LLM root-cause explanation in the sensor module; that belongs to the reasoning owner.

Example sensor event:

```json
{
  "timestamp": "2026-10-12T10:15:00Z",
  "scenario_id": "scenario-001",
  "line_id": "line-01",
  "sensor_id": "temperature-01",
  "metric": "temperature",
  "value": 78.4,
  "unit": "degC",
  "source": "simulated",
  "fault_state": "temperature_drift"
}
```

The example value is illustrative only. Select sensible ranges for the documented simulated machine; do not imply it is a real industrial threshold.

## Team responsibilities

The assignments below reflect the team's proposed split and should be confirmed by the team before work starts.

| Owner / role | Responsibilities | Deliverables |
|---|---|---|
|   — Full-stack / integration | Frontend dashboard, backend APIs, integration, end-to-end testing | Running application, API integration, dashboard, demo deployment |
| Arshad — AI and root-cause analysis | Statistical root-cause engine, evidence-to-explanation flow, manual retrieval, vLLM/open-model setup if used | Candidate-cause ranking, cited explanation, AMD LLM service if in scope |
| Rafal — Computer vision | Dataset/category selection, preprocessing, Anomalib/PatchCore inference, anomaly scores/localization, AMD inference evaluation, vision output contract | Reproducible vision pipeline, sample outputs, evaluation and latency report |
| Member 4 — Sensor simulation / data | Telemetry generator, fault scenarios, time-series alignment, sensor analytics and validation | Scenario config, telemetry stream, sensor evidence output, tests |

### Cross-team contract

Before parallel implementation, agree on one shared event schema containing:

- `event_id`, `timestamp`, `scenario_id`, `line_id`, and `image_id`
- `anomaly_score` and model identifier
- Localization artifact reference if available
- Sensor evidence with signal name, value, unit, baseline, deviation, and time window
- Candidate causes and supporting evidence references
- Manual citations
- Recommended action and uncertainty
- Source provenance (`public_dataset`, `simulated`, or `real`)

Keep raw images, large model files, credentials, and private manuals out of Git unless there is a clear licence and security basis to include them.

## Implementation plan

The hackathon build window is 12–18 October 2026. Treat the schedule as a sprint plan and verify the final submission deadline in the event dashboard.

### Phase 0 — Scope freeze and shared contracts
**Target: before or at the start of the build**

- Confirm owners and communication channel.
- Choose one MVTec AD category and one scenario.
- Agree on event schema and API payloads.
- Create repository, README, `.gitignore`, environment example, and issue board.
- Identify the AMD environment and run a minimal PyTorch/ROCm validation.

**Exit condition:** every owner can state their inputs, outputs, and acceptance tests.

### Phase 1 — Independent vertical components
**Target: 12–13 October**

- Vision: load a small sample set and produce one structured prediction.
- Sensors: emit a deterministic baseline and injected-fault time series.
- Reasoning: consume mock evidence and retrieve a relevant manual passage.
- Full-stack: serve mock events and display them in the dashboard.

**Exit condition:** each component runs independently with a documented command.

### Phase 2 — End-to-end vertical slice
**Target: 14–15 October**

- Connect image inference to event generation.
- Align image events with sensor timestamps.
- Pass sensor evidence to the root-cause module.
- Display image, timeline, explanation, and citation in one flow.
- Add a scenario start/replay control.

**Exit condition:** one complete scenario runs from image to operator-facing recommendation.

### Phase 3 — AMD validation and measurable evaluation
**Target: 15–16 October**

- Run the actual inference workload on AMD infrastructure.
- Record hardware, ROCm, PyTorch, model, input size, and batch size.
- Measure inference latency and model quality on the selected evaluation split.
- Test normal and injected-fault scenarios.
- Fix integration failures before adding optional features.

**Exit condition:** results are reproducible, honestly reported, and included in the README or evaluation document.

### Phase 4 — Demo hardening and submission
**Target: 17–18 October**

- Freeze features; prioritize reliability over new functionality.
- Test clean setup and demo instructions.
- Deploy the demo and confirm public access.
- Record the demo video and prepare pitch slides and cover image.
- Verify the public GitHub repository, README, project description, technology tags, and submission form.
- Check the event dashboard for the authoritative deadline.

**Exit condition:** a judge can follow the demo without team intervention or hidden setup steps.

## Success metrics

Do not invent performance figures. Measure and report the following once the pipeline is implemented.

### Computer vision
- Image-level AUROC or another suitable image-level metric
- Pixel-level localization metric if masks are produced
- False-positive and false-negative examples
- Inference latency and throughput on the actual AMD setup

### Sensor analysis
- Whether injected faults are detected in the expected time window
- Detection delay after the configured fault start
- False alerts during the normal baseline
- Correct ordering of sensor changes and simulated defect events

### End-to-end workflow
- Time from image event to visible alert/explanation
- Percentage of demo events with traceable evidence and manual citations
- Successful replay rate for the deterministic scenario
- Operator-task completion time in a small, clearly described test

### Business value
Estimate potential reduction in investigation time or unnecessary inspection only as a scenario-based projection unless validated with real factory data. Clearly distinguish measured prototype performance from projected business impact.

## Repository structure

```text
visual-factory-guardian/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── pyproject.toml
├── docker-compose.yml
├── backend/
│   ├── api/
│   ├── ingestion/
│   ├── simulation/
│   ├── vision/
│   ├── telemetry/
│   ├── root_cause/
│   ├── retrieval/
│   └── evaluation/
├── frontend/
├── configs/
│   └── scenarios/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── DATASET_CARD.md
│   ├── AMD_SETUP.md
│   └── EVALUATION.md
├── tests/
│   ├── unit/
│   └── integration/
└── scripts/
```

Create only the directories that are actively used; avoid empty scaffolding that makes the project appear more complete than it is.

## Planned backend setup

The commands below are the original backend proposal. The Python package and entry point do not exist yet; use the working frontend setup above for the current demo.

```bash
git clone https://github.com/RafalW3bCraft/visual-factory-guardian.git
cd visual-factory-guardian

python -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
pip install -e ".[dev]"
cp .env.example .env
```

Once dependencies and the entry point exist, document the exact command to start the API, the frontend, and the demo scenario. Do not claim these commands work until they have been tested in a clean environment.

For an AMD setup, follow the version-matched official ROCm/PyTorch instructions and record the exact environment in `docs/AMD_SETUP.md`. Keep a CPU/mock mode for integration and development.

## API contract proposal

These endpoints are proposals to agree on before implementation.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/scenarios/start` | Start a named deterministic scenario |
| `POST` | `/api/v1/scenarios/stop` | Stop the active scenario |
| `GET` | `/api/v1/events` | List inspection events |
| `GET` | `/api/v1/sensors` | Query telemetry by line and time window |
| `GET` | `/api/v1/analysis/{event_id}` | Retrieve evidence and root-cause analysis |
| `GET` | `/api/v1/health` | Health/readiness check |

Example inspection event:

```json
{
  "schema_version": "1.0",
  "event_id": "evt-0001",
  "timestamp": "2026-10-12T10:15:00Z",
  "scenario_id": "scenario-001",
  "line_id": "line-01",
  "image_id": "sample-0042",
  "detection": {
    "model": "patchcore",
    "anomaly_score": 0.91,
    "localization_ref": null
  },
  "sensor_evidence": [],
  "candidate_causes": [],
  "manual_citations": [],
  "recommended_action": null
}
```

Example scores are illustrative and must not be presented as measured results or probabilities. Freeze the schema collaboratively before separate modules begin to depend on it.

## Responsible claims and limitations

- The first version is a simulated prototype, not a production-certified industrial system.
- Public benchmark images and synthetic telemetry are not synchronized real-world observations.
- Fault injection demonstrates that the pipeline can detect and explain a designed scenario; it does not prove a real machine fault causes a specific visual defect.
- Root-cause outputs are hypotheses supported by evidence, not causal proof.
- Maintenance recommendations should be advisory and cite source documentation; they must not trigger unsafe machine control.
- Dataset licence, attribution, model licence, and manual redistribution permissions must be checked.
- Never commit API keys, access tokens, credentials, or confidential industrial data. Use environment variables and keep `.env` out of version control.

## References

- AMD Developer Hackathon: ACT III event page: https://lablab.ai/event/amd-developer-hackathon-act-iii
- AMD ROCm documentation: https://rocm.docs.amd.com/
- MVTec AD dataset: https://www.mvtec.com/company/research/datasets/mvtec-ad
- MVTec AD paper (CVPR 2019): https://openaccess.thecvf.com/content_CVPR_2019/papers/Bergmann_MVTec_AD_--_A_Comprehensive_Real-World_Dataset_for_Unsupervised_Anomaly_CVPR_2019_paper.pdf
- Anomalib PatchCore guide: https://anomalib.readthedocs.io/en/lib-v2.5.1/markdown/guides/reference/models/image/patchcore.html

---

**Status note:** The frontend section documents implemented behavior. The remaining architecture, Python stack, model, dataset and AMD work above describes the retained team proposal; it is not evidence that those services exist.
## Branch addendum — `feat/cv-telemetry-rafal`

> This section is a strictly additive companion to the README above.
> It documents the computer-vision, telemetry, evidence, and AMD
> autodetect modules that ship on the `feat/cv-telemetry-rafal`
> branch. The README above is unchanged.

### What this branch adds

* A deterministic **telemetry simulator** that replays the
  `thermal-drift-001` scenario bit-identically on every run
  (temperature / vibration / motor current, three sensors, 171 records
  over 56 seconds, fault injected at second 18).
* A **vision pipeline** with three interchangeable backends behind one
  `VisionBackend` interface: a CPU `PatchCoreLiteCPU` (sklearn KNN over
  patch embeddings), a deterministic `SyntheticFixtureBackend`, and an
  `AnomalibPatchCore` that activates automatically when torch ROCm +
  Anomalib are installed.
* An **AMD ROCm autodetect module** that probes `lspci`, `/dev/dri`,
  `/opt/rocm`, `rocm-smi`, and the torch HIP bindings — and picks the
  best backend this host can actually run. The chain is
  `anomalib → patchcore-lite → synthetic`.
* An **MVTec AD downloader** that enforces the MVTec non-commercial
  research licence (`--accept-license` is mandatory), verifies the
  archive, and supports a single-category mode that keeps only the
  requested category.
* A **FastAPI** surface (`/api/v1/{health, scenarios/start, scenarios/stop,
  events, sensors, analysis/{event_id}}`) with Pydantic schemas that
  mirror the frontend's Zod validators 1:1.
* An **event-alignment** layer and a **sensor evidence builder** that
  compute rolling baselines, threshold breaches, drift lead/lag, and a
  deterministic evidence-grounded explanation.
* **77 tests** (unit + integration + live-uvicorn smoke) that pass in
  ~4 seconds on CPU.

### Setup (CPU — works everywhere)

Tested on Python 3.13, Debian, no AMD GPU required.

```bash
# 1. Clone and check out the branch
git clone https://github.com/RafalW3bCraft/Visual-factory-Guardian.git
cd Visual-factory-Guardian
git checkout feat/cv-telemetry-rafal

# 2. Create a virtualenv and install the CPU dependencies
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"

# 3. Generate the synthetic fixture images so the API can run PatchCore-lite
python -m backend.vision.fixtures --scenario thermal-drift-001
#   -> writes 24 normal_*.png + img-001..img-006.png under data/fixtures/thermal-drift-001/
```

### Setup (AMD ROCm — when real hardware is available)

```bash
# 1. Install the ROCm stack per https://rocm.docs.amd.com/
#    Note the ROCm version (e.g. 6.1).

# 2. Install the ROCm-matched torch wheel
pip install --index-url https://download.pytorch.org/whl/rocm torch

# 3. Install Anomalib and verify it matches the chosen torch version
pip install anomalib

# 4. Download MVTec AD (licence acceptance is mandatory)
python -m backend.vision.mvtec_download --print-license            # read first
python -m backend.vision.mvtec_download --accept-license \
    --root data/mvtec_ad --category bottle

# 5. Point the API at the dataset and start it
export VFG_MVTEC_ROOT=$PWD/data/mvtec_ad
export VFG_MVTEC_CATEGORY=bottle
PYTHONPATH=. python -m backend.api.server --port 8000
# The autodetect will pick AnomalibPatchCore automatically.

# 6. Run the AMD benchmark — exits 0 with a JSON record on stdout
PYTHONPATH=. python scripts/benchmark_amd.py \
    --mvtec-root data/mvtec_ad --category bottle --runs 50
```

The benchmark JSON can be pasted straight into `docs/AMD_SETUP.md` (the
template there has rows for GPU, ROCm, PyTorch, Anomalib, model,
input size, batch size, warm-up, runs, p50/p95, throughput, and known
issues).

### Usage — run the demo (no network required)

```bash
PYTHONPATH=. python scripts/run_demo.py --backend auto
# Auto picks: Anomalib → PatchCore-lite → synthetic, based on the host.
```

The script walks through every documented endpoint and prints the
exact JSON the frontend receives.

### Usage — run the live API server

```bash
# Default autodetect
PYTHONPATH=. python -m backend.api.server --port 8000

# Force a specific backend
VFG_VISION_BACKEND=synthetic     PYTHONPATH=. python -m backend.api.server
VFG_VISION_BACKEND=patchcore-lite PYTHONPATH=. python -m backend.api.server
VFG_VISION_BACKEND=anomalib      PYTHONPATH=. python -m backend.api.server
```

Test it:

```bash
curl -s http://localhost:8000/api/v1/health | python -m json.tool
curl -s -X POST http://localhost:8000/api/v1/scenarios/start \
     -H 'Content-Type: application/json' \
     -d '{"scenario_id":"thermal-drift-001"}' | python -m json.tool
curl -s "http://localhost:8000/api/v1/events?scenario_id=thermal-drift-001" \
     | python -m json.tool
```

### Usage — run the tests

```bash
PYTHONPATH=. pytest -ra tests/                # full suite (77 tests, ~4 s)
PYTHONPATH=. pytest tests/unit/               # unit only
PYTHONPATH=. pytest tests/integration/        # integration + live uvicorn smoke
PYTHONPATH=. pytest -k amd                    # only the AMD autodetect tests
PYTHONPATH=. pytest -k mvtec                  # only the MVTec loader tests
```

### Environment variables

| Variable                | Default                | Purpose |
|-------------------------|------------------------|---------|
| `VFG_VISION_BACKEND`    | `auto`                 | `auto` / `anomalib` / `patchcore-lite` / `synthetic` |
| `VFG_SCENARIO`          | `thermal-drift-001`    | Scenario id (resolves under `configs/scenarios/`) |
| `VFG_FIXTURE_ROOT`      | `data/fixtures`        | PatchCore-lite training-set root |
| `VFG_MVTEC_ROOT`        | *(unset)*              | MVTec AD root for the Anomalib backend |
| `VFG_MVTEC_CATEGORY`    | *(unset)*              | MVTec category name (`bottle`, `cable`, …) |
| `VFG_HEATMAP_DIR`       | `data/heatmaps`        | Where the Anomalib backend writes anomaly maps |

### Backend selection rules

| `VFG_VISION_BACKEND` | Behaviour |
|---|---|
| `auto` *(default)* | ROCm → CPU PatchCore-lite → synthetic |
| `anomalib`         | Anomalib PatchCore (requires torch ROCm + anomalib + MVTec) |
| `patchcore-lite`   | CPU PatchCore-lite (requires `VFG_FIXTURE_ROOT`) |
| `synthetic`        | Deterministic fixture (no images required) |

The autodetect chain (the `auto` row) is fully deterministic:

| `has_torch_rocm` | `has_amd_hardware` or `has_rocm_runtime` | Selected backend |
|---|---|---|
| True  | *    | `anomalib` |
| False | True | `patchcore-lite` |
| False | False| `synthetic` |

### File layout — what's new on this branch

```text
backend/
├── api/                       # FastAPI app, Pydantic schemas, payload builders, uvicorn launcher
├── vision/
│   ├── amd_detect.py          # pure-stdlib ROCm / AMD / torch environment probe
│   ├── anomalib_backend.py    # Anomalib PatchCore with conditional torch/anomalib imports
│   ├── mvtec_download.py      # MVTec AD downloader with licence acceptance gate
│   ├── mvtec_loader.py        # typed walker for the official MVTec AD layout
│   ├── inference.py           # VisionBackend ABC + PatchCoreLiteCPU + SyntheticFixtureBackend + build_backend
│   └── fixtures.py            # synthetic fixture image generator
├── telemetry/simulator.py     # deterministic simulator matching the frontend's equations
├── scenario/loader.py         # typed scenario loader (configs/scenarios/*.json)
├── event_alignment/aligner.py # image↔sensor time alignment by scenario_id/line_id/event_id
└── sensor_evidence/builder.py # rolling baselines, threshold events, drift lead/lag
configs/scenarios/thermal-drift-001.json
scripts/
├── run_demo.py                # end-to-end in-process demo (no network)
└── benchmark_amd.py           # AMD ROCm benchmark (exits 0 with a skip record when ROCm is absent)
tests/                         # 77 tests covering all of the above
docs/
├── RAFAL_HANDOFF.md           # integration notes for dONYA / Arshad /  
├── RAFAL_ADDENDUM.md          # the concise version of this addendum
├── AMD_VERIFICATION_R1.md     # honest "no AMD GPU on this host" record + reproduction steps
└── EVALUATION_RESULTS.json    # measured CPU numbers (real, not fabricated)
LICENSE                        # MIT, Copyright (c) 2026 RafalW3bCraft
```

### Integration notes

* **Frontend adapter:** the response shapes match `frontend/src/services/api.ts`
  byte-for-byte; `VITE_API_BASE_URL=https://<host>` is all that's needed.
* **Root-cause / LLM:** consume `GET /api/v1/analysis/{event_id}` for the
  full `Analysis` payload (sensor evidence + candidate causes +
  explanation + recommended action). Add a new `llm_explanation`
  field if you want to replace the deterministic explanation; do not
  edit the existing `explanation` in place.
* **AMD validation:** when real hardware is available, run
  `scripts/benchmark_amd.py` and paste the JSON output into the
  template at `docs/AMD_SETUP.md`. Do not copy results from another
  machine.
* **Licence:** the repository ships under MIT (see `LICENSE`).
  MVTec AD remains under its own non-commercial research licence —
  the downloader enforces this and refuses to fetch without
  `--accept-license`.

### Where to read more

* `docs/RAFAL_HANDOFF.md` — full integration handoff for the rest of
  the team (dONYA, Arshad,  ).
* `docs/AMD_VERIFICATION_R1.md` — verified AMD environment record and
  exact reproduction steps for real ROCm hardware.
* `docs/EVALUATION_RESULTS.json` — measured CPU latency and accuracy.
* `docs/RAFAL_ADDENDUM.md` — the condensed form of this section.
