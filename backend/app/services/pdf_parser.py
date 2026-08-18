from io import BytesIO
from typing import List

from pypdf import PdfReader


def parse_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    parts: List[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n\n".join(parts).strip()


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    """Simple fixed-size chunking with small overlap."""
    chunks: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks
