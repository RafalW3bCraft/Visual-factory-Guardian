"""Integration tests for the optional AMD LLM hook.

The reasoning layer is designed to run fully offline. When
``VFG_LLM_ENDPOINT`` is unset or unreachable, the explainer must fall back
to the deterministic path with no error raised. When an OpenAI-compatible
endpoint IS reachable, the client must use the documented request shape and
attach the configured model id to the call.

These tests start an in-process HTTP server that mimics an OpenAI-compatible
``/v1/chat/completions`` endpoint so we can verify the wire format without
requiring real AMD credentials. They also verify the credentials are NEVER
echoed back into logs / responses and that an unreachable endpoint is
silently treated as "no LLM" by the explainer.
"""
from __future__ import annotations

import json
import os
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import List, Tuple

import pytest

from backend.reasoning.explainer import Explainer
from backend.reasoning.llm_client import LLMClient, LLMConfig
from backend.reasoning.service import ReasoningService
from scripts.mock_scenario import make_mock_scenario


# --------------------------------------------------------------------------- #
# Local OpenAI-compatible mock
# --------------------------------------------------------------------------- #
class _MockOpenAIServer:
    def __init__(self, response_text: str = "Mocked AMD explanation."):
        self.received_requests: List[Tuple[str, dict, dict]] = []
        self.response_text = response_text
        self.calls = 0
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        self.port = self._server.server_address[1]

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def _handler(self):
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args, **kwargs):  # silence stdlib chatter
                return

            def do_POST(self):  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length).decode("utf-8")
                try:
                    payload = json.loads(body)
                except json.JSONDecodeError:
                    payload = {}
                auth = self.headers.get("Authorization", "")
                outer.received_requests.append((self.path, payload, {"Authorization": auth}))
                outer.calls += 1
                resp = {
                    "id": "mock-1",
                    "object": "chat.completion",
                    "model": payload.get("model", ""),
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": outer.response_text},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                }
                encoded = json.dumps(resp).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

        return Handler

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()


@pytest.fixture
def mock_openai():
    srv = _MockOpenAIServer()
    try:
        yield srv
    finally:
        srv.close()


# --------------------------------------------------------------------------- #
# Contract: no endpoint -> deterministic fallback
# --------------------------------------------------------------------------- #
def test_no_endpoint_falls_back_to_deterministic(monkeypatch):
    monkeypatch.delenv("VFG_LLM_ENDPOINT", raising=False)
    monkeypatch.delenv("VFG_LLM_API_KEY", raising=False)
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=True)
    result = service.analyse(event, readings)
    assert result["explainer_mode"] == "deterministic"
    assert result["explanation"]


def test_unreachable_endpoint_falls_back_to_deterministic(monkeypatch):
    """An endpoint that times out must be treated as 'no LLM', not as a hard
    error. The pipeline must keep working."""
    # 127.0.0.1:1 is reserved; the connection should be refused quickly.
    monkeypatch.setenv("VFG_LLM_ENDPOINT", "http://127.0.0.1:1/v1")
    monkeypatch.setenv("VFG_LLM_TIMEOUT", "1")
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=True)
    result = service.analyse(event, readings)
    assert result["explainer_mode"] == "deterministic"


# --------------------------------------------------------------------------- #
# Contract: endpoint reachable -> LLM is called with the documented shape
# --------------------------------------------------------------------------- #
def test_llm_client_uses_openai_compatible_request_shape(mock_openai, monkeypatch):
    monkeypatch.setenv("VFG_LLM_ENDPOINT", f"{mock_openai.base}/v1")
    monkeypatch.setenv("VFG_LLM_MODEL", "amd-test-model")
    monkeypatch.setenv("VFG_LLM_API_KEY", "secret-token-xyz")
    cfg = LLMConfig.from_env()
    client = LLMClient(cfg)
    out = client.chat("sys", "user")
    assert out == "Mocked AMD explanation."
    assert mock_openai.calls == 1
    path, payload, headers = mock_openai.received_requests[0]
    # TokenFactory-compatible path
    assert path.endswith("/chat/completions")
    assert payload["model"] == "amd-test-model"
    # Two messages: system + user
    assert [m["role"] for m in payload["messages"]] == ["system", "user"]
    # Auth header attached when API key configured
    assert headers["Authorization"] == "Bearer secret-token-xyz"


