"""Scenario loader.

Loads a JSON scenario definition into a typed, immutable Python object.
Scenarios are the single source of truth for sensor parameters, fault
injection, inspection timing and the anomaly threshold. They are
deterministic — same file, same outputs, every replay.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SCENARIO_DIR = Path(__file__).resolve().parents[2] / "configs" / "scenarios"


@dataclass(frozen=True)
class SensorConfig:
    sensor_id: str
    metric: str
    unit: str
    baseline: float
    threshold: float
    drift_amplitude: float
    noise_amplitude: float
    noise_frequency: float
    fault_state: str


@dataclass(frozen=True)
class InspectionConfig:
    event_id: str
    product_id: str
    at_seconds: int
    image_id: str
    expected_label: str
    expected_anomaly_score_range: tuple[float, float]


@dataclass(frozen=True)
class VisionModelConfig:
    id: str
    backend: str
    input_size: tuple[int, int]
    note: str = ""


@dataclass(frozen=True)
class DatasetConfig:
    name: str
    source: str
    note: str = ""


@dataclass(frozen=True)
class Scenario:
    scenario_id: str
    line_id: str
    epoch: datetime
    duration_seconds: int
    fault_start_seconds: int
    anomaly_at_seconds: int
    random_seed: int
    sampling_interval_seconds: int
    sensors: tuple[SensorConfig, ...]
    inspections: tuple[InspectionConfig, ...]
    evidence_window_seconds: int
    post_window_seconds: int
    anomaly_threshold: float
    dataset: DatasetConfig
    vision_model: VisionModelConfig
    source_path: Path = field(compare=False, default=Path(""))

    @property
    def epoch_utc(self) -> datetime:
        # Always work in UTC
        return self.epoch.astimezone(timezone.utc)


def _coerce_range(values: Iterable[float]) -> tuple[float, float]:
    lo, hi = list(values)
    if lo > hi:
        raise ValueError(f"Invalid range: [{lo}, {hi}]")
    return float(lo), float(hi)


def _parse_sensors(raw: list[dict[str, Any]]) -> tuple[SensorConfig, ...]:
    return tuple(
        SensorConfig(
            sensor_id=s["sensor_id"],
            metric=s["metric"],
            unit=s["unit"],
            baseline=float(s["baseline"]),
            threshold=float(s["threshold"]),
            drift_amplitude=float(s["drift_amplitude"]),
            noise_amplitude=float(s["noise_amplitude"]),
            noise_frequency=float(s["noise_frequency"]),
            fault_state=s["fault_state"],
        )
        for s in raw
    )


def _parse_inspections(raw: list[dict[str, Any]]) -> tuple[InspectionConfig, ...]:
    return tuple(
        InspectionConfig(
            event_id=i["event_id"],
            product_id=i["product_id"],
            at_seconds=int(i["at_seconds"]),
            image_id=i["image_id"],
            expected_label=i["expected_label"],
            expected_anomaly_score_range=_coerce_range(i["expected_anomaly_score_range"]),
        )
        for i in raw
    )


def load_scenario(path: str | Path) -> Scenario:
    """Load a scenario from a JSON file path or scenario id.

    Accepts either an absolute/relative path ending in ``.json`` or a
    bare scenario id (e.g. ``"thermal-drift-001"``) which is resolved
    against ``configs/scenarios/``.
    """
    p = Path(path)
    if not p.is_absolute():
        p = SCENARIO_DIR / p
    if p.is_dir() or p.suffix != ".json":
        p = p if p.suffix == ".json" else p.with_suffix(".json")
    if not p.exists():
        raise FileNotFoundError(f"Scenario file not found: {p}")
    raw = json.loads(p.read_text())

    epoch = datetime.fromisoformat(raw["epoch"].replace("Z", "+00:00"))
    return Scenario(
        scenario_id=raw["scenario_id"],
        line_id=raw["line_id"],
        epoch=epoch,
        duration_seconds=int(raw["duration_seconds"]),
        fault_start_seconds=int(raw["fault_start_seconds"]),
        anomaly_at_seconds=int(raw["anomaly_at_seconds"]),
        random_seed=int(raw["random_seed"]),
        sampling_interval_seconds=int(raw["sampling_interval_seconds"]),
        sensors=_parse_sensors(raw["sensors"]),
        inspections=_parse_inspections(raw["inspections"]),
        evidence_window_seconds=int(raw["evidence_window_seconds"]),
        post_window_seconds=int(raw["post_window_seconds"]),
        anomaly_threshold=float(raw["anomaly_threshold"]),
        dataset=DatasetConfig(
            name=raw["dataset"]["name"],
            source=raw["dataset"]["source"],
            note=raw["dataset"].get("note", ""),
        ),
        vision_model=VisionModelConfig(
            id=raw["vision_model"]["id"],
            backend=raw["vision_model"]["backend"],
            input_size=tuple(raw["vision_model"]["input_size"]),
            note=raw["vision_model"].get("note", ""),
        ),
        source_path=p,
    )


def list_scenarios() -> list[str]:
    if not SCENARIO_DIR.exists():
        return []
    return sorted(p.stem for p in SCENARIO_DIR.glob("*.json"))