import json
import os
import uuid
from typing import Any, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.core.config import settings
from app.db.database import (
    execute,
    fetch_many,
    fetch_one,
    insert_chunks,
    keyword_search,
    md5_bytes,
    vector_search,
)
from app.schemas.ai import (
    DiagnosticEvaluateRequest,
    DiagnosticEvaluateResponse,
    DiagnosticStartRequest,
    DiagnosticStartResponse,
    GeneratePodcastRequest,
    GeneratePodcastResponse,
    HeatmapResponse,
    LessonMessageRequest,
    LessonStartRequest,
    LessonStateResponse,
    RoadmapRequest,
    RoadmapResponse,
    SocraticAnswerRequest,
    SocraticAnswerResponse,
    SocraticChatRequest,
    SocraticChatResponse,
    SummaryRequest,
    SummaryResponse,
    TtsRequest,
    UploadAndIndexResponse,
)
from app.services.embeddings import embed_text, embed_texts_or_hash
from app.services.llm import (
    evaluate_answer,
    evaluate_diagnostic,
    generate_diagnostic_test,
    generate_lesson_plan,
    generate_podcast_script,
    generate_roadmap,
    generate_summary,
    socratic_response,
    stream_lesson_turn,
)
from app.services.pdf_parser import chunk_text, parse_pdf
from app.services.storage import LOCAL_STORAGE_ROOT, download_file, get_supabase, upload_file
from app.services.tts import generate_podcast_audio, synthesize_text

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


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

    embeddings = await embed_texts_or_hash(chunks)
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


async def _lesson_context(workspace_id: str, query: str, limit: int = 6) -> tuple[str, bool]:
    """RAG context for a lesson turn. Returns (context_text, used_material).

    Uses semantic vector search when the API key has embedder access, and
    falls back to keyword search when embeddings are unavailable.
    """
    try:
        embedding = await embed_text(query)
        records = await vector_search(workspace_id, embedding, limit=limit)
    except Exception:
        try:
            records = await keyword_search(workspace_id, query, limit=limit)
        except Exception:
            return "", False
    if not records:
        return "", False
    context = "\n\n---\n\n".join([r["content"] for r in records])
    return context, True


async def _append_block(session_id: str, idx: int, block: dict[str, Any]) -> None:
    await execute(
        """
        INSERT INTO lesson_blocks (session_id, idx, block)
        VALUES ($1, $2, $3::jsonb)
        """,
        uuid.UUID(session_id),
        idx,
        json.dumps(block, ensure_ascii=False),
    )


async def _load_lesson_blocks(session_id: str) -> list[dict[str, Any]]:
    rows = await fetch_many(
        """
        SELECT block FROM lesson_blocks
        WHERE session_id = $1
        ORDER BY idx ASC
        """,
        uuid.UUID(session_id),
    )
    return [r["block"] if isinstance(r["block"], dict) else json.loads(r["block"]) for r in rows]


async def _stream_lesson(
    session_id: str,
    history: list[dict[str, Any]],
    context: str,
    used_material: bool,
    lang: str,
    start_idx: int,
    student_message: str | None = None,
    topic: str | None = None,
    plan: list[dict[str, str]] | None = None,
) -> AsyncGenerator[str, None]:
    """Shared SSE generator: streams one tutor turn, persisting each block.

    Blocks are tagged with a ``step`` index so the frontend can lay the board
    out left-to-right, one column per lesson-plan step. A "section" block
    starts a new column. A "plan_update" block revises the remaining steps of
    the stored lesson plan (kept, not rendered on the board).
    """
    current_step = max((b.get("step", -1) for b in history), default=-1)
    idx = start_idx
    try:
        async for block in stream_lesson_turn(
            history=history,
            context=context,
            lang=lang,
            student_message=student_message,
            topic=topic,
            plan=plan,
        ):
            if block.get("kind") == "plan_update":
                new_steps = [
                    s for s in (block.get("steps") or []) if isinstance(s, dict) and s.get("title")
                ]
                if new_steps:
                    base_step = max((b.get("step", -1) for b in history), default=-1)
                    merged = (list(plan[: base_step + 1]) if plan else []) + new_steps
                    await execute(
                        "UPDATE lesson_sessions SET plan = $2::jsonb WHERE id = $1",
                        uuid.UUID(session_id),
                        json.dumps(merged, ensure_ascii=False),
                    )
                    plan = merged
                    yield _sse({"kind": "plan", "steps": merged})
                continue
            if block.get("kind") == "section":
                current_step += 1
            block["step"] = max(current_step, 0)
            if used_material:
                block["material"] = True
            await _append_block(session_id, idx, block)
            yield _sse({"kind": "block", "idx": idx, "block": block})
            idx += 1
        yield _sse({"kind": "done"})
    except Exception as exc:
        yield _sse({"kind": "error", "message": str(exc)})


