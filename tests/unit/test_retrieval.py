from pathlib import Path

from backend.retrieval.manual_index import load_manual_index

MANUAL = (
    Path(__file__).resolve().parents[2]
    / "data" / "manuals" / "tile_line_maintenance_manual.md"
)


def test_manual_parses_into_chunks_with_pages():
    idx = load_manual_index(str(MANUAL))
    assert idx.N >= 7
    assert all(c.page is not None for c in idx.chunks)
    assert "Maintenance" in idx.title


def test_crack_query_returns_crack_section():
    idx = load_manual_index(str(MANUAL))
    hits = idx.search("micro-crack thermal stress overheating temperature", top_k=3)
    assert hits
    joined = " ".join(h.section.lower() for h in hits)
    assert "crack" in joined or "temperature" in joined
    # citations carry a page number
    assert hits[0].page is not None


def test_vibration_query_returns_vibration_section():
    idx = load_manual_index(str(MANUAL))
    hits = idx.search("vibration misalignment bearing surface scratch", top_k=2)
    assert hits
    assert any("vibration" in h.section.lower() or "mechanical" in h.section.lower()
               for h in hits)
