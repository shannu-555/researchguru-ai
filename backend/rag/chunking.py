"""
Optional Chunking Utility.

This module demonstrates how documents could be split into
smaller chunks suitable for embedding and vector storage.

It is NOT connected to the current agent pipeline.
The active system performs chunking inside the run-agents
edge function. This exists only for architectural completeness.

Supported strategies:
  - Fixed-size chunking
  - Sliding-window chunking with overlap
  - Sentence-based chunking
  - Paragraph-based chunking

Each strategy returns a list of chunk dicts containing:
  chunk_id, text, token_count, original_document_id
"""

import re
import logging
from hashlib import md5

logger = logging.getLogger(__name__)

CHUNK_SCHEMA = {
    "chunk_id": "...",
    "text": "...",
    "token_count": 0,
    "original_document_id": "",
    "strategy": "fixed_size",
    "index": 0,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def estimate_token_count(text: str) -> int:
    """
    Estimate the number of tokens in *text* using a rough
    ``words × 1.3`` heuristic (approximates BPE tokenizers).

    Args:
        text: Input text.

    Returns:
        Estimated token count.
    """
    words = len(text.split())
    return max(int(words * 1.3), 1)


def _generate_chunk_id(text: str, index: int) -> str:
    """Deterministic chunk ID from content hash + index."""
    return md5(f"{text[:64]}:{index}".encode()).hexdigest()[:12]


def _build_chunk(text: str, index: int, strategy: str, doc_id: str = "") -> dict:
    """Create a standardised chunk dict."""
    return {
        "chunk_id": _generate_chunk_id(text, index),
        "text": text,
        "token_count": estimate_token_count(text),
        "original_document_id": doc_id,
        "strategy": strategy,
        "index": index,
    }


# ---------------------------------------------------------------------------
# Chunking strategies
# ---------------------------------------------------------------------------

def fixed_size_chunk(
    text: str, chunk_size: int = 500, doc_id: str = ""
) -> list[dict]:
    """
    Split *text* into fixed-size character chunks.

    Args:
        text: The input document.
        chunk_size: Characters per chunk.
        doc_id: Optional document identifier for traceability.

    Returns:
        List of chunk dicts.
    """
    chunks: list[dict] = []
    for i, start in enumerate(range(0, len(text), chunk_size)):
        segment = text[start : start + chunk_size]
        if segment.strip():
            chunks.append(_build_chunk(segment, i, "fixed_size", doc_id))
    logger.info("fixed_size_chunk — produced %d chunks (size=%d)", len(chunks), chunk_size)
    return chunks


def sliding_window_chunk(
    text: str,
    window_size: int = 500,
    overlap: int = 100,
    doc_id: str = "",
) -> list[dict]:
    """
    Split *text* with a sliding window and configurable overlap.

    Overlap ensures neighbouring chunks share context, which improves
    retrieval recall for queries that span chunk boundaries.

    Args:
        text: Input document.
        window_size: Characters per window.
        overlap: Overlapping characters between windows.
        doc_id: Optional document identifier.

    Returns:
        List of overlapping chunk dicts.
    """
    if overlap >= window_size:
        logger.warning("Overlap (%d) >= window_size (%d); clamping to window_size - 1", overlap, window_size)
        overlap = window_size - 1

    step = window_size - overlap
    chunks: list[dict] = []
    for i, start in enumerate(range(0, len(text), step)):
        segment = text[start : start + window_size]
        if segment.strip():
            chunks.append(_build_chunk(segment, i, "sliding_window", doc_id))
    logger.info(
        "sliding_window_chunk — produced %d chunks (window=%d, overlap=%d)",
        len(chunks), window_size, overlap,
    )
    return chunks


def sentence_based_chunk(
    text: str,
    max_sentences: int = 5,
    doc_id: str = "",
) -> list[dict]:
    """
    Split *text* on sentence boundaries, grouping up to
    *max_sentences* per chunk.

    Uses a simple regex sentence splitter.

    Args:
        text: Input document.
        max_sentences: Maximum sentences per chunk.
        doc_id: Optional document identifier.

    Returns:
        List of sentence-boundary chunk dicts.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks: list[dict] = []
    for i in range(0, len(sentences), max_sentences):
        group = " ".join(sentences[i : i + max_sentences])
        if group:
            chunks.append(_build_chunk(group, len(chunks), "sentence", doc_id))
    logger.info("sentence_based_chunk — %d sentences → %d chunks", len(sentences), len(chunks))
    return chunks


def paragraph_chunk(text: str, doc_id: str = "") -> list[dict]:
    """
    Split *text* on paragraph boundaries (double newlines).

    Args:
        text: Input document.
        doc_id: Optional document identifier.

    Returns:
        List of paragraph chunk dicts.
    """
    paragraphs = re.split(r"\n{2,}", text)
    chunks: list[dict] = []
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if para:
            chunks.append(_build_chunk(para, i, "paragraph", doc_id))
    logger.info("paragraph_chunk — %d paragraphs", len(chunks))
    return chunks


# ---------------------------------------------------------------------------
# Legacy compatibility wrappers
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int = 500) -> list:
    """Simple fixed-size chunking returning plain strings (legacy API)."""
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
