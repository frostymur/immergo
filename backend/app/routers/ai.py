import json
import os
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.db.database import (
    execute,
    fetch_many,
    fetch_one,
    insert_chunks,
    md5_bytes,
    vector_search,
)
from app.schemas.ai import (
    GeneratePodcastRequest,
    GeneratePodcastResponse,
    HeatmapResponse,
    SocraticAnswerRequest,
    SocraticAnswerResponse,
    SocraticChatRequest,
    SocraticChatResponse,
    SummaryRequest,
    SummaryResponse,
    UploadAndIndexResponse,
)
from app.services.embeddings import embed_text, embed_texts
from app.services.llm import (
    evaluate_answer,
    generate_podcast_script,
    generate_summary,
    socratic_response,
)
from app.services.pdf_parser import chunk_text, parse_pdf
from app.services.storage import upload_file
from app.services.tts import generate_podcast_audio

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/upload-and-index", response_model=UploadAndIndexResponse)
async def upload_and_index(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
):
    # Validate workspace exists
    ws = await fetch_one("SELECT id FROM workspaces WHERE id = $1", uuid.UUID(workspace_id))
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    file_hash = md5_bytes(data)

    # Check duplicate by hash in this workspace
    existing = await fetch_one(
        """
        SELECT s.id FROM sources s
        JOIN workspaces w ON w.id = s.workspace_id
        WHERE s.file_hash = $1 AND w.id = $2
        """,
        file_hash,
        uuid.UUID(workspace_id),
    )
    if existing:
        raise HTTPException(status_code=409, detail="File already indexed in this workspace")

    # Persist source record
    source_id = str(uuid.uuid4())
    storage_path = f"workspaces/{workspace_id}/sources/{file_hash}-{file.filename}"

    await execute(
        """
        INSERT INTO sources (id, workspace_id, file_name, file_hash, storage_path)
        VALUES ($1, $2, $3, $4, $5)
        """,
        uuid.UUID(source_id),
        uuid.UUID(workspace_id),
        file.filename or "untitled.pdf",
        file_hash,
        storage_path,
    )

    # Upload raw PDF to Supabase Storage (best-effort; storage may be optional)
    try:
        await upload_file("sources", storage_path, data, "application/pdf")
    except Exception:
        # Continue indexing even if storage upload fails (demo fallback can use local files)
        pass

    # Parse PDF, chunk, embed, insert
    text = parse_pdf(data)
    chunks = chunk_text(text, chunk_size=1000, overlap=100)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text extracted from PDF")

    embeddings = await embed_texts(chunks)
    await insert_chunks(source_id, list(zip(chunks, embeddings)))

    return UploadAndIndexResponse(
        source_id=source_id,
        file_hash=file_hash,
        chunks_indexed=len(chunks),
    )


