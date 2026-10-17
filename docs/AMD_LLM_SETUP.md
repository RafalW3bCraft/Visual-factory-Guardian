# AMD vLLM Setup — Optional Explanation Backend

The reasoning layer runs fully without any LLM. This document is for the
**optional** step of serving an open model on **AMD Developer Cloud** so the
explainer rephrases the evidence with an LLM — this is how the reasoning layer
puts a workload on AMD hardware, satisfying the hackathon's "AMD must power a
meaningful part of the product" rule.

## 1. Provision an AMD GPU instance

Use AMD Developer Cloud (ROCm). Confirm the GPU is visible:

```bash
rocm-smi
python -c "import torch; print(torch.cuda.is_available(), torch.version.hip)"
```

`torch.cuda.is_available()` should be `True` on a ROCm PyTorch build, and
`torch.version.hip` should be set (not `None`).

## 2. Serve an open model with vLLM (OpenAI-compatible)

```bash
# ROCm build of vLLM on the AMD instance
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct \
    --dtype auto \
    --port 8000
```

This exposes an OpenAI-compatible API at `http://<host>:8000/v1`.

## 3. Point the explainer at it

Set environment variables where the app runs:

```bash
export VFG_LLM_ENDPOINT="http://<amd-host>:8000/v1"
export VFG_LLM_MODEL="Qwen/Qwen2.5-7B-Instruct"
# export VFG_LLM_API_KEY="..."   # only if you enabled one; vLLM can run keyless
# export VFG_LLM_TIMEOUT="30"
```

Then:

```python
from backend.reasoning.service import ReasoningService
service = ReasoningService(prefer_llm=True)      # uses the AMD endpoint
```

`explainer_mode` in the result will become `llm:Qwen/Qwen2.5-7B-Instruct`. If the
endpoint is unset or unreachable, it silently falls back to
`deterministic` — the demo never breaks.

## 4. Record the configuration for judging

Per the project's success metrics, record after testing: GPU model, ROCm
version, PyTorch/vLLM versions, the served model, and measured latency per
explanation. Put these in `docs/EVALUATION.md`.

## Guardrails

- The LLM is instructed to explain **only** the structured evidence it is given,
  to never invent values, and to never assert causation.
- The ranking of causes is done by statistics, not the LLM — the model only
  phrases the result.
- The client uses the Python standard library only (`urllib`); no extra pip
  dependency is added to the app.
