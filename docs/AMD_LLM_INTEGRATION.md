# AMD LLM (TokenFactory) Integration — Submission Status

This document records how the reasoning layer actually reaches AMD-hosted
inference for the AMD Developer Hackathon: ACT III submission. It complements
`docs/AMD_LLM_SETUP.md` (the operator guide for setting up the AMD endpoint)
and `docs/AMD_VERIFICATION_R1.md` (the ROCm Anomalib verification record).

## 1. What the integration actually does

The reasoning layer (Arshad's `backend.reasoning/`) ships a single
`ReasoningService.analyse(event, readings)` entry point that is invoked by
the FastAPI adapter for `GET /api/v1/analysis/{event_id}`. The service:

1. Runs the statistical `RootCauseEngine` against the live sensor stream.
2. Ranks candidate causes from the engine's evidence — the LLM does NOT
   rank. The ranking scores are explicitly **not** calibrated probabilities.
3. Retrieves the most relevant maintenance-manual sections using a pure-Python
   BM25 index over the synthetic manual.
4. Verbalises the structured result either deterministically (default) or
   through a configured AMD-hosted LLM, when one is reachable.

`backend.reasoning.llm_client.LLMClient` speaks the **OpenAI-compatible**
`POST {VFG_LLM_ENDPOINT}/chat/completions` protocol. Any server that exposes
that contract — including the AMD TokenFactory chat completions API — can be
plugged in via three environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `VFG_LLM_ENDPOINT` | yes (for AMD LLM mode) | Base URL of the AMD chat completions endpoint, e.g. `https://<host>/v1` |
| `VFG_LLM_MODEL` | recommended | Exact served-model id, e.g. `amd/Llama-3.1-8B-Instruct` |
| `VFG_LLM_API_KEY` | only if your endpoint enforces one | Bearer token (header only — never logged or returned) |
| `VFG_LLM_TIMEOUT` | optional (default `30`) | Seconds before falling back to deterministic mode |

The client uses the Python standard library only (`urllib`); no extra
dependency was added.

## 2. Current submission status — AMD inference gate

| Gate | Status | Evidence |
|---|---|---|
| Endpoint contract (`POST /chat/completions`) is OpenAI-compatible | **VERIFIED** | `tests/integration/test_llm_client.py` boots an in-process OpenAI-compatible mock, asserts request shape (`model`, `messages`, `Authorization`) |
| Endpoint reachable from the reasoning service | **VERIFIED** (mock) | Same test verifies a 200 response is consumed and `explainer_mode` becomes `llm:<model>` |
| Endpoint reachable against the real AMD TokenFactory API | **BLOCKED** | No AMD TokenFactory credentials are configured in this environment. The public portal `https://notebooks.amd.com/tokenfactory` requires authenticated sign-in to discover the account-specific model endpoint URL. The integration is wired and tested; only the secret is missing. |
| Reasoning service still works when AMD is unreachable | **VERIFIED** | `test_unreachable_endpoint_falls_back_to_deterministic` — service falls back to deterministic mode with no error |
| The LLM cannot influence the ranking | **VERIFIED** | `test_llm_response_is_verbalisation_not_ranking` — with stub LLM, the `candidate_causes` ranking is identical to the deterministic mode |
| API key never leaks into a response or log | **VERIFIED** | `test_api_key_never_returned_to_caller` — key absent from `chat()` return value; the client only sends it as `Authorization: Bearer …` |

### Required human action to unblock the AMD gate

Provide the following to enable real AMD inference:

1. Log in to the AMD TokenFactory portal at
   `https://notebooks.amd.com/tokenfactory` and create / select an API token.
2. Capture the **account-specific base URL** for chat completions
   (typically `https://<account>.notebooks.amd.com/v1` or a similarly
   shaped path) and the exact served model id assigned by the portal.
3. Export the three environment variables locally — never commit them:

   ```bash
   export VFG_LLM_ENDPOINT="https://<account>.notebooks.amd.com/v1"
   export VFG_LLM_MODEL="<model-id-from-portal>"
   export VFG_LLM_API_KEY="<token-from-portal>"
   ```

4. Re-run the analysis demo and confirm `explainer_mode` is
   `llm:<model-id>` in the response.

Until step 3 is satisfied the AMD gate is **BLOCKED**. The pipeline keeps
working in deterministic mode; no silent fallback is hidden.

## 3. How to verify the AMD gate without real credentials today

The integration is fully testable today by pointing the client at an
OpenAI-compatible mock. To reproduce:

```bash
# 1. Boot the backend (synthetic vision backend is sufficient).
PYTHONPATH=. python -m uvicorn backend.api.app:app --port 8000

# 2. In another shell, run the LLM-client integration tests. They start
#    their own mock and prove the wire format end-to-end.
PYTHONPATH=. pytest -ra tests/integration/test_llm_client.py -v
```

A successful run prints six `PASSED` lines, including:

* `test_reasoning_service_uses_llm_when_endpoint_configured` — proves that
  with a reachable OpenAI-compatible endpoint the reasoning layer sets
  `explainer_mode = llm:<configured-model-id>` and the response body
  contains the model's reply.
* `test_unreachable_endpoint_falls_back_to_deterministic` — proves that a
  remote failure does not raise and the deterministic path stays usable.

## 4. Honest disclosure

* The reasoning layer is the AMD workload in this submission: the
  statistical engine runs entirely on the CPU and produces the structured
  evidence; the **AMD-hosted LLM**, when configured, verbalises that
  evidence. The model never decides rankings and never invents values.
* No `VFG_LLM_API_KEY` value is stored in the repository, in screenshots,
  in test logs or in any committed JSON.
* If the AMD TokenFactory endpoint changes shape, only
  `backend/reasoning/llm_client.py` needs adjustment — the rest of the
  pipeline is model-agnostic.
* Without a real AMD credential the AMD requirement gate is reported as
  **BLOCKED**, not as **PASS**. The deterministic mode is the safe
  fallback the README and the demo script advertise.