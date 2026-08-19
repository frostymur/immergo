import hashlib
import re
import uuid
from typing import Any, Optional

import asyncpg
from app.core.config import settings

_pool: Optional[asyncpg.Pool] = None


def _conn_kwargs() -> dict[str, Any]:
    """Parse DATABASE_URL into asyncpg kwargs.

    Manual parsing (instead of passing the DSN through) so passwords containing
    characters like '[' or ']' don't break urllib's bracketed-host validation.
    """
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    rest = dsn[len("postgresql://"):]
    creds, _, hostpart = rest.rpartition("@")
    user, _, password = creds.partition(":")
    hostport, _, database = hostpart.partition("/")
    host, _, port = hostport.partition(":")
    return {
        "user": user or "postgres",
        "password": password,
        "host": host or "localhost",
        "port": int(port or "5432"),
        "database": database or "postgres",
    }


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            **_conn_kwargs(),
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


async def keyword_search(workspace_id: str, query: str, limit: int = 5) -> list[asyncpg.Record]:
    """Rank document chunks by keyword overlap (no embeddings required).

    Uses Postgres full-text search with the 'simple' config so it works for
    any script (English, Russian, Kazakh). Tokens are OR-ed together so a full
    sentence still matches chunks that share a few words, ranked by relevance.
    """
    tokens = re.findall(r"\w+", query.lower(), re.UNICODE)
    tokens = [t for t in tokens if len(t) >= 2][:12]
    if not tokens:
        return []
    tsquery = " | ".join(f"'{t}'" for t in tokens)
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT dc.content, dc.source_id, s.file_name,
                   ts_rank(to_tsvector('simple', dc.content),
                           to_tsquery('simple', $1)) AS similarity
            FROM document_chunks dc
            JOIN sources s ON s.id = dc.source_id
            JOIN workspaces w ON w.id = s.workspace_id
            WHERE w.id = $2
              AND to_tsvector('simple', dc.content) @@ to_tsquery('simple', $1)
            ORDER BY similarity DESC
            LIMIT $3
            """,
            tsquery,
            uuid.UUID(workspace_id),
            limit,
        )


def md5_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()
