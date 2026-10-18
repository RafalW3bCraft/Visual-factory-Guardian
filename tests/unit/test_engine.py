from backend.root_cause.engine import RootCauseEngine
from backend.root_cause.schema import InspectionEvent, SensorReading
from scripts.mock_scenario import make_mock_scenario


def test_engine_ranks_temperature_first_on_drift_scenario():
    event, readings = make_mock_scenario()
    engine = RootCauseEngine()
    ev = InspectionEvent.from_dict(event)
    rs = [SensorReading.from_dict(r) for r in readings]
    result = engine.analyse(ev, rs)

    assert result.candidate_causes, "expected at least one candidate cause"
    top = result.candidate_causes[0]
    assert "thermal" in top.cause.lower() or "overheat" in top.cause.lower()
    assert top.temporal_precedence is True
    assert top.confidence in ("medium", "high")


def test_engine_marks_only_temperature_out_of_band():
    event, readings = make_mock_scenario()
    engine = RootCauseEngine()
    ev = InspectionEvent.from_dict(event)
    rs = [SensorReading.from_dict(r) for r in readings]
    result = engine.analyse(ev, rs)

    flagged = {e.metric for e in result.sensor_evidence if e.threshold_exceeded}
    assert "temperature" in flagged
    assert "vibration" not in flagged
    assert "motor_current" not in flagged


def test_recommendation_always_requires_human_review():
    event, readings = make_mock_scenario()
    engine = RootCauseEngine()
    ev = InspectionEvent.from_dict(event)
    rs = [SensorReading.from_dict(r) for r in readings]
    result = engine.analyse(ev, rs)
    assert result.recommended_action.requires_human_review is True


def test_scores_are_bounded():
    event, readings = make_mock_scenario()
    engine = RootCauseEngine()
    ev = InspectionEvent.from_dict(event)
    rs = [SensorReading.from_dict(r) for r in readings]
    result = engine.analyse(ev, rs)
    for c in result.candidate_causes:
        assert 0.0 <= c.score <= 1.0
