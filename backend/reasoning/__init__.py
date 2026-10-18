"""Explanation layer: grounded, zero-API by default, optional AMD vLLM."""
from .explainer import Explainer  # noqa: F401
from .llm_client import LLMClient, LLMConfig  # noqa: F401

__all__ = ["Explainer", "LLMClient", "LLMConfig"]
