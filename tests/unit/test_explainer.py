from backend.reasoning.service import ReasoningService
from scripts.mock_scenario import make_mock_scenario


def test_service_end_to_end_deterministic():
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=False)
    result = service.analyse(event, readings)

    # Core contract fields present
    for key in ("event_id", "sensor_evidence", "candidate_causes",
                "manual_citations", "recommended_action", "explanation",
                "uncertainty", "disclaimer"):
        assert key in result

    assert result["explainer_mode"] == "deterministic"
    assert result["manual_citations"], "explainer should attach citations"
    assert "human" in result["explanation"].lower()
    # Never asserts proof of cause
    assert "proof" not in result["explanation"].lower() or \
           "not" in result["explanation"].lower()


def test_explanation_mentions_temperature_for_drift_scenario():
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=False)
    result = service.analyse(event, readings)
    assert "temperature" in result["explanation"].lower()


def test_llm_unavailable_falls_back_cleanly(monkeypatch):
    # No endpoint configured -> prefer_llm=True must still work deterministically
    monkeypatch.delenv("VFG_LLM_ENDPOINT", raising=False)
    event, readings = make_mock_scenario()
    service = ReasoningService(prefer_llm=True)
    result = service.analyse(event, readings)
    assert result["explainer_mode"] == "deterministic"
    assert result["explanation"]
