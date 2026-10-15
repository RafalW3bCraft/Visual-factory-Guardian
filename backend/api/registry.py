"""Runtime registry.

A ``ScenarioRuntime`` holds:

  * the loaded ``Scenario`` config
  * the cached ``SensorRecord`` stream (deterministic for a given seed)
  * the cached event-alignment results
  * the cached evidence bundles

It is the single source of truth for ``/api/v1/*`` responses. Runtimes
are created lazily on the first ``POST /api/v1/scenarios/start`` call
and kept for the lifetime of the process (sufficient for a demo).
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Iterable

from ..event_alignment.aligner import AlignedInspection, align
from ..scenario.loader import Scenario, load_scenario
from ..sensor_evidence.builder import EvidenceBundle, build_evidence_for_event
from ..telemetry.simulator import SensorRecord, stream_sensor_records


@dataclass
class ScenarioRuntime:
    scenario: Scenario
    sensor_records: tuple[SensorRecord, ...]
    aligned: tuple[AlignedInspection, ...]

    def sensor_records_for_window(
        self, *, start: int | None = None, end: int | None = None
    ) -> list[SensorRecord]:
        s = start if start is not None else 0
        e = end if end is not None else self.scenario.duration_seconds
        return stream_sensor_records(self.scenario, start=s, end=e)

    def evidence_for(self, event_id: str) -> EvidenceBundle:
        insp = next((i for i in self.scenario.inspections if i.event_id == event_id), None)
        if insp is None:
            raise KeyError(f"Unknown event_id: {event_id}")
        return build_evidence_for_event(
            self.scenario, list(self.sensor_records), event_id, insp.at_seconds
        )


class RuntimeRegistry:
    """Thread-safe registry of scenario runtimes."""

    def __init__(self) -> None:
        self._runtimes: dict[str, ScenarioRuntime] = {}
        self._lock = threading.Lock()

    def get(self, scenario_id: str) -> ScenarioRuntime:
        with self._lock:
            runtime = self._runtimes.get(scenario_id)
            if runtime is None:
                scenario = load_scenario(scenario_id)
                sensor_records = tuple(stream_sensor_records(scenario))
                aligned = tuple(align(scenario, list(sensor_records)))
                runtime = ScenarioRuntime(
                    scenario=scenario,
                    sensor_records=sensor_records,
                    aligned=aligned,
                )
                self._runtimes[scenario_id] = runtime
            return runtime

    def stop(self, scenario_id: str) -> bool:
        with self._lock:
            return self._runtimes.pop(scenario_id, None) is not None

    def active_ids(self) -> list[str]:
        with self._lock:
            return sorted(self._runtimes)


__all__ = ["ScenarioRuntime", "RuntimeRegistry"]