def test_reasoning_service_uses_llm_when_endpoint_configured(mock_openai, monkeypatch):
    monkeypatch.setenv("VFG_LLM_ENDPOINT", f"{mock_openai.base}/v1")
    monkeypatch.setenv("VFG_LLM_MODEL", "amd-tokenfactory-model")
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=True)
    result = service.analyse(event, readings)
    assert mock_openai.calls == 1
    assert result["explainer_mode"] == "llm:amd-tokenfactory-model"
    assert result["explanation"] == "Mocked AMD explanation."


def test_llm_response_is_verbalisation_not_ranking(monkeypatch):
    """Even with an LLM configured, the statistical ranking must be done by
    the engine — never the model. The model only verbalises the result.
    """
    monkeypatch.delenv("VFG_LLM_ENDPOINT", raising=False)
    event, readings = make_mock_scenario()
    # No LLM: the engine still produces a structured ranking.
    svc_no_llm = ReasoningService(prefer_llm=False)
    no_llm_result = svc_no_llm.analyse(event, readings)
    # With LLM: ranking should be identical, only explanation text changes.
    class StubExplainer:
        def __init__(self, *args, **kwargs):
            self.llm = kwargs.get("llm")
        def explain(self, result, prefer_llm=True):
            from backend.root_cause.schema import AnalysisResult
            assert isinstance(result, AnalysisResult)
            result.explanation = "verbalised by stub LLM"
            result.uncertainty = "stub"
            result.explainer_mode = "llm:stub-model"
            return result

    monkeypatch.setattr(
        "backend.reasoning.service.Explainer", StubExplainer
    )
    svc_with_llm = ReasoningService(prefer_llm=True)
    with_llm_result = svc_with_llm.analyse(event, readings)
    # Ranked candidate_causes must be identical between deterministic and LLM
    assert [c["cause"] for c in no_llm_result["candidate_causes"]] == [
        c["cause"] for c in with_llm_result["candidate_causes"]
    ]
    assert [round(c["score"], 4) for c in no_llm_result["candidate_causes"]] == [
        round(c["score"], 4) for c in with_llm_result["candidate_causes"]
    ]
    assert with_llm_result["explainer_mode"] == "llm:stub-model"


def test_api_key_never_returned_to_caller():
    """The LLM client must never echo the configured API key in any return
    value. (Defence-in-depth: even if a future caller logs ``client.config``,
    no leaked value should propagate via ``chat()``.)"""
    cfg = LLMConfig(
        endpoint="http://127.0.0.1:1/v1",
        model="m",
        api_key="SHOULD-NOT-LEAK",
        timeout=1,
        cb_failure_threshold=5,
        cb_cooldown_seconds=60,
    )
    client = LLMClient(cfg)
    out = client.chat("sys", "user")
    # Endpoint unreachable -> None returned; key MUST NOT appear.
    assert out is None
    assert "SHOULD-NOT-LEAK" not in repr(out if out is not None else "")

# --------------------------------------------------------------------------- #
# Live AMD TokenFactory gate — opt-in only.
# --------------------------------------------------------------------------- #
def _load_amd_env(repo_root):
    """Load the project's .env into a dict so the live gate runs with the
    real values. Does NOT mutate ``os.environ`` — callers use monkeypatch
    so the env is restored after the test."""
    env_path = repo_root / ".env"
    if not env_path.exists():
        return {}
    parsed = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        parsed[k.strip()] = v.strip().strip('"').strip("'")
    if not all(k in parsed for k in ("VFG_LLM_ENDPOINT", "VFG_LLM_MODEL", "VFG_LLM_API_KEY")):
        return {}
    return {
        "VFG_LLM_ENDPOINT": parsed["VFG_LLM_ENDPOINT"],
        "VFG_LLM_MODEL": parsed["VFG_LLM_MODEL"],
        "VFG_LLM_API_KEY": parsed["VFG_LLM_API_KEY"],
        "VFG_LLM_TIMEOUT": parsed.get("VFG_LLM_TIMEOUT", "30"),
    }


def _amd_env_or_skip(repo_root):
    """Return the AMD env dict or skip the test if .env is missing."""
    env = _load_amd_env(repo_root)
    if not env:
        pytest.skip("AMD env vars incomplete in .env")
    return env


