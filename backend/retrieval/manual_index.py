"""
Lightweight, zero-dependency manual retrieval (RAG without any API).

Parses a Markdown maintenance manual into section chunks (each tagged with a
`section` and `page` from HTML comment markers of the form:
    <!-- section: 3 | page: 3 -->
), builds a BM25 index in pure Python, and returns the best-matching passages
with traceable citations (document title, section, page, snippet).

No network, no model download, no external library. This satisfies the
"retrieve relevant passages and show source/page/section references" requirement
while keeping the project free of external API dependencies.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from backend.root_cause.schema import ManualCitation

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_MARKER_RE = re.compile(r"<!--\s*section:\s*([^|]+?)\s*\|\s*page:\s*(\d+)\s*-->")
_HEADING_RE = re.compile(r"^#{1,6}\s+(.*)$", re.MULTILINE)

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "be", "with", "that", "this", "it", "as", "at", "by", "if", "from", "should",
    "can", "may", "not", "no", "any", "above", "below", "than", "which",
}


def _tokenize(text: str) -> List[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS]


@dataclass
class Chunk:
    section: str
    page: Optional[int]
    heading: str
    text: str
    tokens: List[str]


class ManualIndex:
    """BM25 index over the section chunks of one manual."""

    def __init__(self, title: str, chunks: List[Chunk], k1: float = 1.5, b: float = 0.75):
        self.title = title
        self.chunks = chunks
        self.k1 = k1
        self.b = b
        self.N = len(chunks)
        self.avgdl = (
            sum(len(c.tokens) for c in chunks) / self.N if self.N else 0.0
        )
        self.df = self._document_frequencies()

    def _document_frequencies(self) -> dict:
        df: dict = {}
        for c in self.chunks:
            for term in set(c.tokens):
                df[term] = df.get(term, 0) + 1
        return df

    def _idf(self, term: str) -> float:
        n = self.df.get(term, 0)
        # BM25 idf with +1 smoothing to stay non-negative.
        return math.log(1 + (self.N - n + 0.5) / (n + 0.5))

    def _score(self, query_tokens: List[str], chunk: Chunk) -> float:
        if not chunk.tokens:
            return 0.0
        tf: dict = {}
        for t in chunk.tokens:
            tf[t] = tf.get(t, 0) + 1
        dl = len(chunk.tokens)
        score = 0.0
        for term in query_tokens:
            if term not in tf:
                continue
            idf = self._idf(term)
            freq = tf[term]
            denom = freq + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1))
            score += idf * (freq * (self.k1 + 1)) / (denom or 1)
        return score

    def search(self, query: str, top_k: int = 3) -> List[ManualCitation]:
        q = _tokenize(query)
        scored = [(self._score(q, c), c) for c in self.chunks]
        scored = [(s, c) for s, c in scored if s > 0]
        scored.sort(key=lambda x: x[0], reverse=True)
        results: List[ManualCitation] = []
        for s, c in scored[:top_k]:
            snippet = _first_sentences(c.text, max_chars=320)
            results.append(
                ManualCitation(
                    source=self.title,
                    section=f"{c.section}. {c.heading}" if c.heading else str(c.section),
                    page=c.page,
                    snippet=snippet,
                    score=round(float(s), 4),
                )
            )
        return results


def _first_sentences(text: str, max_chars: int = 320) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    if len(clean) <= max_chars:
        return clean
    cut = clean[:max_chars]
    last = cut.rfind(". ")
    return (cut[: last + 1] if last > 0 else cut).strip() + " …"


def _parse_markdown(path: Path) -> List[Chunk]:
    raw = path.read_text(encoding="utf-8")
    # Find all section markers and split the body on them.
    markers = list(_MARKER_RE.finditer(raw))
    chunks: List[Chunk] = []
    for i, m in enumerate(markers):
        start = m.end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(raw)
        body = raw[start:end]
        section = m.group(1).strip()
        page = int(m.group(2))
        heading_match = _HEADING_RE.search(body)
        heading = ""
        if heading_match:
            heading = heading_match.group(1).strip()
            # strip a leading "3. " numbering if present
            heading = re.sub(r"^\d+\.\s*", "", heading)
        text = _HEADING_RE.sub("", body).strip()
        chunks.append(
            Chunk(
                section=section,
                page=page,
                heading=heading,
                text=text,
                tokens=_tokenize(heading + " " + text),
            )
        )
    return chunks


def _extract_title(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem


def load_manual_index(manual_path: str) -> ManualIndex:
    path = Path(manual_path)
    chunks = _parse_markdown(path)
    title = _extract_title(path)
    return ManualIndex(title=title, chunks=chunks)
