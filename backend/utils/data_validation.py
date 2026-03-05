"""
Optional Data Validation Utility.

This module simulates quality checks that could be applied to
collected datasets before embedding and vector storage.

It is NOT connected to the current system pipeline.
It exists only as an extensibility component for the architecture.

Functions cover:
  - Text length validation
  - Missing field detection
  - Schema validation
  - Duplicate record detection
"""

import logging
from hashlib import md5

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configurable thresholds
# ---------------------------------------------------------------------------
MIN_TEXT_LENGTH = 20
MAX_TEXT_LENGTH = 50_000
REQUIRED_FIELDS = {"text", "source", "timestamp"}


# ---------------------------------------------------------------------------
# Validation functions
# ---------------------------------------------------------------------------

def validate_text_length(
    text: str,
    min_length: int = MIN_TEXT_LENGTH,
    max_length: int = MAX_TEXT_LENGTH,
) -> dict:
    """
    Check whether *text* falls within acceptable length bounds.

    Args:
        text: The text to validate.
        min_length: Minimum character count.
        max_length: Maximum character count.

    Returns:
        Dict with ``valid`` (bool), ``length`` (int), and
        ``reason`` (str or None).
    """
    length = len(text)
    if length < min_length:
        return {"valid": False, "length": length, "reason": f"Too short (min {min_length})"}
    if length > max_length:
        return {"valid": False, "length": length, "reason": f"Too long (max {max_length})"}
    return {"valid": True, "length": length, "reason": None}


def check_missing_fields(
    record: dict,
    required: set[str] | None = None,
) -> list[str]:
    """
    Return a list of field names that are missing or empty in *record*.

    Args:
        record: Data record dict.
        required: Set of required field names.

    Returns:
        List of missing/empty field names (empty list means valid).
    """
    fields = required or REQUIRED_FIELDS
    missing: list[str] = []
    for f in fields:
        value = record.get(f)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(f)
    return missing


def validate_dataset_schema(
    dataset: list[dict],
    required: set[str] | None = None,
) -> dict:
    """
    Validate every record in *dataset* against required fields and
    text-length constraints.

    Args:
        dataset: List of record dicts.
        required: Set of required field names.

    Returns:
        Summary dict with ``total``, ``valid``, ``invalid``, and
        ``errors`` (list of per-record issues).
    """
    errors: list[dict] = []
    valid_count = 0
    for idx, record in enumerate(dataset):
        issues: list[str] = []

        missing = check_missing_fields(record, required)
        if missing:
            issues.append(f"Missing fields: {', '.join(missing)}")

        text = record.get("text", "")
        length_check = validate_text_length(text)
        if not length_check["valid"]:
            issues.append(length_check["reason"])

        if issues:
            errors.append({"index": idx, "issues": issues})
        else:
            valid_count += 1

    result = {
        "total": len(dataset),
        "valid": valid_count,
        "invalid": len(errors),
        "errors": errors,
    }
    logger.info(
        "validate_dataset_schema — %d/%d valid", valid_count, len(dataset)
    )
    return result


def detect_duplicate_records(
    dataset: list[dict],
    key_field: str = "text",
) -> dict:
    """
    Detect duplicate records based on the hash of *key_field*.

    Args:
        dataset: List of record dicts.
        key_field: Field name to use for duplicate detection.

    Returns:
        Dict with ``total``, ``unique``, ``duplicate_count``, and
        ``duplicate_indices`` (list of indices that are duplicates).
    """
    seen: dict[str, int] = {}
    duplicate_indices: list[int] = []
    for idx, record in enumerate(dataset):
        value = str(record.get(key_field, ""))
        h = md5(value.encode()).hexdigest()
        if h in seen:
            duplicate_indices.append(idx)
        else:
            seen[h] = idx

    result = {
        "total": len(dataset),
        "unique": len(seen),
        "duplicate_count": len(duplicate_indices),
        "duplicate_indices": duplicate_indices,
    }
    logger.info(
        "detect_duplicate_records — %d duplicates found in %d records",
        len(duplicate_indices), len(dataset),
    )
    return result
