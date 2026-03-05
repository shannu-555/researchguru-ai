# Architecture Extensions

These modules represent **conceptual layers** in the system architecture. They are provided for **architectural completeness and future extensibility only**.

> ⚠️ **None of these modules are part of the active runtime workflow.** They do not modify, interact with, or influence the existing pipeline in any way.

## Current Active Pipeline (unchanged)

```
User → Authentication → Create Project → Run Agents → Agent Results
     → Chunking → Embedding → Vector Database → Insight Generation
     → Visualization / Reports → Chat Assistant (RAG)
```

## Extension Modules

### 1. Data Collection (`backend/data_collection/`)

Demonstrates how external market data could be ingested from:

- **Reddit** — `reddit_collector.py`
- **Product Reviews** — `reviews_collector.py`
- **Market News** — `news_collector.py`

### 2. Text Preprocessing (`backend/utils/`)

Utility functions for cleaning and normalizing raw text before chunking and embedding:

- `text_preprocessing.py` — clean, normalize, remove URLs/special characters

### 3. Chunking (`backend/rag/`)

Shows document chunking strategies for preparing text for embedding:

- `chunking.py` — fixed-size and sliding-window chunking

### 4. Retrieval Engine (`backend/rag/`)

Demonstrates vector similarity search for RAG context retrieval:

- `retrieval_engine.py` — context retrieval and similarity search placeholders

## Purpose

These modules exist to:

1. **Document the architecture** — Clearly illustrate each layer of a full RAG-based research system.
2. **Enable future extensibility** — Provide a starting point if these layers need to be implemented as standalone services.
3. **Serve as reference** — Help developers understand the conceptual flow from data collection to retrieval.

## Important

- No existing files were modified.
- These modules are **not imported** anywhere in the project.
- The active system behavior is **completely unaffected**.
