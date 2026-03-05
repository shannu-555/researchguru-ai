"""
Optional Data Collection Module — Product Reviews

This module demonstrates how external market data sources
could be integrated into the research pipeline.

It is NOT currently connected to the main execution workflow.
It exists only as an extensibility component for the architecture.

Conceptual flow:
  fetch_raw_data → filter_relevant_posts → remove_duplicates
  → extract_metadata → format_for_preprocessing → structured dataset
"""

import logging
import re
from datetime import datetime, timezone
from hashlib import md5

logger = logging.getLogger(__name__)

SAMPLE_SCHEMA = {
    "text": "...",
    "source": "product_review",
    "platform": "generic",
    "timestamp": "2026-01-15T12:00:00Z",
    "engagement_score": 0.0,
    "rating": None,
    "reviewer": "",
    "metadata": {},
}

SUPPORTED_PLATFORMS = ["amazon", "trustpilot", "g2", "capterra", "generic"]


def fetch_raw_data(query: str, source: str = "generic", limit: int = 100) -> list[dict]:
    """
    Simulate fetching raw product reviews for *query* from *source*.

    Args:
        query: Product name.
        source: Review platform identifier.
        limit: Maximum reviews to retrieve.

    Returns:
        List of raw review dicts.
    """
    logger.info("fetch_raw_data — query=%s, source=%s, limit=%d", query, source, limit)
    if source not in SUPPORTED_PLATFORMS:
        logger.warning("Unsupported platform '%s', falling back to 'generic'", source)
        source = "generic"
    try:
        return [
            {
                "id": f"review_{i}",
                "product": query,
                "source": source,
                "rating": (i % 5) + 1,
                "review_text": f"This is a sample review for {query}. Quality is {'great' if i % 2 == 0 else 'average'}.",
                "reviewer": f"reviewer_{i}",
                "date": datetime.now(timezone.utc).isoformat(),
                "helpful_votes": i * 2,
                "verified_purchase": i % 3 == 0,
            }
            for i in range(min(limit, 5))
        ]
    except Exception as exc:
        logger.error("Error fetching reviews: %s", exc)
        return []


def filter_relevant_posts(data: list[dict], keyword: str) -> list[dict]:
    """Keep reviews containing *keyword*."""
    pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    return [r for r in data if pattern.search(r.get("review_text", ""))]


def remove_duplicates(data: list[dict]) -> list[dict]:
    """De-duplicate reviews by hashing review text."""
    seen: set[str] = set()
    unique: list[dict] = []
    for review in data:
        h = md5(review.get("review_text", "").encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(review)
    return unique


def _sentiment_heuristic(text: str) -> str:
    """Very simple keyword-based sentiment guess."""
    positive = {"great", "excellent", "love", "best", "amazing", "good", "fantastic"}
    negative = {"bad", "terrible", "worst", "hate", "awful", "poor", "broken"}
    words = set(text.lower().split())
    pos = len(words & positive)
    neg = len(words & negative)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def extract_metadata(data: list[dict]) -> list[dict]:
    """Enrich reviews with computed metadata."""
    for review in data:
        text = review.get("review_text", "")
        review["metadata"] = {
            "word_count": len(text.split()),
            "sentiment_hint": _sentiment_heuristic(text),
            "verified": review.get("verified_purchase", False),
            "helpful_votes": review.get("helpful_votes", 0),
        }
    return data


def format_for_preprocessing(data: list[dict]) -> list[dict]:
    """Map raw reviews to the standard schema."""
    return [
        {
            "text": r.get("review_text", ""),
            "source": "product_review",
            "platform": r.get("source", "generic"),
            "timestamp": r.get("date", ""),
            "engagement_score": min(r.get("helpful_votes", 0) / 50, 1.0),
            "rating": r.get("rating"),
            "reviewer": r.get("reviewer", ""),
            "metadata": r.get("metadata", {}),
        }
        for r in data
    ]


# ---------------------------------------------------------------------------
# High-level pipeline
# ---------------------------------------------------------------------------

def collect_product_reviews(
    product_name: str, source: str = "generic", limit: int = 100
) -> list[dict]:
    """
    End-to-end review collection pipeline.

    Flow::

        fetch_raw_data → filter_relevant_posts → remove_duplicates
        → extract_metadata → format_for_preprocessing

    Args:
        product_name: Product to search.
        source: Platform identifier.
        limit: Max reviews.

    Returns:
        Structured review records.
    """
    logger.info("=== collect_product_reviews START — product=%s ===", product_name)
    try:
        raw = fetch_raw_data(product_name, source=source, limit=limit)
        relevant = filter_relevant_posts(raw, product_name)
        unique = remove_duplicates(relevant)
        enriched = extract_metadata(unique)
        result = format_for_preprocessing(enriched)
        logger.info("=== collect_product_reviews END — %d records ===", len(result))
        return result
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc)
        return []