@router.post("/lesson/start")
async def lesson_start(body: LessonStartRequest):
    # Validate workspace exists
    ws = await fetch_one("SELECT id FROM workspaces WHERE id = $1", uuid.UUID(body.workspace_id))
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    session_id = str(uuid.uuid4())

    # Plan the lesson first, so the board is laid out step-by-step.
    plan: list[dict[str, str]] = []
    try:
        plan = await generate_lesson_plan(body.prompt, lang=body.lang)
    except Exception:
        plan = []

    await execute(
        """
        INSERT INTO lesson_sessions (id, workspace_id, prompt, lang, plan)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        uuid.UUID(session_id),
        uuid.UUID(body.workspace_id),
        body.prompt,
        body.lang,
        json.dumps(plan, ensure_ascii=False) if plan else None,
    )

    context, used_material = await _lesson_context(body.workspace_id, body.prompt)

    async def event_stream() -> AsyncGenerator[str, None]:
        yield _sse({"kind": "plan", "steps": plan})
        yield _sse({"kind": "session", "session_id": session_id, "prompt": body.prompt})
        async for event in _stream_lesson(
            session_id=session_id,
            history=[],
            context=context,
            used_material=used_material,
            lang=body.lang,
            start_idx=0,
            topic=body.prompt,
            plan=plan,
        ):
            yield event

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/lesson/{session_id}/message")
async def lesson_message(session_id: str, body: LessonMessageRequest):
    session = await fetch_one(
        "SELECT id, workspace_id, lang, prompt, plan FROM lesson_sessions WHERE id = $1",
        uuid.UUID(session_id),
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")

    history = await _load_lesson_blocks(session_id)
    student_idx = len(history)
    student_block = {"kind": "student", "text": text}
    await _append_block(session_id, student_idx, student_block)

    context, used_material = await _lesson_context(str(session["workspace_id"]), text)
    lang = session["lang"] or "en"
    plan: list[dict[str, str]] = []
    raw_plan = session["plan"]
    if raw_plan:
        plan = json.loads(raw_plan) if isinstance(raw_plan, str) else raw_plan

    async def event_stream() -> AsyncGenerator[str, None]:
        yield _sse({"kind": "student", "idx": student_idx, "block": student_block})
        async for event in _stream_lesson(
            session_id=session_id,
            history=history + [student_block],
            context=context,
            used_material=used_material,
            lang=lang,
            start_idx=student_idx + 1,
            student_message=text,
            topic=session["prompt"],
            plan=plan,
        ):
            yield event

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/lesson/{session_id}", response_model=LessonStateResponse)
async def lesson_state(session_id: str):
    session = await fetch_one(
        """
        SELECT id, workspace_id, prompt, lang, status, created_at, plan
        FROM lesson_sessions WHERE id = $1
        """,
        uuid.UUID(session_id),
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")

    blocks = await _load_lesson_blocks(session_id)
    raw_plan = session["plan"]
    plan: list[dict[str, str]] = json.loads(raw_plan) if isinstance(raw_plan, str) else (raw_plan or [])
    return LessonStateResponse(
        session={
            "id": str(session["id"]),
            "workspace_id": str(session["workspace_id"]),
            "prompt": session["prompt"],
            "lang": session["lang"],
            "status": session["status"],
        },
        plan=plan,
        blocks=[{"idx": i, "block": b} for i, b in enumerate(blocks)],
    )


@router.post("/tts")
async def tts(body: TtsRequest, background_tasks: BackgroundTasks):
    try:
        audio_path = await synthesize_text(body.text, body.lang)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS failed: {exc}")
    background_tasks.add_task(lambda: os.path.exists(audio_path) and os.remove(audio_path))
    return FileResponse(audio_path, media_type="audio/mpeg", filename="speech.mp3")


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


@router.post("/diagnostic/start", response_model=DiagnosticStartResponse)
async def diagnostic_start(body: DiagnosticStartRequest):
    questions = await generate_diagnostic_test(
        subject=body.subject,
        grade=body.grade,
        goal=body.goal,
        lang=body.lang,
    )
    if not questions:
        raise HTTPException(status_code=502, detail="Diagnostic generation failed")
    return DiagnosticStartResponse(questions=questions)


@router.post("/diagnostic/evaluate", response_model=DiagnosticEvaluateResponse)
async def diagnostic_evaluate(body: DiagnosticEvaluateRequest):
    questions = body.questions
    answers = body.answers
    correct = 0
    wrong_topics: list[str] = []
    for i, q in enumerate(questions):
        try:
            q = dict(q)
        except (TypeError, ValueError):
            continue
        given = answers[i] if i < len(answers) else -1
        right = q.get("answer")
        if isinstance(right, int) and given == right:
            correct += 1
        else:
            wrong_topics.append(str(q.get("q", ""))[:120])
    total = len(questions) or 1
    weak_hint = "; ".join(wrong_topics[:5]) if wrong_topics else ""
    result = await evaluate_diagnostic(
        subject=body.subject,
        grade=body.grade,
        goal=body.goal,
        lang=body.lang,
        correct=correct,
        total=total,
        weak_topics_hint=weak_hint,
    )
    return DiagnosticEvaluateResponse(
        correct=correct,
        total=len(questions),
        level=result["level"],
        feedback=result["feedback"],
        weak_topics=result["weak_topics"],
        recommendation=result["recommendation"],
    )


@router.post("/roadmap", response_model=RoadmapResponse)
async def roadmap(body: RoadmapRequest):
    steps = await generate_roadmap(topic=body.topic, goal=body.goal, lang=body.lang)
    if not steps:
        raise HTTPException(status_code=502, detail="Roadmap generation failed")
    return RoadmapResponse(topic=body.topic, steps=steps)


@router.get("/source/{source_id}/file")
async def source_file(source_id: str):
    src = await fetch_one(
        "SELECT workspace_id, file_name, storage_path FROM sources WHERE id = $1",
        uuid.UUID(source_id),
    )
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    headers = {"Content-Disposition": f'inline; filename="{src["file_name"]}"'}
    try:
        data = await download_file("sources", src["storage_path"])
        return Response(content=data, media_type="application/pdf", headers=headers)
    except Exception:
        local = os.path.join(LOCAL_STORAGE_ROOT, "sources", src["storage_path"])
        if not os.path.exists(local):
            raise HTTPException(status_code=502, detail="Source file unavailable")
        with open(local, "rb") as f:
            data = f.read()
        return Response(content=data, media_type="application/pdf", headers=headers)
