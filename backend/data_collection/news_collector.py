"""
Optional Data Collection Module — Market News

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
from datetime import datetime, timezone, timedelta
from hashlib import md5

logger = logging.getLogger(__name__)

SAMPLE_SCHEMA = {
    "text": "...",
    "source": "news",
    "publisher": "",
    "timestamp": "2026-01-15T12:00:00Z",
    "engagement_score": 0.0,
    "url": "",
    "metadata": {},
}

NEWS_CATEGORIES = ["technology", "finance", "healthcare", "consumer", "general"]


def fetch_raw_data(query: str, days_back: int = 30, limit: int = 50) -> list[dict]:
    """
    Simulate fetching news articles about *query*.

    Args:
        query: Product or company name.
        days_back: Historical window in days.
        limit: Max articles.

    Returns:
        List of raw article dicts.
    """
    logger.info("fetch_raw_data — query=%s, days_back=%d, limit=%d", query, days_back, limit)
    now = datetime.now(timezone.utc)
    try:
        return [
            {
                "id": f"article_{i}",
                "title": f"{query} {'launches new product' if i % 2 == 0 else 'faces market challenges'} — report {i}",
                "summary": f"An in-depth look at how {query} is performing in the current market landscape.",
                "body": f"Full article body about {query}. " * 20,
                "publisher": f"News Outlet {i}",
                "category": NEWS_CATEGORIES[i % len(NEWS_CATEGORIES)],
                "published_date": (now - timedelta(days=i * 3)).isoformat(),
                "url": f"https://example.com/news/{query.lower().replace(' ', '-')}-{i}",
                "shares": i * 50,
            }
            for i in range(min(limit, 5))
        ]
    except Exception as exc:
        logger.error("Error fetching news: %s", exc)
        return []


def filter_relevant_posts(data: list[dict], keyword: str) -> list[dict]:
    """Keep articles mentioning *keyword* in title or summary."""
    pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    return [
        a for a in data
        if pattern.search(a.get("title", "")) or pattern.search(a.get("summary", ""))
    ]


def remove_duplicates(data: list[dict]) -> list[dict]:
    """De-duplicate articles by title hash."""
    seen: set[str] = set()
    unique: list[dict] = []
    for article in data:
        h = md5(article.get("title", "").encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(article)
    return unique


def _estimate_impact_score(article: dict) -> float:
    """Heuristic impact score based on shares and category weight."""
    category_weights = {
        "technology": 1.2,
        "finance": 1.3,
        "healthcare": 1.1,
        "consumer": 1.0,
        "general": 0.8,
    }
    weight = category_weights.get(article.get("category", "general"), 1.0)
    shares = article.get("shares", 0)
    return min(round((shares * weight) / 500, 4), 1.0)


def extract_metadata(data: list[dict]) -> list[dict]:
    """Enrich articles with metadata."""
    for article in data:
        article["metadata"] = {
            "word_count": len(article.get("body", "").split()),
            "category": article.get("category", "general"),
            "impact_score": _estimate_impact_score(article),
            "publisher": article.get("publisher", ""),
        }
    return data


def format_for_preprocessing(data: list[dict]) -> list[dict]:
    """Map articles to standard schema."""
    return [
        {
            "text": f"{a.get('title', '')}. {a.get('summary', '')}".strip(),
            "source": "news",
            "publisher": a.get("publisher", ""),
            "timestamp": a.get("published_date", ""),
            "engagement_score": a.get("metadata", {}).get("impact_score", 0.0),
            "url": a.get("url", ""),
            "metadata": a.get("metadata", {}),
        }
        for a in data
    ]


# ---------------------------------------------------------------------------
# High-level pipeline
# ---------------------------------------------------------------------------

def collect_market_news(
    product_name: str, days_back: int = 30, limit: int = 50
) -> list[dict]:
    """
    End-to-end news collection pipeline.

    Flow::

        fetch_raw_data → filter_relevant_posts → remove_duplicates
        → extract_metadata → format_for_preprocessing

    Args:
        product_name: Product or company name.
        days_back: Historical window.
        limit: Max articles.

    Returns:
        Structured news records.
    """
    logger.info("=== collect_market_news START — product=%s ===", product_name)
    try:
        raw = fetch_raw_data(product_name, days_back=days_back, limit=limit)
        relevant = filter_relevant_posts(raw, product_name)
        unique = remove_duplicates(relevant)
        enriched = extract_metadata(unique)
        result = format_for_preprocessing(enriched)
        logger.info("=== collect_market_news END — %d records ===", len(result))
        return result
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc)
        return []