@router.post("/generate-podcast", response_model=GeneratePodcastResponse)
async def generate_podcast(body: GeneratePodcastRequest):
    # Validate source
    source = await fetch_one(
        """
        SELECT s.id, s.file_hash, s.workspace_id FROM sources s
        WHERE s.id = $1 AND s.workspace_id = $2
        """,
        uuid.UUID(body.source_id),
        uuid.UUID(body.workspace_id),
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    file_hash = source["file_hash"]

    # Check cached artifact by file_hash
    cached = await fetch_one(
        """
        SELECT id, payload FROM workspace_artifacts
        WHERE workspace_id = $1 AND source_hash = $2 AND type = 'podcast'
        ORDER BY created_at DESC LIMIT 1
        """,
        uuid.UUID(body.workspace_id),
        file_hash,
    )
    if cached:
        raw_payload = cached["payload"]
        if isinstance(raw_payload, str):
            payload = json.loads(raw_payload)
        else:
            payload = raw_payload
        return GeneratePodcastResponse(
            artifact_id=str(cached["id"]),
            audio_url=payload.get("audio_url", ""),
            dialogue=payload.get("dialogue", []),
            cached=True,
        )

    # Gather context from top chunks
    chunks = await fetch_many(
        """
        SELECT content FROM document_chunks
        WHERE source_id = $1
        LIMIT 20
        """,
        uuid.UUID(body.source_id),
    )
    context = "\n\n".join([c["content"] for c in chunks])
    if not context:
        raise HTTPException(status_code=400, detail="No indexed content for this source")

    # Generate dialogue
    dialogue = await generate_podcast_script(context, lang=body.lang)

    # Synthesize audio
    audio_path = await generate_podcast_audio(dialogue, lang=body.lang)
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
    finally:
        os.remove(audio_path)

    # Upload to Supabase Storage
    storage_path = f"workspaces/{body.workspace_id}/artifacts/{file_hash}-podcast.mp3"
    try:
        audio_url = await upload_file("artifacts", storage_path, audio_bytes, "audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}")

    # Persist artifact
    artifact_id = str(uuid.uuid4())
    await execute(
        """
        INSERT INTO workspace_artifacts (id, workspace_id, source_hash, type, payload)
        VALUES ($1, $2, $3, 'podcast', $4)
        """,
        uuid.UUID(artifact_id),
        uuid.UUID(body.workspace_id),
        file_hash,
        json.dumps({"audio_url": audio_url, "dialogue": dialogue, "lang": body.lang}),
    )

    return GeneratePodcastResponse(
        artifact_id=artifact_id,
        audio_url=audio_url,
        dialogue=dialogue,
        cached=False,
    )


@router.post("/socratic-chat", response_model=SocraticChatResponse)
async def socratic_chat(body: SocraticChatRequest):
    # Embed question
    question_embedding = await embed_text(body.question)

    # Vector search across workspace chunks
    records = await vector_search(body.workspace_id, question_embedding, limit=5)
    if not records:
        raise HTTPException(status_code=400, detail="Workspace has no indexed documents")

    context = "\n\n---\n\n".join([r["content"] for r in records])
    result = await socratic_response(body.question, context, lang=body.lang)

    return SocraticChatResponse(
        feedback=result.get("feedback", ""),
        card=result.get("card", {"type": "question", "content": "", "expected_actions": []}),
        sources=[
            {"source_id": str(r["source_id"]), "file_name": r["file_name"], "similarity": round(float(r["similarity"]), 4)}
            for r in records
        ],
    )


@router.post("/socratic-answer", response_model=SocraticAnswerResponse)
async def socratic_answer(body: SocraticAnswerRequest):
    question_embedding = await embed_text(body.asked)
    records = await vector_search(body.workspace_id, question_embedding, limit=5)
    if not records:
        raise HTTPException(status_code=400, detail="Workspace has no indexed documents")
    context = "\n\n---\n\n".join([r["content"] for r in records])
    result = await evaluate_answer(body.asked, body.answer, context, lang=body.lang)
    return SocraticAnswerResponse(
        correct=bool(result.get("correct", False)),
        feedback=result.get("feedback", ""),
        card=result.get("card", {"type": "question", "content": "", "expected_actions": []}),
    )


@router.post("/summary", response_model=SummaryResponse)
async def summary(body: SummaryRequest):
    source = await fetch_one(
        """
        SELECT id, file_hash FROM sources
        WHERE id = $1 AND workspace_id = $2
        """,
        uuid.UUID(body.source_id),
        uuid.UUID(body.workspace_id),
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    cached = await fetch_one(
        """
        SELECT id, payload FROM workspace_artifacts
        WHERE workspace_id = $1 AND source_hash = $2 AND type = 'summary'
        ORDER BY created_at DESC LIMIT 1
        """,
        uuid.UUID(body.workspace_id),
        source["file_hash"],
    )
    if cached:
        raw_payload = cached["payload"]
        payload = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
        return SummaryResponse(summary=payload.get("summary", ""), cached=True)

    chunks = await fetch_many(
        """
        SELECT content FROM document_chunks
        WHERE source_id = $1
        LIMIT 20
        """,
        uuid.UUID(body.source_id),
    )
    context = "\n\n".join([c["content"] for c in chunks])
    if not context:
        raise HTTPException(status_code=400, detail="No indexed content for this source")

    summary_text = await generate_summary(context, lang=body.lang)
    await execute(
        """
        INSERT INTO workspace_artifacts (id, workspace_id, source_hash, type, payload)
        VALUES ($1, $2, $3, 'summary', $4)
        """,
        uuid.uuid4(),
        uuid.UUID(body.workspace_id),
        source["file_hash"],
        json.dumps({"summary": summary_text, "lang": body.lang}),
    )
    return SummaryResponse(summary=summary_text, cached=False)


@router.get("/teacher/heatmap", response_model=HeatmapResponse)
async def teacher_heatmap(workspace_id: str):
    rows = await fetch_many(
        """
        SELECT node_id,
               COUNT(*) FILTER (WHERE status = 'failed') AS failures,
               COUNT(*) FILTER (WHERE status = 'completed') AS completions,
               SUM(error_count) AS total_errors
        FROM student_progress
        WHERE workspace_id = $1
        GROUP BY node_id
        ORDER BY failures DESC, total_errors DESC
        """,
        uuid.UUID(workspace_id),
    )

    nodes = [
        {
            "node_id": r["node_id"],
            "failures": r["failures"],
            "completions": r["completions"],
            "total_errors": r["total_errors"] or 0,
            "intensity": min(1.0, (r["total_errors"] or 0) / max(1, (r["failures"] or 0) + (r["completions"] or 0)) / 3),
        }
        for r in rows
    ]

    return HeatmapResponse(workspace_id=workspace_id, nodes=nodes)
