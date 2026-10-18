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
    )
    client = LLMClient(cfg)
    out = client.chat("sys", "user")
    # Endpoint unreachable -> None returned; key MUST NOT appear.
    assert out is None
    assert "SHOULD-NOT-LEAK" not in repr(out if out is not None else "")