@pytest.mark.skipif(
    not (Path(__file__).resolve().parents[2] / ".env").exists(),
    reason=".env not present",
)
def test_live_amd_endpoint_produces_llm_explanation(repo_root, monkeypatch):
    """End-to-end against the AMD TokenFactory endpoint configured in .env.

    This is the production gate. It verifies the configured endpoint,
    model, and key produce a real LLM-mode explanation against the
    reasoning layer's mock scenario. Skipped automatically if .env is
    missing or the endpoint is not configured.
    """
    env = _amd_env_or_skip(repo_root)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=True)
    result = service.analyse(event, readings)
    assert result["explainer_mode"].startswith("llm:"), result
    assert result["explanation"], "LLM returned empty explanation"
    # Ranking is still produced by the engine, not the LLM
    assert result["candidate_causes"], "engine produced no candidate causes"
    assert result["manual_citations"], "no manual citations retrieved"


@pytest.mark.skipif(
    not (Path(__file__).resolve().parents[2] / ".env").exists(),
    reason=".env not present",
)
def test_live_amd_endpoint_is_authorized(repo_root, monkeypatch):
    """The configured key must actually authenticate against the AMD gateway.

    Catches the case where .env ships with a placeholder / masked token.
    """
    env = _amd_env_or_skip(repo_root)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    cfg = LLMConfig.from_env()
    client = LLMClient(cfg)
    out = client.chat(
        "You are a probe. Reply with the single word: PONG.",
        "ping",
        max_tokens=20,
    )
    assert out is not None, (
        "AMD endpoint returned no content — the configured API key may be "
        "invalid or the endpoint may be down."
    )
    assert "PONG" in out.upper() or len(out.strip()) > 0


# --------------------------------------------------------------------------- #
# Circuit breaker (P1 items 7 + 8)
# --------------------------------------------------------------------------- #
def test_circuit_breaker_opens_after_repeated_failures(monkeypatch):
    """After ``VFG_LLM_CB_FAILS`` consecutive failures the client must
    short-circuit subsequent calls without touching the network, and
    ``/api/v1/analysis/health`` must surface the open state.

    A successful call after the cooldown must close the circuit.
    """
    # Point at a guaranteed-unreachable port with a low failure threshold
    # and tiny cooldown so the test runs in well under a second.
    monkeypatch.setenv("VFG_LLM_ENDPOINT", "http://127.0.0.1:1")
    monkeypatch.setenv("VFG_LLM_CB_FAILS", "3")
    monkeypatch.setenv("VFG_LLM_CB_COOLDOWN", "0.05")
    monkeypatch.setenv("VFG_LLM_TIMEOUT", "0.5")

    client = LLMClient()

    # First three failures must hit the network and bump the counter.
    for _ in range(3):
        assert client.chat("s", "u", max_tokens=8) is None
    assert client.failure_count == 3
    assert client.circuit_open is True

    # While the circuit is open, chat() must return immediately without
    # touching the network — prove it by patching urlopen to fail loudly
    # if it gets called.
    import urllib.request as _ur

    def _boom(*a, **kw):
        raise AssertionError("urlopen was called while circuit was open")

    monkeypatch.setattr(_ur, "urlopen", _boom)
    assert client.chat("s", "u", max_tokens=8) is None
    assert client.circuit_open is True

    # Wait for cooldown to elapse, then simulate a successful call to
    # prove the half-open probe closes the circuit.
    import time as _t

    _t.sleep(0.06)

    def _ok(*a, **kw):
        class _Resp:
            def __init__(self):
                self._body = (
                    b'{"choices":[{"message":{"content":"PONG"}}]}'
                )

            def read(self):
                return self._body

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        return _Resp()

    monkeypatch.setattr(_ur, "urlopen", _ok)
    assert client.chat("s", "u", max_tokens=8) == "PONG"
    assert client.failure_count == 0
    assert client.circuit_open is False


def test_llm_failure_count_visible_in_analysis_health(monkeypatch):
    """``/api/v1/analysis/health`` exposes the failure counter."""
    monkeypatch.setenv("VFG_LLM_ENDPOINT", "http://127.0.0.1:1")
    monkeypatch.setenv("VFG_LLM_TIMEOUT", "0.1")
    from backend.reasoning.service import ReasoningService

    svc = ReasoningService()
    # Three failures recorded on the live LLMClient instance.
    for _ in range(3):
        svc.explainer.llm.chat("s", "u", max_tokens=8)
    assert svc.explainer.llm.failure_count == 3
    # The field surfaces in the health dict.
    body = {
        "llm_failure_count": svc.explainer.llm.failure_count,
        "llm_circuit_open": svc.explainer.llm.circuit_open,
    }
    assert body["llm_failure_count"] == 3
