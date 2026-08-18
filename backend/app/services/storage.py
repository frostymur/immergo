from typing import Optional

from supabase import Client, create_client

from app.core.config import settings

_supabase: Optional[Client] = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend .env")
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase


async def upload_file(bucket: str, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to Supabase Storage and return public URL."""
    sb = get_supabase()
    sb.storage.from_(bucket).upload(path, data, {"content-type": content_type, "upsert": "true"})
    return sb.storage.from_(bucket).get_public_url(path)


async def download_file(bucket: str, path: str) -> bytes:
    sb = get_supabase()
    res = sb.storage.from_(bucket).download(path)
    if isinstance(res, bytes):
        return res
    raise RuntimeError(f"Failed to download {path}: {res}")
