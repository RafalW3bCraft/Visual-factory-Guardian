"""
Evidence-to-explanation layer.

Turns the engine's structured evidence + ranked causes + manual citations into a
clear, operator-facing explanation and an uncertainty note.

Two modes:
  * deterministic (default): a grounded, template-based explanation built ONLY
    from the measured evidence. No network, no API — matches the zero-API
    requirement and is fully reproducible for tests and the demo.
  * llm (optional): if an AMD-hosted vLLM endpoint is configured, the LLM
    rephrases the SAME structured evidence into prose. It is instructed to
    explain only the provided evidence and never to assert causation. On any
    failure it falls back to deterministic output.

The explainer NEVER introduces facts beyond the evidence and never claims proof.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from backend.root_cause.schema import AnalysisResult, CandidateCause, ManualCitation
from backend.retrieval.manual_index import ManualIndex, load_manual_index
from .llm_client import LLMClient

_DEFAULT_MANUAL = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "manuals"
    / "tile_line_maintenance_manual.md"
)

_LLM_SYSTEM = (
    "You are a cautious industrial maintenance assistant. You explain ONLY the "
    "structured evidence you are given. You must not invent sensor values, must "
    "not assert that one thing caused another, and must describe findings as "
    "evidence-supported hypotheses. Always note that a human must review before "
    "any action. Keep it under 120 words."
)


class Explainer:
    def __init__(self, manual_path: Optional[str] = None,
                 llm: Optional[LLMClient] = None):
        path = manual_path or str(_DEFAULT_MANUAL)
        self.index: ManualIndex = load_manual_index(path)
        self.llm = llm if llm is not None else LLMClient()

    # ------------------------------------------------------------------ #
    def _manual_query(self, causes: List[CandidateCause],
                      result: AnalysisResult) -> str:
        parts: List[str] = []
        if causes:
            parts.append(causes[0].cause)
        for ev in result.sensor_evidence:
            if ev.direction != "stable":
                parts.append(f"{ev.metric} {ev.direction}")
        return " ".join(parts) if parts else "surface defect inspection"

    def retrieve_citations(self, result: AnalysisResult,
                           top_k: int = 3) -> List[ManualCitation]:
        query = self._manual_query(result.candidate_causes, result)
        return self.index.search(query, top_k=top_k)

    # ------------------------------------------------------------------ #
    def _deterministic_text(self, result: AnalysisResult) -> str:
        det = result.detection
        lines: List[str] = []
        lines.append(
            f"Image {result.image_id} on {result.line_id} was flagged by "
            f"{det.get('model')} with an anomaly score of "
            f"{det.get('anomaly_score')}."
        )

        moving = [e for e in result.sensor_evidence if e.direction != "stable"]
        if moving:
            frag = []
            for e in moving:
                piece = (
                    f"{e.metric} was {e.direction} "
                    f"({e.value_at_event}{e.unit} vs baseline "
                    f"{e.baseline}{e.unit}, z={e.z_score})"
                )
                if e.lead_time_seconds and e.lead_time_seconds > 0:
                    piece += (
                        f", changing about {e.lead_time_seconds:.0f}s before the "
                        f"inspection"
                    )
                frag.append(piece)
            lines.append("Around the event, " + "; ".join(frag) + ".")
        else:
            lines.append("No monitored sensor showed a clear shift around the event.")

        if result.candidate_causes:
            top = result.candidate_causes[0]
            lines.append(
                f"The strongest evidence-supported hypothesis is "
                f"\"{top.cause}\" (ranking score {top.score}, "
                f"{top.confidence} confidence"
                + (", and the signal change preceded the defect"
                   if top.temporal_precedence else "")
                + ")."
            )

        if result.manual_citations:
            c = result.manual_citations[0]
            page = f", p.{c.page}" if c.page is not None else ""
            lines.append(f"See {c.source}, Section {c.section}{page}.")

        lines.append(
            "This is a correlation-based hypothesis, not proof of cause; a human "
            "must review before any action."
        )
        return " ".join(lines)

    def _llm_text(self, result: AnalysisResult) -> Optional[str]:
        if not self.llm.available:
            return None
        ev_lines = [
            f"- {e.metric} ({e.signal}): {e.direction}, value {e.value_at_event}{e.unit}, "
            f"baseline {e.baseline}{e.unit}, z={e.z_score}, "
            f"threshold_exceeded={e.threshold_exceeded}, "
            f"lead_time_s={e.lead_time_seconds}"
            for e in result.sensor_evidence
        ]
        cause_lines = [
            f"- {c.cause} (score {c.score}, {c.confidence}, "
            f"precedes_defect={c.temporal_precedence})"
            for c in result.candidate_causes[:3]
        ]
        cite_lines = [
            f"- {c.source}, Section {c.section}, page {c.page}"
            for c in result.manual_citations[:2]
        ]
        user = (
            f"Detection: {result.detection}\n"
            f"Sensor evidence:\n" + "\n".join(ev_lines) + "\n"
            f"Candidate causes (ranked):\n" + "\n".join(cause_lines) + "\n"
            f"Manual references:\n" + "\n".join(cite_lines) + "\n\n"
            "Write a short operator explanation grounded only in the above."
        )
        return self.llm.chat(_LLM_SYSTEM, user)

    @staticmethod
    def _uncertainty(result: AnalysisResult) -> str:
        if not result.candidate_causes:
            return (
                "No sensor evidence supports a specific cause; confidence is low. "
                "Treat the image finding as unconfirmed."
            )
        top = result.candidate_causes[0]
        bits = [f"Top hypothesis confidence: {top.confidence}."]
        if not top.temporal_precedence:
            bits.append(
                "The sensor change was not clearly before the defect, which weakens "
                "the link."
            )
        if len(result.candidate_causes) > 1:
            second = result.candidate_causes[1]
            if top.score - second.score < 0.1:
                bits.append(
                    f"A competing hypothesis (\"{second.cause}\") scores similarly, "
                    "so more than one factor may be involved."
                )
        bits.append("Anomaly scores are not calibrated probabilities.")
        return " ".join(bits)

    # ------------------------------------------------------------------ #
    def explain(self, result: AnalysisResult,
                prefer_llm: bool = True) -> AnalysisResult:
        """Attach manual citations, explanation and uncertainty to a result."""
        result.manual_citations = self.retrieve_citations(result)

        text = None
        mode = "deterministic"
        if prefer_llm:
            text = self._llm_text(result)
            if text:
                mode = f"llm:{self.llm.config.model}"
        if not text:
            text = self._deterministic_text(result)

        result.explanation = text
        result.uncertainty = self._uncertainty(result)
        result.explainer_mode = mode
        return result
