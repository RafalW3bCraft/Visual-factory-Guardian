"""
Optional OpenAI-compatible LLM client for an open model served via vLLM on
AMD Developer Cloud.

Design goals:
  * ZERO external dependency — uses only the standard library (urllib). The
    project runs fully without it; this client is the *optional* AMD hook.
  * Graceful: if no endpoint is configured or the call fails, callers fall back
    to the deterministic explainer. The pipeline never hard-depends on a network
    service.

Configuration (environment variables):
  VFG_LLM_ENDPOINT   e.g. http://<amd-dev-cloud-host>:8000/v1   (vLLM server)
  VFG_LLM_MODEL      e.g. Qwen/Qwen2.5-7B-Instruct
  VFG_LLM_API_KEY    optional bearer token (vLLM can run keyless)
  VFG_LLM_TIMEOUT    seconds (default 30)

Start vLLM on the AMD GPU instance, for example:
  python -m vllm.entrypoints.openai.api_server \
      --model Qwen/Qwen2.5-7B-Instruct --dtype auto --port 8000
(ROCm build of PyTorch/vLLM on AMD Developer Cloud.)
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional


@dataclass
class LLMConfig:
    endpoint: Optional[str]
    model: str
    api_key: Optional[str]
    timeout: float

    @staticmethod
    def from_env() -> "LLMConfig":
        return LLMConfig(
            endpoint=os.getenv("VFG_LLM_ENDPOINT"),
            model=os.getenv("VFG_LLM_MODEL", "open-model"),
            api_key=os.getenv("VFG_LLM_API_KEY"),
            timeout=float(os.getenv("VFG_LLM_TIMEOUT", "30")),
        )


class LLMClient:
    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig.from_env()

    @property
    def available(self) -> bool:
        return bool(self.config.endpoint)

    def chat(self, system: str, user: str, max_tokens: int = 400,
             temperature: float = 0.2) -> Optional[str]:
        """Return the model's reply, or None on any failure (caller falls back)."""
        if not self.config.endpoint:
            return None
        url = self.config.endpoint.rstrip("/") + "/chat/completions"
        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            return body["choices"][0]["message"]["content"].strip()
        except (urllib.error.URLError, KeyError, ValueError, TimeoutError):
            return None
