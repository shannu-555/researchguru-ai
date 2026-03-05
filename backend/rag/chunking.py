"""
Optional Chunking Utility.

This module demonstrates how documents could be split into
smaller chunks suitable for embedding and vector storage.

It is NOT connected to the current agent pipeline.
The active system performs chunking inside the run-agents
edge function. This exists only for architectural completeness.
"""


def chunk_text(text: str, chunk_size: int = 500) -> list:
    """
    Split text into fixed-size chunks.
    
    Args:
        text: The input text to chunk.
        chunk_size: Number of characters per chunk.
    
    Returns:
        List of text chunks.
    """
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]


def sliding_window_chunk(text: str, window_size: int = 500, overlap: int = 100) -> list:
    """
    Split text using a sliding window with overlap for better context preservation.
    
    Args:
        text: The input text to chunk.
        window_size: Number of characters per window.
        overlap: Number of overlapping characters between windows.
    
    Returns:
        List of overlapping text chunks.
    """
    chunks = []
    step = window_size - overlap
    for i in range(0, len(text), step):
        chunk = text[i:i + window_size]
        if chunk:
            chunks.append(chunk)
    return chunks
