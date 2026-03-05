"""
Optional NLP preprocessing utilities.
These functions demonstrate how raw text could be cleaned
before chunking and embedding.

This module is not used in the current system pipeline.
"""

import re


def clean_text(text: str) -> str:
    """Remove extra whitespace and normalize line breaks."""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def remove_urls(text: str) -> str:
    """Strip URLs from text content."""
    return re.sub(r'https?://\S+|www\.\S+', '', text)


def normalize_text(text: str) -> str:
    """Lowercase and strip leading/trailing whitespace."""
    return text.lower().strip()


def remove_special_characters(text: str) -> str:
    """Remove non-alphanumeric characters except spaces."""
    return re.sub(r'[^a-zA-Z0-9\s]', '', text)
