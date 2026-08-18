from typing import List
import hashlib

from openai import AsyncOpenAI

from app.core.config import settings

_client: AsyncOpenAI | None = None


def get_embeddings_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # Use standard OpenAI for embeddings (requires separate key with embedding access)
        # Fallback to Alem if OPENAI_API_KEY is not set
        api_key = settings.OPENAI_API_KEY
        base_url = settings.OPENAI_API_BASE
        _client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _client


def hash_embedding(text: str, dim: int = 1536) -> List[float]:
    """Fallback: generate deterministic pseudo-embedding from text hash."""
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


async def embed_texts(texts: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
    """Generate embeddings for a list of texts. Falls back to hash-based if API fails."""
    try:
        client = get_embeddings_client()
        response = await client.embeddings.create(input=texts, model=model)
        return [item.embedding for item in response.data]
    except Exception as e:
        print(f"Embedding API failed ({e}), using hash fallback")
        return [hash_embedding(text) for text in texts]


async def embed_text(text: str, model: str = "text-embedding-3-small") -> List[float]:
    result = await embed_texts([text], model=model)
    return result[0]
