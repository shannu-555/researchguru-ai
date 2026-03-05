"""
Optional Research Dataset Manager.

This module demonstrates how collected research data could be
organised into named datasets with metadata tracking.

It is NOT connected to the current system pipeline.
It exists only as an extensibility component for the architecture.

Features:
  - Create / manage named datasets
  - Add, validate, and remove records
  - Track dataset metadata (name, source, record count, timestamps)
  - Export datasets as structured dicts
"""

import logging
from datetime import datetime, timezone
from copy import deepcopy
from hashlib import md5

logger = logging.getLogger(__name__)

DATASET_SCHEMA = {
    "dataset_name": "",
    "source": "",
    "record_count": 0,
    "created_at": "",
    "updated_at": "",
    "records": [],
}


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def create_dataset(
    dataset_name: str,
    source: str = "unknown",
) -> dict:
    """
    Initialise a new empty dataset with metadata.

    Args:
        dataset_name: Human-readable name.
        source: Data source identifier (e.g. ``'reddit'``, ``'news'``).

    Returns:
        A dataset dict matching ``DATASET_SCHEMA``.
    """
    now = datetime.now(timezone.utc).isoformat()
    dataset = {
        "dataset_name": dataset_name,
        "source": source,
        "record_count": 0,
        "created_at": now,
        "updated_at": now,
        "records": [],
    }
    logger.info("create_dataset — name='%s', source='%s'", dataset_name, source)
    return dataset


def add_record(dataset: dict, record: dict) -> dict:
    """
    Append *record* to *dataset* and update metadata.

    A ``record_id`` is generated automatically from the record's
    ``text`` field if not already present.

    Args:
        dataset: Target dataset dict.
        record: Record dict to add.

    Returns:
        Updated dataset.
    """
    record = deepcopy(record)
    if "record_id" not in record:
        text = record.get("text", "")
        record["record_id"] = md5(text.encode()).hexdigest()[:12]
    if "added_at" not in record:
        record["added_at"] = datetime.now(timezone.utc).isoformat()

    dataset["records"].append(record)
    dataset["record_count"] = len(dataset["records"])
    dataset["updated_at"] = datetime.now(timezone.utc).isoformat()
    logger.info(
        "add_record — dataset='%s', total records=%d",
        dataset["dataset_name"], dataset["record_count"],
    )
    return dataset


def remove_invalid_records(
    dataset: dict,
    required_fields: set[str] | None = None,
    min_text_length: int = 10,
) -> dict:
    """
    Remove records that are missing required fields or have
    text shorter than *min_text_length*.

    Args:
        dataset: Target dataset dict.
        required_fields: Fields every record must have.
        min_text_length: Minimum ``text`` length.

    Returns:
        Cleaned dataset.
    """
    fields = required_fields or {"text", "source"}
    original_count = len(dataset["records"])
    valid: list[dict] = []
    for record in dataset["records"]:
        missing = [f for f in fields if not record.get(f)]
        text = record.get("text", "")
        if missing or len(text) < min_text_length:
            continue
        valid.append(record)

    removed = original_count - len(valid)
    dataset["records"] = valid
    dataset["record_count"] = len(valid)
    dataset["updated_at"] = datetime.now(timezone.utc).isoformat()
    logger.info(
        "remove_invalid_records — removed %d / %d from '%s'",
        removed, original_count, dataset["dataset_name"],
    )
    return dataset


def get_dataset_summary(dataset: dict) -> dict:
    """
    Return a lightweight summary of *dataset* without the full
    records list.

    Returns:
        Dict with name, source, counts, and timestamps.
    """
    return {
        "dataset_name": dataset.get("dataset_name", ""),
        "source": dataset.get("source", ""),
        "record_count": dataset.get("record_count", 0),
        "created_at": dataset.get("created_at", ""),
        "updated_at": dataset.get("updated_at", ""),
    }


def export_dataset(dataset: dict, include_metadata: bool = True) -> dict:
    """
    Export *dataset* as a plain dict suitable for serialisation
    (e.g. JSON).

    Args:
        dataset: Dataset dict.
        include_metadata: Whether to include management metadata.

    Returns:
        Exportable dict.
    """
    exported = deepcopy(dataset)
    if not include_metadata:
        exported.pop("created_at", None)
        exported.pop("updated_at", None)
    logger.info(
        "export_dataset — '%s' with %d records",
        exported.get("dataset_name", ""), exported.get("record_count", 0),
    )
    return exported


def merge_datasets(a: dict, b: dict, new_name: str | None = None) -> dict:
    """
    Merge two datasets into one, de-duplicating by ``record_id``.

    Args:
        a: First dataset.
        b: Second dataset.
        new_name: Name for the merged dataset (defaults to ``a + b``).

    Returns:
        New merged dataset dict.
    """
    name = new_name or f"{a['dataset_name']}+{b['dataset_name']}"
    merged = create_dataset(name, source="merged")
    seen_ids: set[str] = set()
    for record in a.get("records", []) + b.get("records", []):
        rid = record.get("record_id", "")
        if rid not in seen_ids:
            seen_ids.add(rid)
            merged["records"].append(deepcopy(record))
    merged["record_count"] = len(merged["records"])
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    logger.info("merge_datasets — '%s' contains %d records", name, merged["record_count"])
    return merged
