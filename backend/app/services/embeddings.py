from typing import List
import hashlib

from openai import AsyncOpenAI

from app.core.config import settings

_client: AsyncOpenAI | None = None


def get_embeddings_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # Prefer the dedicated Alem embedder key; fall back to the chat key
        # (which typically lacks embedder access).
        api_key = settings.ALEM_EMBED_API_KEY or settings.OPENAI_API_KEY
        base_url = settings.ALEM_EMBED_BASE_URL or settings.OPENAI_API_BASE
        _client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _client


def hash_embedding(text: str, dim: int = 0) -> List[float]:
    """Fallback: generate deterministic pseudo-embedding from text hash."""
    if dim <= 0:
        dim = settings.EMBED_DIM
    h = hashlib.sha256(text.encode()).hexdigest()
    # Convert hex to float vector
    import struct
    floats = []
    for i in range(0, min(len(h), dim * 2), 2):
        byte_val = int(h[i:i+2], 16)
        floats.append((byte_val / 255.0) * 2 - 1)  # Normalize to [-1, 1]
    # Pad to dim
    while len(floats) < dim:
        floats.append(0.0)
    return floats[:dim]


async def embed_texts(texts: List[str], model: str | None = None) -> List[List[float]]:
    """Generate embeddings for a list of texts. Raises if the API call fails."""
    client = get_embeddings_client()
    response = await client.embeddings.create(
        input=texts,
        model=model or settings.EMBED_MODEL,
    )
    return [item.embedding for item in response.data]


async def embed_text(text: str, model: str | None = None) -> List[float]:
    result = await embed_texts([text], model=model)
    return result[0]


async def embed_texts_or_hash(texts: List[str]) -> List[List[float]]:
    """Embeddings for indexing: try the real API, fall back to hash vectors
    so chunks are still stored and retrievable via keyword search."""
    try:
        return await embed_texts(texts)
    except Exception:
        print("Embedding API unavailable, storing hash vectors for keyword search")
        return [hash_embedding(text) for text in texts]
