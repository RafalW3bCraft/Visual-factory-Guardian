"""Zero-dependency manual retrieval for Visual Factory Guardian."""
from .manual_index import ManualIndex, load_manual_index  # noqa: F401

__all__ = ["ManualIndex", "load_manual_index"]
