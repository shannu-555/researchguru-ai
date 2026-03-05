# Architecture Extensions

These modules represent **conceptual layers** in the system architecture. They are provided for **architectural completeness and future extensibility only**.

> ⚠️ **None of these modules are part of the active runtime workflow.** They do not modify, interact with, or influence the existing pipeline in any way.

## Current Active Pipeline (unchanged)

```
User → Authentication → Create Project → Run Agents → Agent Results
     → Chunking → Embedding → Vector Database → Insight Generation
     → Visualization / Reports → Chat Assistant (RAG)
```

---

## Conceptual Architecture Layers

### 1. Data Ingestion Layer — `backend/data_collection/`

Demonstrates how external market data could be ingested, cleaned, and normalised from multiple sources.

| File | Purpose |
|---|---|
| `reddit_collector.py` | Collect & filter Reddit discussions |
| `reviews_collector.py` | Collect & score product reviews |
| `news_collector.py` | Collect & rank market news articles |
| `dataset_manager.py` | Organise records into named datasets with metadata tracking |

Each collector follows a standard internal pipeline:

```
fetch_raw_data → filter_relevant_posts → remove_duplicates
→ extract_metadata → format_for_preprocessing
```

Standard output schema:

```json
{
  "text": "...",
  "source": "reddit | product_review | news",
  "timestamp": "2026-01-15T12:00:00Z",
  "engagement_score": 0.0,
  "metadata": {}
}
```

### 2. Preprocessing Layer — `backend/utils/text_preprocessing.py`

NLP utilities for cleaning and normalising raw text before chunking:

- `clean_text` / `remove_urls` / `remove_special_characters`
- `normalize_whitespace` / `normalize_text`
- `remove_stopwords` / `tokenize_text`
- `detect_language` / `calculate_text_length` / `word_frequency`
- **Pipeline function:** `prepare_text_for_embedding(text)` chains all steps.

### 3. Dataset Management Layer — `backend/data_collection/dataset_manager.py`

Manages named research datasets with:

- `create_dataset` / `add_record` / `remove_invalid_records`
- `get_dataset_summary` / `export_dataset` / `merge_datasets`
- Automatic `record_id` generation and timestamp tracking.

### 4. Data Validation Layer — `backend/utils/data_validation.py`

Quality gates applied before embedding:

- `validate_text_length` — min/max character bounds
- `check_missing_fields` — required field enforcement
- `validate_dataset_schema` — full dataset audit
- `detect_duplicate_records` — hash-based dedup detection

### 5. Chunking Layer — `backend/rag/chunking.py`

Multiple chunking strategies for preparing text for embedding:

| Strategy | Function |
|---|---|
| Fixed-size | `fixed_size_chunk(text, chunk_size)` |
| Sliding window | `sliding_window_chunk(text, window_size, overlap)` |
| Sentence-based | `sentence_based_chunk(text, max_sentences)` |
| Paragraph-based | `paragraph_chunk(text)` |

Each chunk includes metadata:

```json
{
  "chunk_id": "a1b2c3d4e5f6",
  "text": "...",
  "token_count": 120,
  "original_document_id": "",
  "strategy": "sliding_window",
  "index": 0
}
```

Helper: `estimate_token_count(text)` provides a rough BPE approximation.

### 6. Embedding Preparation Layer

Handled by the preprocessing + chunking layers working together. The pipeline is:

```
Raw text → prepare_text_for_embedding() → chunking strategy → chunk dicts → ready for vector embedding
```

### 7. Retrieval Layer — `backend/rag/retrieval_engine.py`

Demonstrates vector similarity search for RAG context retrieval:

- `embed_query` — placeholder embedding generation
- `cosine_similarity` — pure-Python similarity scoring
- `similarity_search` — rank records against a query vector
- `rank_results` — composite re-ranking (extensible)
- `filter_low_similarity` — threshold-based filtering
- `assemble_context` — token-budget-aware context assembly

**Pipeline function:** `retrieve_context_for_query(query, vector_db)`

```
embed_query → similarity_search → rank_results
→ filter_low_similarity → assemble_context
```

---

## Purpose

These modules exist to:

1. **Document the architecture** — Clearly illustrate each layer of a full RAG-based market research system.
2. **Enable future extensibility** — Provide a production-ready starting point if these layers need to be implemented as standalone services.
3. **Serve as reference** — Help developers understand the conceptual flow from data collection to retrieval.
4. **Demonstrate best practices** — Logging, error handling, type hints, docstrings, and composable pipelines.

## Important

- **No existing files were modified.**
- These modules are **not imported** anywhere in the project.
- The active system behaviour is **completely unaffected**.
- These are **independent utility modules** that exist purely for architectural illustration.
