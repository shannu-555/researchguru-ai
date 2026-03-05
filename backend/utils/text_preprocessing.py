"""
Optional NLP preprocessing utilities.
These functions demonstrate how raw text could be cleaned
before chunking and embedding.

This module is not used in the current system pipeline.
It exists only as an extensibility component for the architecture.

Conceptual pipeline:
  clean_text → normalize_whitespace → remove_urls → remove_special_characters
  → remove_stopwords → tokenize_text → ready for embedding
"""

import re
import logging
from collections import Counter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stop-word list (small illustrative subset)
# ---------------------------------------------------------------------------
DEFAULT_STOPWORDS: set[str] = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
    "be", "has", "had", "have", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "not", "no", "so", "if", "as",
}

# Simple language-detection heuristics (character-range based)
_LANG_PATTERNS: dict[str, re.Pattern] = {
    "en": re.compile(r"^[a-zA-Z0-9\s\W]+$"),
    "zh": re.compile(r"[\u4e00-\u9fff]"),
    "ar": re.compile(r"[\u0600-\u06FF]"),
    "ja": re.compile(r"[\u3040-\u30FF]"),
}


# ---------------------------------------------------------------------------
# Core cleaning functions
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """
    Remove extra whitespace, normalise line breaks, and strip
    leading / trailing spaces.

    Args:
        text: Raw input text.

    Returns:
        Cleaned text string.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def remove_urls(text: str) -> str:
    """Strip HTTP/HTTPS URLs and bare ``www.`` links."""
    return re.sub(r"https?://\S+|www\.\S+", "", text).strip()


def remove_special_characters(text: str, keep_punctuation: bool = False) -> str:
    """
    Remove non-alphanumeric characters except spaces.

    Args:
        text: Input text.
        keep_punctuation: If ``True``, retain common punctuation (``.!?,;:``).

    Returns:
        Cleaned text.
    """
    if keep_punctuation:
        return re.sub(r"[^a-zA-Z0-9\s.!?,;:]", "", text)
    return re.sub(r"[^a-zA-Z0-9\s]", "", text)


def normalize_whitespace(text: str) -> str:
    """Collapse all whitespace runs into single spaces and strip."""
    return re.sub(r"\s+", " ", text).strip()


def normalize_text(text: str) -> str:
    """Lowercase and strip leading/trailing whitespace."""
    return text.lower().strip()


# ---------------------------------------------------------------------------
# NLP-oriented helpers
# ---------------------------------------------------------------------------

def remove_stopwords(text: str, stopwords: set[str] | None = None) -> str:
    """
    Remove common stopwords from *text*.

    Args:
        text: Input text (should already be lowercased for best results).
        stopwords: Custom set; defaults to ``DEFAULT_STOPWORDS``.

    Returns:
        Text with stopwords removed.
    """
    sw = stopwords or DEFAULT_STOPWORDS
    words = text.split()
    filtered = [w for w in words if w.lower() not in sw]
    return " ".join(filtered)


def tokenize_text(text: str) -> list[str]:
    """
    Simple whitespace + punctuation tokenizer.

    Splits on whitespace and strips trailing punctuation from each token.

    Args:
        text: Input text.

    Returns:
        List of tokens.
    """
    raw_tokens = text.split()
    return [re.sub(r"[^\w]$", "", t) for t in raw_tokens if t]


def detect_language(text: str) -> str:
    """
    Very basic language detection based on Unicode character ranges.

    Returns a BCP-47-style tag (``en``, ``zh``, ``ar``, ``ja``)
    or ``unknown``.

    Args:
        text: Sample text (at least a few words recommended).

    Returns:
        Detected language code string.
    """
    for lang, pattern in _LANG_PATTERNS.items():
        if lang == "en":
            continue  # check others first
        if pattern.search(text):
            return lang
    return "en"  # default fallback


def calculate_text_length(text: str) -> dict:
    """
    Return length statistics for *text*.

    Returns:
        Dict with ``characters``, ``words``, ``sentences``, and
        ``avg_word_length``.
    """
    words = text.split()
    sentences = re.split(r"[.!?]+", text)
    sentences = [s for s in sentences if s.strip()]
    avg_word = round(sum(len(w) for w in words) / max(len(words), 1), 2)
    return {
        "characters": len(text),
        "words": len(words),
        "sentences": len(sentences),
        "avg_word_length": avg_word,
    }


def word_frequency(text: str, top_n: int = 10) -> list[tuple[str, int]]:
    """
    Return the *top_n* most frequent words after basic normalisation.

    Args:
        text: Input text.
        top_n: Number of results.

    Returns:
        List of ``(word, count)`` tuples sorted by frequency.
    """
    tokens = tokenize_text(normalize_text(text))
    filtered = [t for t in tokens if t and t not in DEFAULT_STOPWORDS]
    return Counter(filtered).most_common(top_n)


# ---------------------------------------------------------------------------
# Pipeline function
# ---------------------------------------------------------------------------

def prepare_text_for_embedding(text: str) -> list[str]:
    """
    Full preprocessing pipeline that prepares raw text for embedding.

    Pipeline::

        clean_text → remove_urls → normalize_whitespace
        → normalize_text → remove_stopwords → tokenize_text

    Args:
        text: Raw input text.

    Returns:
        List of cleaned tokens ready for embedding.
    """
    logger.info("prepare_text_for_embedding — input length: %d chars", len(text))
    text = clean_text(text)
    text = remove_urls(text)
    text = normalize_whitespace(text)
    text = normalize_text(text)
    text = remove_stopwords(text)
    tokens = tokenize_text(text)
    logger.info("prepare_text_for_embedding — output: %d tokens", len(tokens))
    return tokens
