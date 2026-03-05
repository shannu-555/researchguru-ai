"""
Optional Retrieval Engine.

This demonstrates how vector similarity search retrieves
context from the vector database in a RAG system.

The current project already performs retrieval inside
the chat assistant logic. This module exists only for
architectural completeness.

Conceptual flow:
  embed_query → similarity_search → rank_results
  → filter_low_similarity → assemble_context
"""

import math
import logging

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 5
DEFAULT_SIMILARITY_THRESHOLD = 0.65
EMBEDDING_DIM = 1536  # typical dimension for text-embedding models


# ---------------------------------------------------------------------------
# Similarity math helpers
# ---------------------------------------------------------------------------

def _dot_product(a: list[float], b: list[float]) -> float:
    """Compute dot product of two equal-length vectors."""
    return sum(x * y for x, y in zip(a, b))


def _magnitude(v: list[float]) -> float:
    """Compute Euclidean magnitude of a vector."""
    return math.sqrt(sum(x * x for x in v))


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Compute cosine similarity between two vectors.

    Returns a value in ``[-1, 1]``.  Higher means more similar.

    Args:
        a: First embedding vector.
        b: Second embedding vector.

    Returns:
        Cosine similarity score.
    """
    mag_a = _magnitude(a)
    mag_b = _magnitude(b)
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return _dot_product(a, b) / (mag_a * mag_b)


# ---------------------------------------------------------------------------
# Core retrieval functions
# ---------------------------------------------------------------------------

def embed_query(query: str) -> list[float]:
    """
    Generate a placeholder embedding vector for *query*.

    In production this would call an embedding model API
    (e.g. OpenAI ``text-embedding-3-small`` or Gemini embeddings).

    Args:
        query: Natural-language query string.

    Returns:
        A zero vector of dimension ``EMBEDDING_DIM``.
    """
    logger.info("embed_query — generating placeholder embedding for: '%s'", query[:80])
    # Deterministic placeholder: use character ordinals for reproducibility
    vector = [0.0] * EMBEDDING_DIM
    for i, ch in enumerate(query):
        vector[i % EMBEDDING_DIM] += ord(ch) / 10000.0
    # Normalise to unit length
    mag = _magnitude(vector) or 1.0
    return [v / mag for v in vector]


def similarity_search(
    query_embedding: list[float],
    vector_db: list[dict],
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    """
    Rank all records in *vector_db* by cosine similarity to
    *query_embedding* and return the top *top_k*.

    Each record in *vector_db* is expected to have at least::

        {"embedding": [...], "chunk": "...", "metadata": {...}}

    Args:
        query_embedding: Query vector.
        vector_db: List of stored embedding records.
        top_k: Number of results to return.

    Returns:
        Top-k records sorted by descending similarity, each
        augmented with a ``similarity`` key.
    """
    logger.info("similarity_search — comparing against %d records, top_k=%d", len(vector_db), top_k)
    scored: list[dict] = []
    for record in vector_db:
        emb = record.get("embedding", [])
        if not emb:
            continue
        sim = cosine_similarity(query_embedding, emb)
        scored.append({**record, "similarity": round(sim, 6)})
    scored.sort(key=lambda r: r["similarity"], reverse=True)
    return scored[:top_k]


def rank_results(results: list[dict]) -> list[dict]:
    """
    Re-rank results using a composite score that considers
    similarity, recency, and source reliability.

    Currently uses similarity only (placeholder for future signals).

    Args:
        results: List of scored result dicts.

    Returns:
        Re-ranked list (best first).
    """
    for r in results:
        # Future: blend in recency_boost, source_weight, etc.
        r["composite_score"] = r.get("similarity", 0.0)
    results.sort(key=lambda r: r["composite_score"], reverse=True)
    logger.info("rank_results — top score: %.4f", results[0]["composite_score"] if results else 0)
    return results


def filter_low_similarity(
    results: list[dict],
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
) -> list[dict]:
    """
    Remove results below *threshold*.

    Args:
        results: Scored result dicts.
        threshold: Minimum similarity to keep.

    Returns:
        Filtered list.
    """
    filtered = [r for r in results if r.get("similarity", 0) >= threshold]
    logger.info(
        "filter_low_similarity — kept %d / %d (threshold=%.2f)",
        len(filtered), len(results), threshold,
    )
    return filtered


def assemble_context(results: list[dict], max_tokens: int = 3000) -> str:
    """
    Concatenate chunk texts from *results* into a single context
    string, respecting a rough token budget.

    Args:
        results: Ranked & filtered result dicts.
        max_tokens: Approximate token ceiling.

    Returns:
        Assembled context string.
    """
    parts: list[str] = []
    token_count = 0
    for r in results:
        chunk = r.get("chunk", "")
        est = len(chunk.split())  # rough token estimate
        if token_count + est > max_tokens:
            break
        parts.append(chunk)
        token_count += est
    context = "\n\n---\n\n".join(parts)
    logger.info("assemble_context — %d chunks, ~%d tokens", len(parts), token_count)
    return context


# ---------------------------------------------------------------------------
# High-level retrieval pipeline
# ---------------------------------------------------------------------------

def retrieve_context(
    query_embedding: list[float],
    vector_db: list[dict],
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    """
    Convenience function — searches *vector_db* and returns top-k
    results (legacy API).
    """
    return similarity_search(query_embedding, vector_db, top_k=top_k)


def retrieve_context_for_query(
    query: str,
    vector_db: list[dict],
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    max_context_tokens: int = 3000,
) -> str:
    """
    End-to-end retrieval pipeline.

    Flow::

        embed_query → similarity_search → rank_results
        → filter_low_similarity → assemble_context

    Args:
        query: User's natural-language question.
        vector_db: Stored embedding records.
        top_k: Max candidates from similarity search.
        threshold: Minimum similarity.
        max_context_tokens: Token budget for assembled context.

    Returns:
        Assembled context string ready for the LLM prompt.
    """
    logger.info("=== retrieve_context_for_query START ===")
    embedding = embed_query(query)
    candidates = similarity_search(embedding, vector_db, top_k=top_k)
    ranked = rank_results(candidates)
    relevant = filter_low_similarity(ranked, threshold=threshold)
    context = assemble_context(relevant, max_tokens=max_context_tokens)
    logger.info("=== retrieve_context_for_query END — context length: %d chars ===", len(context))
    return context
