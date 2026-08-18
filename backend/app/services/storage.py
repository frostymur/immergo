import os
import time
from typing import Optional

from supabase import Client, create_client

from app.core.config import settings

_supabase: Optional[Client] = None

LOCAL_STORAGE_ROOT = os.path.abspath(
    os.environ.get("LOCAL_STORAGE_ROOT", os.path.join(os.path.dirname(__file__), "..", "static"))
)
LOCAL_STORAGE_URL_BASE = os.environ.get("LOCAL_STORAGE_URL_BASE", "http://localhost:8000/static")


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend .env")
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase


def _local_path(bucket: str, path: str) -> str:
    return os.path.join(LOCAL_STORAGE_ROOT, bucket, path)


def _local_url(bucket: str, path: str) -> str:
    return f"{LOCAL_STORAGE_URL_BASE}/{bucket}/{path}"


def _save_local(bucket: str, path: str, data: bytes) -> str:
    local = _local_path(bucket, path)
    os.makedirs(os.path.dirname(local), exist_ok=True)
    with open(local, "wb") as f:
        f.write(data)
    return _local_url(bucket, path)


async def upload_file(bucket: str, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to Supabase Storage and return public URL.

    Retries transient failures. Falls back to local filesystem if Supabase Storage
    is unreachable so the product keeps working during network issues.
    """
    sb = get_supabase()
    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            sb.storage.from_(bucket).upload(path, data, {"content-type": content_type, "upsert": "true"})
            return sb.storage.from_(bucket).get_public_url(path)
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))

    # Fallback: write locally and serve through /static mount
    try:
        url = _save_local(bucket, path, data)
        return url
    except Exception as local_exc:
        raise RuntimeError(
            f"Storage upload failed after {attempt + 1} attempts: {last_error}; "
            f"local fallback also failed: {local_exc}"
        ) from local_exc


async def download_file(bucket: str, path: str) -> bytes:
    sb = get_supabase()
    res = sb.storage.from_(bucket).download(path)
    if isinstance(res, bytes):
        return res
    raise RuntimeError(f"Failed to download {path}: {res}")
