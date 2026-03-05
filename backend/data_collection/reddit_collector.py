"""
Optional Data Collection Module — Reddit

This module demonstrates how external market data sources
could be integrated into the research pipeline.

It is NOT currently connected to the main execution workflow.
It exists only as an extensibility component for the architecture.

Conceptual flow:
  fetch_raw_data → filter_relevant_posts → remove_duplicates
  → extract_metadata → format_for_preprocessing → structured dataset
"""

import re
import logging
from datetime import datetime, timezone
from hashlib import md5

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sample data schema returned by this module
# ---------------------------------------------------------------------------
SAMPLE_SCHEMA = {
    "text": "...",
    "source": "reddit",
    "subreddit": "technology",
    "timestamp": "2026-01-15T12:00:00Z",
    "engagement_score": 0.0,
    "author": "",
    "permalink": "",
    "metadata": {},
}


def fetch_raw_data(query: str, subreddit: str = "all", limit: int = 100) -> list[dict]:
    """
    Simulate fetching raw Reddit posts matching *query*.

    In production this would call the Reddit API (PRAW / pushshift).
    Returns a list of raw post dictionaries.

    Args:
        query: Search term or product name.
        subreddit: Target subreddit (default ``'all'``).
        limit: Maximum posts to retrieve.

    Returns:
        List of raw post dicts (placeholder data).
    """
    logger.info("fetch_raw_data called — query=%s, subreddit=%s, limit=%d", query, subreddit, limit)
    try:
        return [
            {
                "id": f"post_{i}",
                "title": f"Discussion about {query} — post {i}",
                "selftext": f"Sample body text mentioning {query} in context.",
                "subreddit": subreddit,
                "score": i * 10,
                "num_comments": i * 3,
                "author": f"user_{i}",
                "created_utc": datetime.now(timezone.utc).isoformat(),
                "permalink": f"/r/{subreddit}/comments/abc{i}/",
                "url": "",
            }
            for i in range(min(limit, 5))
        ]
    except Exception as exc:
        logger.error("Error fetching raw data: %s", exc)
        return []


def filter_relevant_posts(data: list[dict], keyword: str) -> list[dict]:
    """
    Keep only posts whose title or body contains *keyword* (case-insensitive).

    Args:
        data: List of raw post dicts.
        keyword: Term to match.

    Returns:
        Filtered list of posts.
    """
    pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    filtered = [
        post for post in data
        if pattern.search(post.get("title", "")) or pattern.search(post.get("selftext", ""))
    ]
    logger.info("filter_relevant_posts: %d / %d posts matched keyword '%s'", len(filtered), len(data), keyword)
    return filtered


def remove_duplicates(data: list[dict]) -> list[dict]:
    """
    Remove duplicate posts based on a content hash of title + body.

    Args:
        data: List of post dicts.

    Returns:
        De-duplicated list.
    """
    seen: set[str] = set()
    unique: list[dict] = []
    for post in data:
        content_hash = md5(
            (post.get("title", "") + post.get("selftext", "")).encode()
        ).hexdigest()
        if content_hash not in seen:
            seen.add(content_hash)
            unique.append(post)
    logger.info("remove_duplicates: %d unique out of %d total", len(unique), len(data))
    return unique


def _calculate_engagement_score(post: dict) -> float:
    """
    Compute a normalised engagement score from upvotes and comments.

    Formula: ``(score + num_comments * 2) / 100`` capped at 1.0.
    """
    raw = post.get("score", 0) + post.get("num_comments", 0) * 2
    return min(round(raw / 100, 4), 1.0)


def extract_metadata(data: list[dict]) -> list[dict]:
    """
    Enrich each post with computed metadata (engagement score, word count).

    Args:
        data: List of post dicts.

    Returns:
        Enriched list with ``metadata`` key added.
    """
    enriched: list[dict] = []
    for post in data:
        body = post.get("selftext", "")
        post["metadata"] = {
            "word_count": len(body.split()),
            "has_url": bool(re.search(r"https?://", body)),
            "engagement_score": _calculate_engagement_score(post),
        }
        enriched.append(post)
    return enriched


def format_for_preprocessing(data: list[dict]) -> list[dict]:
    """
    Transform raw posts into the standard schema expected by the
    preprocessing layer.

    Returns:
        List of dicts matching ``SAMPLE_SCHEMA``.
    """
    formatted: list[dict] = []
    for post in data:
        formatted.append({
            "text": f"{post.get('title', '')}. {post.get('selftext', '')}".strip(),
            "source": "reddit",
            "subreddit": post.get("subreddit", ""),
            "timestamp": post.get("created_utc", ""),
            "engagement_score": post.get("metadata", {}).get("engagement_score", 0.0),
            "author": post.get("author", ""),
            "permalink": post.get("permalink", ""),
            "metadata": post.get("metadata", {}),
        })
    return formatted


# ---------------------------------------------------------------------------
# High-level collection pipeline
# ---------------------------------------------------------------------------

def collect_reddit_posts(product_name: str, subreddit: str = "all", limit: int = 50) -> list[dict]:
    """
    Convenience wrapper matching the original function signature.
    Delegates to :func:`collect_market_discussions`.
    """
    return collect_market_discussions(product_name, subreddit=subreddit, limit=limit)


def collect_market_discussions(
    product_name: str,
    subreddit: str = "all",
    limit: int = 50,
) -> list[dict]:
    """
    End-to-end collection pipeline for Reddit market discussions.

    Internal flow::

        fetch_raw_data → filter_relevant_posts → remove_duplicates
        → extract_metadata → format_for_preprocessing

    Args:
        product_name: Product or brand to search for.
        subreddit: Target subreddit.
        limit: Maximum posts.

    Returns:
        List of structured records ready for the preprocessing layer.
    """
    logger.info("=== collect_market_discussions START — product=%s ===", product_name)
    try:
        raw = fetch_raw_data(product_name, subreddit=subreddit, limit=limit)
        relevant = filter_relevant_posts(raw, product_name)
        unique = remove_duplicates(relevant)
        enriched = extract_metadata(unique)
        result = format_for_preprocessing(enriched)
        logger.info("=== collect_market_discussions END — %d records ===", len(result))
        return result
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc)
        return []
