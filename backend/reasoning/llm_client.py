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
  VFG_LLM_CB_FAILS   consecutive failures before the circuit opens (default 5)
  VFG_LLM_CB_COOLDOWN  seconds the circuit stays open before half-open probe
                       (default 60)

Start vLLM on the AMD GPU instance, for example:
  python -m vllm.entrypoints.openai.api_server \
      --model Qwen/Qwen2.5-7B-Instruct --dtype auto --port 8000
(ROCm build of PyTorch/vLLM on AMD Developer Cloud.)
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

_log = logging.getLogger("vfg.llm_client")


@dataclass
class LLMConfig:
    endpoint: Optional[str]
    model: str
    api_key: Optional[str]
    timeout: float
    cb_failure_threshold: int
    cb_cooldown_seconds: float

    @staticmethod
    def from_env() -> "LLMConfig":
        return LLMConfig(
            endpoint=os.getenv("VFG_LLM_ENDPOINT"),
            model=os.getenv("VFG_LLM_MODEL", "open-model"),
            api_key=os.getenv("VFG_LLM_API_KEY"),
            timeout=float(os.getenv("VFG_LLM_TIMEOUT", "30")),
            cb_failure_threshold=int(os.getenv("VFG_LLM_CB_FAILS", "5")),
            cb_cooldown_seconds=float(os.getenv("VFG_LLM_CB_COOLDOWN", "60")),
        )


class LLMClient:
    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig.from_env()
        # Circuit breaker state — kept per-instance. The reasoning service
        # creates a single LLMClient per process, so this is process-global
        # observability for the configured AMD endpoint.
        self._consecutive_failures = 0
        self._circuit_opened_at: Optional[float] = None

    @property
    def available(self) -> bool:
        return bool(self.config.endpoint)

    @property
    def failure_count(self) -> int:
        return self._consecutive_failures

    @property
    def circuit_open(self) -> bool:
        if self._circuit_opened_at is None:
            return False
        if (
            time.monotonic() - self._circuit_opened_at
            >= self.config.cb_cooldown_seconds
        ):
            # Cooldown elapsed — half-open: allow the next call through so
            # a successful response can close the circuit.
            self._circuit_opened_at = None
            return False
        return True

    def _record_failure(self, exc: BaseException) -> None:
        self._consecutive_failures += 1
        host = urlparse(self.config.endpoint or "").hostname or "?"
        # NEVER log the API key or the user prompt; only the failure kind
        # and the endpoint host so an operator can see which dep is sick.
        _log.warning(
            "LLM call failed (%s: %s) host=%s consecutive_failures=%d",
            type(exc).__name__,
            exc,
            host,
            self._consecutive_failures,
        )
        if (
            self._circuit_opened_at is None
            and self._consecutive_failures >= self.config.cb_failure_threshold
        ):
            self._circuit_opened_at = time.monotonic()
            _log.warning(
                "LLM circuit breaker OPEN for %.0fs after %d failures — "
                "subsequent calls will skip the network until cooldown elapses",
                self.config.cb_cooldown_seconds,
                self._consecutive_failures,
            )

    def _record_success(self) -> None:
        if self._consecutive_failures or self._circuit_opened_at is not None:
            _log.info(
                "LLM call succeeded after %d consecutive failures",
                self._consecutive_failures,
            )
        self._consecutive_failures = 0
        self._circuit_opened_at = None

    def chat(self, system: str, user: str, max_tokens: int = 400,
             temperature: float = 0.2) -> Optional[str]:
        """Return the model's reply, or None on any failure (caller falls back).

        Honours the circuit breaker: when open, returns None immediately
        without touching the network so a sick AMD endpoint cannot stall
        every analysis request for ``VFG_LLM_TIMEOUT`` seconds.
        """
        if not self.config.endpoint:
            return None
        if self.circuit_open:
            _log.debug("LLM circuit breaker open — skipping network call")
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
            text = body["choices"][0]["message"]["content"].strip()
            self._record_success()
            return text
        except (urllib.error.URLError, KeyError, ValueError, TimeoutError) as exc:
            self._record_failure(exc)
            return None
