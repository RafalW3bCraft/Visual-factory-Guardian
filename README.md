# Visual Factory Guardian

**Evidence-driven industrial anomaly detection on AMD infrastructure**

Visual Factory Guardian is a hackathon prototype for helping production-line operators identify suspicious products, inspect related machine telemetry, and investigate plausible contributing factors with traceable evidence.

> **Project status:** Hackathon plan / implementation in progress. Features and performance figures must be marked as planned until implemented and measured.

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
- [Getting started](#getting-started)
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
| Devid — Full-stack / integration | Frontend dashboard, backend APIs, integration, end-to-end testing | Running application, API integration, dashboard, demo deployment |
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

## Getting started

The commands below are a proposed initial workflow; update them to match the actual implementation.

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

**Status note:** This README describes the proposed scope and plan. Update it as implementation, evaluation, deployment, and demo artifacts become real. Do not leave planned features or illustrative values presented as completed work.
