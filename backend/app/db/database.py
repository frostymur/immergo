import hashlib
import uuid
from typing import Any, Optional

import asyncpg
from app.core.config import settings

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"),
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def fetch_one(query: str, *args: Any) -> Optional[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch_many(query: str, *args: Any) -> list[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args: Any) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


async def insert_chunks(source_id: str, chunks: list[tuple[str, list[float]]]) -> None:
    """Bulk insert document chunks with embeddings."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Convert embeddings to string format for pgvector
        rows = [
            (uuid.UUID(source_id), c, f"[{','.join(str(x) for x in emb)}]")
            for c, emb in chunks
        ]
        await conn.executemany(
            """
            INSERT INTO document_chunks (source_id, content, embedding)
            VALUES ($1, $2, $3::vector)
            """,
            rows,
        )


async def vector_search(workspace_id: str, embedding: list[float], limit: int = 5) -> list[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Convert list to string format for pgvector
        embedding_str = f"[{','.join(str(x) for x in embedding)}]"
        return await conn.fetch(
            """
            SELECT dc.content, dc.source_id, s.file_name,
                   1 - (dc.embedding <=> $1::vector) AS similarity
            FROM document_chunks dc
            JOIN sources s ON s.id = dc.source_id
            JOIN workspaces w ON w.id = s.workspace_id
            WHERE w.id = $2
            ORDER BY dc.embedding <=> $1::vector
            LIMIT $3
            """,
            embedding_str,
            uuid.UUID(workspace_id),
            limit,
        )


def md5_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()
