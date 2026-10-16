# Reasoning Layer — Root Cause, Retrieval & Explanation

Owner: **Arshad** (AI & root-cause analysis). This document covers the module
that turns structured sensor + vision evidence into ranked, cited, human-review-
gated explanations for an operator.

> All data in the default demo is **simulated**. The manual is a synthetic
> document. Nothing here asserts causation — outputs are evidence-supported
> hypotheses only.

## What it does

```
InspectionEvent (vision) + SensorReading[] (telemetry)
        │
        ▼
RootCauseEngine                       backend/root_cause/
  • rolling baseline (pre-change)      statistics.py
  • CUSUM change-point detection       statistics.py
  • z-score deviation + threshold      statistics.py
  • temporal precedence (lead time)    statistics.py
  • rank candidate causes vs KB        engine.py + data/knowledge/*.json
        │
        ▼
Explainer                              backend/reasoning/
  • BM25 manual retrieval (zero-API)   ../retrieval/manual_index.py
  • grounded explanation + uncertainty explainer.py
  • optional AMD vLLM rephrasing       llm_client.py
        │
        ▼
AnalysisResult (JSON)  ──►  /api/v1/analysis/{event_id}
```

## Design guarantees

- **Statistics produce the evidence; the LLM only explains it.** Candidate
  causes are ranked from measured deviation, threshold crossings, a documented
  prior, and whether the sensor shift **preceded** the defect. No LLM is in the
  ranking path.
- **Zero external API dependency by default.** The engine, retrieval and the
  default explainer run on `numpy` + the standard library only. No keys, no
  network, fully reproducible for tests and the demo.
- **AMD in scope, optional.** If an open model is served via vLLM on AMD
  Developer Cloud, set `VFG_LLM_ENDPOINT` and the explainer will use it to
  rephrase the *same* evidence; on any failure it falls back to the
  deterministic text. See `docs/AMD_LLM_SETUP.md`.
- **No causal claims, human-review gated.** Every result carries a disclaimer
  and `recommended_action.requires_human_review = true`.

## Public interface (what the team calls)

```python
from backend.reasoning.service import ReasoningService

service = ReasoningService()            # prefer_llm=True; falls back if no endpoint
result = service.analyse(event_dict, sensor_reading_dicts)   # -> dict (JSON-ready)
```

- `event_dict` follows the repo's inspection-event contract (`event_id`,
  `timestamp`, `scenario_id`, `line_id`, `image_id`, `detection{...}`).
- `sensor_reading_dicts` is a list of sensor events
  (`timestamp`, `sensor_id`, `metric`, `value`, `unit`, `source`, ...).
- `result` adds `sensor_evidence[]`, `candidate_causes[]`, `manual_citations[]`,
  `recommended_action`, `explanation`, `uncertainty`, `explainer_mode`,
  `disclaimer`.

### Interface to other modules
- **From Rafal (vision):** the `detection` block on the inspection event.
- **From the sensor stream:** raw `SensorReading`s (this module does its own
  change-point and baseline analysis, so the simulator only needs to emit raw
  telemetry in the shared schema).
- **To Devid (backend/dashboard):** the `AnalysisResult` dict, or mount the
  router in `backend/api/analysis_router.py`.

## Run it

```bash
pip install -r requirements-reasoning.txt       # just numpy for the core
PYTHONPATH=. python -m scripts.demo_root_cause   # end-to-end on mock data
PYTHONPATH=. python -m pytest -q                 # 16 unit tests
```

Mount the API (optional):

```python
# in the backend app
from backend.api.analysis_router import router
app.include_router(router)      # POST /api/v1/analysis, GET /api/v1/analysis/{event_id}
```

## Swapping the domain

The failure-mode knowledge base (`data/knowledge/tile_kiln_knowledge.json`) and
the manual (`data/manuals/tile_line_maintenance_manual.md`) are data files. To
change the category/story, edit those two files — no code change needed.

## Files

| Path | Purpose |
|------|---------|
| `backend/root_cause/schema.py` | Shared dataclasses (contract) |
| `backend/root_cause/statistics.py` | Baseline, CUSUM, z-score, lead time |
| `backend/root_cause/engine.py` | Evidence build + cause ranking |
| `backend/retrieval/manual_index.py` | Pure-Python BM25 manual retrieval |
| `backend/reasoning/explainer.py` | Grounded explanation + uncertainty |
| `backend/reasoning/llm_client.py` | Optional OpenAI-compatible vLLM client |
| `backend/reasoning/service.py` | One-call facade |
| `backend/api/analysis_router.py` | Optional FastAPI router |
| `scripts/mock_scenario.py` | Deterministic simulated scenario |
| `scripts/demo_root_cause.py` | CLI demo |
| `data/knowledge/*.json` | Failure-mode knowledge base |
| `data/manuals/*.md` | Synthetic maintenance manual |
| `tests/unit/*` | 16 unit tests |
