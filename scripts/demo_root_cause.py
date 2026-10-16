"""
Standalone demo for the reasoning layer.

Runs the full root-cause + explanation pipeline on the deterministic mock
scenario and prints the analysis JSON. No GPU, no network, no API key needed.

Run from the repository root:
    python -m scripts.demo_root_cause
or:
    PYTHONPATH=. python scripts/demo_root_cause.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running as a plain script from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.reasoning.service import ReasoningService      # noqa: E402
from scripts.mock_scenario import make_mock_scenario        # noqa: E402


def main() -> None:
    event, readings = make_mock_scenario()
    # prefer_llm=False keeps the demo fully offline and reproducible.
    service = ReasoningService(prefer_llm=False)
    result = service.analyse(event, readings)

    print("=" * 72)
    print("VISUAL FACTORY GUARDIAN — reasoning layer demo (SIMULATED data)")
    print("=" * 72)
    print(f"Event      : {result['event_id']}  image={result['image_id']}")
    print(f"Detection  : {result['detection']}")
    print(f"Explainer  : {result['explainer_mode']}")
    print("-" * 72)
    print("SENSOR EVIDENCE")
    for e in result["sensor_evidence"]:
        print(f"  - {e['metric']:<14} dir={e['direction']:<7} "
              f"z={e['z_score']:<7} thr={e['threshold_exceeded']!s:<5} "
              f"lead_s={e['lead_time_seconds']}")
    print("-" * 72)
    print("RANKED CANDIDATE CAUSES")
    for c in result["candidate_causes"]:
        print(f"  [{c['score']:.3f}] ({c['confidence']}) {c['cause']}")
    print("-" * 72)
    print("MANUAL CITATIONS")
    for m in result["manual_citations"]:
        pg = f" p.{m['page']}" if m["page"] is not None else ""
        print(f"  - {m['source']} | Sec {m['section']}{pg} (score {m['score']})")
    print("-" * 72)
    print("RECOMMENDED ACTION")
    print(f"  severity={result['recommended_action']['severity']} | "
          f"{result['recommended_action']['text']}")
    print("-" * 72)
    print("EXPLANATION")
    print("  " + result["explanation"])
    print("-" * 72)
    print("UNCERTAINTY")
    print("  " + result["uncertainty"])
    print("=" * 72)

    out = Path(__file__).resolve().parents[1] / "sample_analysis_output.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"\nFull JSON written to: {out}")


if __name__ == "__main__":
    main()
