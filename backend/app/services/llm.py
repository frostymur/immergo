import asyncio
import hashlib
import json
from pathlib import Path
import re
from typing import Any, AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import settings

_clients: dict[str, AsyncOpenAI] = {}


def get_llm_client(lang: str = "en") -> AsyncOpenAI:
    # Kazakh lessons run on the ALEM endpoint (alemllm); Russian and English
    # lessons run on the Qwen endpoint (qwen3-8).
    group = "kz" if lang == "kz" else "other"
    if group not in _clients:
        if lang == "kz":
            api_key = settings.ALEM_LLM_API_KEY
            base_url = settings.ALEM_LLM_BASE_URL
        else:
            api_key = settings.QWEN_API_KEY
            base_url = settings.QWEN_API_BASE
        _clients[group] = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _clients[group]


def get_llm_model(lang: str = "en") -> str:
    return settings.KZ_MODEL if lang == "kz" else settings.QWEN_MODEL


VOICE_MAP = {
    "kz": "kk-KZ-AigulNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "en": "en-US-AriaNeural",
}


LLM_SYSTEM = {
    "kz": "Сен қуатты AI-оқытушысың. Жауаптарды қазақ тілінде бер. Берілген контексті қолдан.",
    "ru": "Ты — мощный ИИ-репетитор. Отвечай на русском языке. Используй предоставленный контекст.",
    "en": "You are a powerful AI tutor. Respond in English. Use the provided context.",
}


async def generate_podcast_script(
    context: str,
    lang: str = "en",
    model: str | None = None,
) -> list[dict[str, str]]:
    """Generate a two-speaker JSON dialogue from source material."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = LLM_SYSTEM.get(lang, LLM_SYSTEM["en"])
    prompt = f"""{system}

Create an educational podcast dialogue between two speakers, A and B, based on the material below.
Rules:
- Output ONLY a JSON array of objects: [{{"speaker": "A", "text": "..."}}, ...]
- Speakers alternate naturally.
- Explain key concepts clearly for a student.
- Language: {lang.upper()}

Material:
{context[:12000]}
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )
    raw = response.choices[0].message.content or "[]"
    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    dialogue = json.loads(raw)
    if not isinstance(dialogue, list):
        raise ValueError("LLM did not return a JSON array")
    return dialogue


async def socratic_response(
    question: str,
    context: str,
    lang: str = "en",
    model: str | None = None,
) -> dict[str, Any]:
    """Generate a Socratic tutor response with one guiding question and a whiteboard card."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = LLM_SYSTEM.get(lang, LLM_SYSTEM["en"])
    prompt = f"""{system}

You are a Socratic tutor. The student asked:
"{question}"

Relevant context:
{context}

Respond in strict JSON with keys:
- "feedback": brief, encouraging feedback that highlights a gap or misconception without giving the direct answer.
- "card": an object describing the NEXT step on the interactive whiteboard:
    - "type": one of "question" | "hint" | "example" | "formula" | "diagram"
    - "content": concise text for that step (a guiding question, a hint, a short worked example, a formula, or a scheme description)
    - "expected_actions": list of 2-3 action strings the student can take next
    - "diagram": OPTIONAL object {{"nodes":[{{"id":"n1","label":"..."}}],"edges":[["n1","n2"]]}} for a small visual scheme (max 6 nodes)

Use the diagram field for step-by-step breakdowns (e.g. a process, derivation chain, or comparison). Output only valid JSON. Language: {lang.upper()}.
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
    )
    raw = response.choices[0].message.content or "{}"
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    return json.loads(raw)


async def evaluate_answer(
    asked: str,
    answer: str,
    context: str,
    lang: str = "en",
    model: str | None = None,
) -> dict[str, Any]:
    """Evaluate a student's answer to a Socratic guiding question."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = LLM_SYSTEM.get(lang, LLM_SYSTEM["en"])
    prompt = f"""{system}

The tutor asked the student this guiding question:
"{asked}"

The student answered:
"{answer}"

Relevant context:
{context}

Judge whether the answer is substantially correct (core idea right, even if imperfect). Respond in strict JSON:
- "correct": true or false
- "feedback": short encouraging feedback. If correct, affirm and state the key point. If wrong, highlight the gap with a hint — DO NOT give the full solution.
- "card": the next whiteboard step with the same schema as before:
    - "type": one of "question" | "hint" | "example" | "formula" | "diagram"
    - "content": concise text for that step
    - "expected_actions": list of 2-3 action strings the student can take next
    - "diagram": OPTIONAL object {{"nodes":[{{"id":"n1","label":"..."}}],"edges":[["n1","n2"]]}} for a small visual scheme (max 6 nodes)

If correct, make the next card a short follow-up "question" deepening understanding. Output only valid JSON. Language: {lang.upper()}.
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )
    raw = response.choices[0].message.content or "{}"
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    return json.loads(raw)


LESSON_LANG_NAMES = {"kz": "Kazakh", "ru": "Russian", "en": "English"}

LESSON_SYSTEM = """You are Immergo, a live AI tutor teaching a one-on-one lesson on a digital whiteboard.
You teach by WRITING short notes on the whiteboard and SPEAKING a spoken explanation for each note (read aloud via TTS). The student watches the board and can answer or ask questions at any time.

OUTPUT FORMAT — one JSON object per line (NDJSON). No markdown fences, no commentary, nothing outside the JSON lines. Each line is one whiteboard block:
{"kind":"section","title":"...","speak":"..."}                       big topic heading (use once, at the start of a new topic)
{"kind":"subsection","title":"...","speak":"..."}                    sub-topic heading
{"kind":"note","text":"...","speak":"..."}                           short written note (1-2 lines max)
{"kind":"formula","text":"3x + 5 = 17","speak":"..."}                formula/equation as plain-text math
{"kind":"bullets","items":["...","..."],"speak":"..."}               2-4 bullet points
{"kind":"steps","items":["...","..."],"speak":"..."}                 numbered worked steps
{"kind":"table","columns":["Col A","Col B"],"rows":[["a1","b1"],["a2","b2"]],"speak":"..."}   comparison/list table (max 5 columns, 6 rows)
{"kind":"diagram","nodes":[{"id":"n1","label":"Start","shape":"start"},{"id":"n2","label":"x > 0?","shape":"decision"},{"id":"n3","label":"End","shape":"end"}],"edges":[["n1","n2"],["n2","n3","yes"],["n2","n4","no"]],"speak":"..."}   flowchart/branching diagram (max 8 nodes; shape: start|end|decision; short labels; optional edge labels)
{"kind":"task","text":"...","speak":"..."}                           a task/question the STUDENT must solve
{"kind":"feedback","text":"...","correct":true,"speak":"..."}        evaluation of the student's answer ("correct": true/false)
{"kind":"choice","title":"What's next?","options":["Practice more","Go deeper","Move on"],"speak":"..."}   offer the student a choice of next direction (then "end" and wait for their pick)
{"kind":"plan_update","steps":[{"title":"...","detail":"..."}]}   (optional, only at the very start of a turn) revise the REMAINING lesson steps
{"kind":"end"}                                                       end of your turn — ALWAYS the last line

VISUAL EXAMPLES — copy these exact JSON shapes when showing a process/flow (diagram) or a comparison (table):
{"kind":"diagram","nodes":[{"id":"n1","label":"Start","shape":"start"},{"id":"n2","label":"Net force?","shape":"decision"},{"id":"n3","label":"No change","shape":"end"},{"id":"n4","label":"Accelerates","shape":"end"}],"edges":[["n1","n2"],["n2","n3","yes"],["n2","n4","no"]],"speak":"Balanced forces mean no change; an unbalanced net force accelerates the object."}
{"kind":"table","columns":["Solid","Liquid","Gas"],"rows":[["fixed shape","takes container shape","fills container"],["fixed volume","fixed volume","fills volume"]],"speak":"Here is how the three states of matter compare."}

EXAMPLE — the end of a turn that finishes a step and offers a branch:
{"kind":"feedback","text":"Exactly — acceleration halves.","correct":true,"speak":"Exactly right. If the mass doubles, the acceleration halves."}
{"kind":"choice","title":"What's next?","options":["Practice one more","Go deeper into F = ma","Move to the next topic"],"speak":"Where would you like to go next?"}
{"kind":"end"}

RULES:
- Written "text"/"items" are concise board notes, not essays. "speak" is natural spoken language (1-3 sentences) that explains the block — never just reads it verbatim. Blocks that need no voice (e.g. "end") omit "speak".
- VISUALS ARE EXPECTED: use a "table" block for comparisons, listings and pros/cons; use a "diagram" block for processes, flows, cycles, algorithms and decision trees. At least one table or diagram per lesson, in the step where it fits best. "speak" briefly explains the visual. Keep diagram labels short and node ids unique.
- Teach one sub-topic per turn: a few explanation blocks, then ONE "task" block, then "end" and wait for the student. Never answer your own task.
- SOCRATIC METHOD: when the student answers a task, open with a "feedback" block. If the answer is wrong or incomplete NEVER reveal the solution — point at the gap and follow with a guiding "note"/"task". If correct ("correct": true), confirm briefly, then continue the lesson with the next sub-topic.
- ADAPTIVE: the lesson plan is a guide, not a contract. Stay in the current step while the student struggles (extra notes/tasks) and only advance once it is learned; every advance opens a new "section". If the lesson takes an unexpected turn (student confused, wants more depth, topic changes), revise the REMAINING steps with a "plan_update" block at the start of a turn — the system keeps already-DONE steps, so only list what still lies ahead.
- CHOICE: when a step is COMPLETE (usually right after the student solved a task correctly), END your turn with a "choice" block so the student picks the next direction, then "end" and wait. If the student is still wrong or incomplete, keep teaching in the current step instead — do not offer a choice yet.
- When the student asks a question, answer it with note/formula/steps blocks, then continue the lesson.
- At most 8 blocks per turn (excluding "end").
- Write and speak ONLY in {lang_name}.
- When MATERIAL from the student's own documents is provided, ground the lesson in it.
"""


_TABLE_WORDS = (
    "compare", "comparison", "versus", "vs", "differ", "pros", "cons",
    "advantage", "disadvantage", "list", "table",
    "type", "kind", "classif", "сравн", "отлич", "вид", "тип", "список",
    "сар", "салыстыр", "түр",
)
_DIAGRAM_WORDS = (
    "process", "flow", "stage", "chain", "cycle", "order", "sequence", "path",
    "decision", "branch", "algorithm", "mechanism", "pipeline", "timeline",
    "works", "step by step", "how it works", "процесс", "схем",
    "этап", "порядок", "цепочк", "механизм", "как работает", "жүйе", "кезең",
)


def _has_word(text: str, word: str) -> bool:
    if " " in word:
        return word in text
    return re.search(rf"\b{re.escape(word)}\b", text) is not None


def _visual_directive(topic: str, current_step: int, plan: list[dict[str, str]]) -> str:
    """Return a directive telling the model to write a visual block, or "".

    Looks at the lesson topic (first turn only) plus the current and next plan
    step. Comparison-ish wording -> "table"; process/flow wording -> "diagram".
    """
    candidates: list[str] = []
    if current_step < 0 and topic:
        candidates.append(topic)
    for i in (current_step, current_step + 1):
        if 0 <= i < len(plan):
            s = plan[i]
            candidates.append(f"{s.get('title', '')} {s.get('detail', '')}")
    text = " ".join(candidates).lower()
    # Diagram (process/flow) wins over table on conflict: processes are the
    # most-missed visual, and the user explicitly wants schemes on the board.
    for word in _DIAGRAM_WORDS:
        if _has_word(text, word):
            return ('VISUAL DIRECTIVE: this step/lesson is a process or flow — your output MUST '
                    'include a "diagram" block in this turn, in the form: '
                    '{"kind":"diagram","nodes":[{"id":"n1","label":"...","shape":"start"},{"id":"n2","label":"...","shape":"decision"},{"id":"n3","label":"...","shape":"end"}],"edges":[["n1","n2"],["n2","n3","yes"]],"speak":"..."} '
                    '(max 8 nodes; labels short). Do NOT output a "table" block for this process '
                    '— use the diagram flowchart instead.')
    for word in _TABLE_WORDS:
        if _has_word(text, word):
            return ('VISUAL DIRECTIVE: this step/lesson compares or lists things — your output '
                    'MUST include a "table" block in this turn, in the form: '
                    '{"kind":"table","columns":["A","B"],"rows":[["a1","b1"],["a2","b2"]],"speak":"..."} '
                    '(max 5 columns, 6 rows). Do NOT explain this comparison only with plain notes.')
    return ""


def serialize_lesson_history(blocks: list[dict[str, Any]], limit: int = 60) -> str:
    """Render stored lesson blocks into a compact transcript for the LLM."""
    lines: list[str] = []
    for b in blocks[-limit:]:
        kind = b.get("kind")
        if kind == "student":
            lines.append(f"STUDENT: {b.get('text', '')}")
        elif kind == "task":
            lines.append(f"IMMERGO (task for student): {b.get('text', '')}")
        elif kind == "feedback":
            verdict = "correct" if b.get("correct") else "not quite"
            lines.append(f"IMMERGO (feedback, {verdict}): {b.get('text', '')}")
        elif kind in ("section", "subsection"):
            lines.append(f"IMMERGO (heading): {b.get('title', '')}")
        elif kind in ("note", "formula"):
            lines.append(f"IMMERGO ({kind}): {b.get('text', '')}")
        elif kind in ("bullets", "steps"):
            lines.append(f"IMMERGO ({kind}): " + " | ".join(b.get("items", [])))
        elif kind == "table":
            lines.append(f"IMMERGO (table): columns={b.get('columns', [])} rows={b.get('rows', [])}")
        elif kind == "diagram":
            node_repr = "; ".join(f"{n.get('id')}={n.get('label')}" for n in b.get("nodes", []))
            edge_repr = "; ".join("->".join(map(str, e)) for e in b.get("edges", []))
            lines.append(f"IMMERGO (diagram): nodes[{node_repr}] edges[{edge_repr}]")
        elif kind == "choice":
            lines.append(f"IMMERGO (choice): {b.get('title', '')} options={b.get('options', [])}")
    return "\n".join(lines)


PLAN_SYSTEM = """You are a lesson planner. Given a student's request, design a step-by-step lesson plan.
Output ONLY a JSON array of 4 to 6 objects, one per step, in the exact shape:
[{"title": "Short heading for the whiteboard column (2-6 words)", "detail": "One line on what the student will learn or practice in this step"}]
- Steps build on each other and cover the whole requested topic.
- Write the plan ONLY in {lang_name}.
"""


async def generate_lesson_plan(
    prompt: str,
    lang: str = "en",
    model: str | None = None,
) -> list[dict[str, str]]:
    """Generate a step-by-step lesson plan (list of step dicts) before teaching."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    lang_name = LESSON_LANG_NAMES.get(lang, "English")
    system = PLAN_SYSTEM.replace("{lang_name}", lang_name)
    user = f'The student wants to learn: "{prompt}"'
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.5,
    )
    raw = (response.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(plan, list):
        return []
    steps: list[dict[str, str]] = []
    for item in plan:
        if isinstance(item, dict) and item.get("title"):
            steps.append(
                {
                    "title": str(item["title"]),
                    "detail": str(item.get("detail", "") or ""),
                }
            )
    return steps


def _parse_block_line(line: str) -> dict[str, Any] | None:
    """Parse one NDJSON line into a block dict, or None if not a valid block."""
    line = line.strip()
    if not line or not line.startswith("{"):
        return None
    try:
        block = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(block, dict) or "kind" not in block:
        return None
    return block


async def _generate_visual_block(
    directive: str,
    subject: str,
    lang: str = "en",
    model: str | None = None,
) -> dict[str, Any] | None:
    """Deterministic fallback: when a turn stream ignored a VISUAL DIRECTIVE,
    ask the LLM (focused, minimal prompt) for the single missing table/diagram
    block so the whiteboard always gets a visual for comparison/process steps."""
    kind = "diagram" if "diagram" in directive else "table"
    schema = (
        '{"kind":"diagram","nodes":[{"id":"n1","label":"...","shape":"start"},'
        '{"id":"n2","label":"...","shape":"decision"},{"id":"n3","label":"...","shape":"end"}],'
        '"edges":[["n1","n2"],["n2","n3","yes"]],"speak":"..."}'
        if kind == "diagram"
        else '{"kind":"table","columns":["A","B"],"rows":[["a1","b1"],["a2","b2"]],"speak":"..."}'
    )
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    lang_name = LESSON_LANG_NAMES.get(lang, "English")
    prompt = (
        "You are Lumi writing ONE whiteboard block for a student's lesson.\n"
        f'Output EXACTLY ONE JSON line of the form:\n{schema}\n'
        f"Make the content a concrete {kind} that explains the step below. "
        "Keep labels short and ids unique.\n"
        f"Step: {subject}\n"
        f"Language: {lang_name}. No other text, no markdown fences, no extra lines."
    )
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"Output only one valid JSON line for a {kind} block. Language: {lang_name}."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
        )
        raw = (response.choices[0].message.content or "").strip()
        for line in raw.splitlines():
            block = _parse_block_line(line)
            if block is not None and block.get("kind") == kind:
                return block
    except Exception:
        return None
    return None


async def stream_lesson_turn(
    history: list[dict[str, Any]],
    context: str,
    lang: str = "en",
    student_message: str | None = None,
    topic: str | None = None,
    plan: list[dict[str, str]] | None = None,
    level: str = "intermediate",
    model: str | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """Stream one lesson turn from the LLM as parsed whiteboard blocks.

    The model emits NDJSON (one block per line); each block is yielded as soon
    as its line completes so the frontend can render/speak it immediately.
    Falls back to a non-streaming call if the endpoint rejects streaming.
    """
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    lang_name = LESSON_LANG_NAMES.get(lang, "English")
    system = LESSON_SYSTEM.replace("{lang_name}", lang_name)

    level_note = {
        "beginner": "The student is at a BEGINNER level: explain fundamentals first, use simple examples, go slower, and reinforce basics before advancing.",
        "intermediate": "The student is at an INTERMEDIATE level: assume basic familiarity, focus on connections and common mistakes.",
        "advanced": "The student is at an ADVANCED level: go deeper, cover edge cases, harder problems and exam-style reasoning.",
    }.get(level, "")
    if level_note:
        system += f"\n\nADAPTIVE DIFFICULTY: {level_note}"

    directive = ""
    directive_kind = ""
    subject = topic or ""
    if plan:
        current_step = max((b.get("step", -1) for b in history), default=-1)
        plan_lines = "\n".join(
            ("DONE " if i < current_step else "CURRENT " if i == current_step else "upcoming ")
            + f"{i + 1}. {s['title']}: {s['detail']}"
            for i, s in enumerate(plan)
        )
        system += (
            "\n\nLESSON PLAN (marked DONE / CURRENT / upcoming) — follow the steps "
            "in order but ADAPT: stay in the current step while the student "
            "struggles; advance once it is learned, opening a \"section\" block "
            "each time. You may revise the REMAINING steps with a \"plan_update\" "
            "block at the start of a turn.\n"
            f"LESSON PLAN:\n{plan_lines}"
        )
        directive = _visual_directive(topic or "", current_step, plan)
        if directive:
            system += "\n\n" + directive
            directive_kind = "diagram" if "diagram" in directive else "table"
            step_titles = []
            for i in (current_step, current_step + 1):
                if 0 <= i < len(plan):
                    step_titles.append(plan[i].get("title", ""))
            if step_titles:
                subject = f"{topic or ''} — steps: {' / '.join(step_titles)}"

    transcript = serialize_lesson_history(history)
    parts = []
    if topic:
        parts.append(f'THE TOPIC OF THIS LESSON IS: "{topic}". Teach THIS topic — stay on it in every block.')
    if transcript:
        parts.append(f"LESSON SO FAR:\n{transcript}")
    if student_message:
        parts.append(f'THE STUDENT JUST SAID: "{student_message}"')
    else:
        parts.append("Start the lesson now: greet the student in one short spoken line, then begin teaching the requested topic.")
    if context:
        parts.append(f"MATERIAL from the student's documents:\n{context[:8000]}")
    if directive:
        parts.append(directive)
    user_prompt = "\n\n".join(parts)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
    ]

    yielded_any = False
    stream = None
    completed = False
    saw_visuals: set[str] = set()
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.6,
            stream=True,
        )
        # Buffer raw deltas and yield one parsed block per completed NDJSON
        # line. After the "end" marker we keep draining (without yielding) so
        # the HTTP stream is always fully consumed — abandoning it mid-flight
        # leaves a suspended generator that httpcore2 fails to aclose().
        buffer = ""
        saw_end = False
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if not delta:
                continue
            buffer += delta
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                block = _parse_block_line(line)
                if block is None:
                    continue
                if block.get("kind") == "end":
                    saw_end = True
                    continue
                if saw_end:
                    continue
                if block.get("kind") in ("table", "diagram"):
                    saw_visuals.add(block["kind"])
                yielded_any = True
                yield block
        completed = True
        if not saw_end:
            block = _parse_block_line(buffer)
            if block is not None and block.get("kind") != "end":
                if block.get("kind") in ("table", "diagram"):
                    saw_visuals.add(block["kind"])
                yield block
        if directive_kind and directive_kind not in saw_visuals:
            if not any(b.get("kind") == directive_kind for b in history):
                vb = await _generate_visual_block(directive, subject, lang, model)
                if vb:
                    yield vb
    except Exception:
        if yielded_any:
            # Stream died mid-turn: keep the blocks already written and stop.
            return
        # Fallback: non-streaming call (endpoint may not support SSE streaming)
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.6,
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
        for line in raw.splitlines():
            block = _parse_block_line(line)
            if block is None:
                continue
            if block.get("kind") == "end":
                continue
            if block.get("kind") in ("table", "diagram"):
                saw_visuals.add(block["kind"])
            yield block
        if directive_kind and directive_kind not in saw_visuals:
            if not any(b.get("kind") == directive_kind for b in history):
                vb = await _generate_visual_block(directive, subject, lang, model)
                if vb:
                    yield vb
    finally:
        if stream is not None and not completed:
            try:
                await stream.close()
            except Exception:
                pass


async def generate_summary(
    context: str,
    lang: str = "en",
    model: str | None = None,
) -> str:
    """Generate a concise lesson summary from source chunks."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = LLM_SYSTEM.get(lang, LLM_SYSTEM["en"])
    prompt = f"""{system}

Write a concise, student-friendly summary of the material below:
- 5-8 bullet points covering the core ideas.
- 2-3 "key takeaways" lines.
- Use plain text, no JSON.

Material:
{context[:12000]}
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )
    return (response.choices[0].message.content or "").strip()


DIAGNOSTIC_SYSTEM = {
    "kz": "Сен қазақстандық оқушыға арналған диагностикалық тест құрастырушысың. Барлық сұрақтарды қазақ тілінде жаз.",
    "ru": "Ты — составитель диагностического теста для казахстанского школьника. Все вопросы пиши на русском.",
    "en": "You are a diagnostic test writer for a Kazakhstani school student. Write all questions in English.",
}

GOAL_NAMES = {
    "ent": {"kz": "ЕНТ", "ru": "ЕНТ", "en": "UNT"},
    "olympiad": {"kz": "Олимпиада", "ru": "Олимпиада", "en": "Olympiad"},
    "school": {"kz": "Мектеп бағдарламасы", "ru": "Школьная программа", "en": "School program"},
}


async def generate_diagnostic_test(
    subject: str,
    grade: int,
    goal: str = "school",
    lang: str = "kz",
    model: str | None = None,
) -> list[dict[str, Any]]:
    """Generate a diagnostic test of ~15 MCQs covering the main curriculum
    topics. The result is cached on disk per (subject, grade, goal, lang) so
    repeated calls are instant and we don't re-pay the slow LLM latency.

    Generation: first enumerate the main topics, then write one question per
    topic in small parallel batches (the model's output is capped, so large
    single JSON responses get truncated mid-array).
    """
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = DIAGNOSTIC_SYSTEM.get(lang, DIAGNOSTIC_SYSTEM["en"])
    goal_name = GOAL_NAMES.get(goal, GOAL_NAMES["school"]).get(lang, "School program")

    # Disk cache key: one shared diagnostic per subject/grade/goal/lang.
    key = hashlib.sha1(f"{subject}|{grade}|{goal}|{lang}".encode()).hexdigest()
    cache_dir = Path(__file__).resolve().parent.parent / "data"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"diag_{key}.json"
    if cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            if isinstance(cached, list) and cached:
                return cached
        except (json.JSONDecodeError, OSError):
            pass

    # Call 1: main curriculum topics of the subject for this grade.
    topics_prompt = f"""{system}

List the MAIN TOPICS of the "{subject}" curriculum for grade {grade} (Kazakhstan schools).
Output ONLY valid JSON, no markdown fences: an array of 12 to 15 topic names (strings), one per element.
Each topic must be a distinct curriculum block. Language: {lang.upper()}
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": topics_prompt},
        ],
        temperature=0.5,
        max_tokens=2048,
    )
    raw = (response.choices[0].message.content or "[]").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        topics = json.loads(raw)
    except json.JSONDecodeError:
        topics = []
    if not isinstance(topics, list):
        topics = []
    topics = [str(t) for t in topics if str(t).strip()][:15]
    if len(topics) < 6:
        topics = [subject]

    # Call 2: one question per topic, run in parallel small batches so the
    # JSON never gets truncated mid-array by the model's output limit, and so
    # total wall-time stays low.
    BATCH = 5
    batches = [topics[i : i + BATCH] for i in range(0, len(topics), BATCH)]

    async def gen_batch(batch: list[str]) -> list[dict[str, Any]]:
        if not batch:
            return []
        questions_prompt = f"""{system}

Write a diagnostic test for grade {grade} in the subject "{subject}" (goal: {goal_name}).
Cover EVERY topic below with exactly 1 question each ({len(batch)} questions total).
Output ONLY valid JSON, no markdown fences, no extra text: an array of objects:
[{{"q": "question text", "options": ["A", "B", "C", "D"], "answer": 0, "explain": "one-line explanation of the correct option", "topic": "the topic this question belongs to"}}]
- "answer" is the 0-based index of the correct option.
- Keep questions and options SHORT (a school student must read them fast).
- Questions must be answerable from school knowledge alone; vary difficulty (easy, medium, hard).

CURRICULUM TOPICS TO COVER:
{chr(10).join(f"- {t}" for t in batch)}

Language: {lang.upper()}
"""
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": questions_prompt},
            ],
            temperature=0.7,
            max_tokens=8192,
        )
        raw = (response.choices[0].message.content or "[]").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
        try:
            questions = json.loads(raw)
        except json.JSONDecodeError:
            questions = []
        return questions if isinstance(questions, list) else []

    batch_results = await asyncio.gather(*[gen_batch(b) for b in batches])

    cleaned: list[dict[str, Any]] = []
    seen: set[str] = set()
    for questions in batch_results:
        for item in questions:
            if not isinstance(item, dict) or not item.get("q") or not isinstance(item.get("options"), list):
                continue
            options = [str(o) for o in item["options"][:4]]
            if len(options) < 2:
                continue
            q_text = str(item["q"])
            if q_text in seen:
                continue
            seen.add(q_text)
            cleaned.append(
                {
                    "q": q_text,
                    "options": options,
                    "answer": int(item.get("answer", 0)) % len(options),
                    "explain": str(item.get("explain", "") or ""),
                    "topic": str(item.get("topic", "") or ""),
                }
            )
            if len(cleaned) >= 15:
                break
        if len(cleaned) >= 15:
            break

    if cleaned:
        try:
            cache_file.write_text(json.dumps(cleaned, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass
    return cleaned[:15]


async def evaluate_diagnostic(
    subject: str,
    grade: int,
    goal: str,
    lang: str,
    correct: int,
    total: int,
    weak_topics_hint: str,
    model: str | None = None,
) -> dict[str, Any]:
    """Produce a level, feedback and personal recommendation from test results."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = LLM_SYSTEM.get(lang, LLM_SYSTEM["en"])
    goal_name = GOAL_NAMES.get(goal, GOAL_NAMES["school"]).get(lang, "School program")
    score_pct = int(correct / total * 100) if total else 0
    prompt = f"""{system}

A grade {grade} student got {correct}/{total} ({score_pct}%) on a diagnostic test in "{subject}" (goal: {goal_name}).
The student's wrong questions were about: {weak_topics_hint or "general knowledge"}.
Output ONLY valid JSON, no markdown fences:
{{
  "level": "beginner|intermediate|advanced",
  "feedback": "2-3 encouraging sentences for the student",
  "weak_topics": ["topic 1", "topic 2"],
  "recommendation": "one concrete next-step sentence (what to study first)"
}}
Language: {lang.upper()}
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )
    raw = (response.choices[0].message.content or "{}").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {}
    return {
        "level": result.get("level") if result.get("level") in ("beginner", "intermediate", "advanced") else "intermediate",
        "feedback": str(result.get("feedback", "") or ""),
        "weak_topics": [str(t) for t in result.get("weak_topics", [])][:5] if isinstance(result.get("weak_topics"), list) else [],
        "recommendation": str(result.get("recommendation", "") or ""),
    }


async def generate_roadmap(
    topic: str,
    goal: str = "school",
    lang: str = "kz",
    level: str = "intermediate",
    weak_topics: list[str] | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Generate a full goal-driven study roadmap.

    Returns a dict with ``stages`` (6-10 weekly stages that build toward the
    goal), ``total_weeks`` and a computed ``deadline``. Weak topics from a
    diagnostic are scheduled first.
    """
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    lang_name = LESSON_LANG_NAMES.get(lang, "English")
    goal_name = GOAL_NAMES.get(goal, GOAL_NAMES["school"]).get(lang, "School program")
    weak_part = ""
    if weak_topics:
        weak_part = "\nThe student scored weak on these topics — cover them FIRST, before anything else:\n- " + "\n- ".join(weak_topics[:6])
    system = f"""You are a study roadmap planner for a Kazakhstani student in grade 7-12.
The student's goal: {goal_name}. Student's current level: {level}.{weak_part}

Build a COMPLETE preparation plan that really leads to the goal, not a generic list:
- Output ONLY valid JSON, no markdown fences, in this exact shape:
{{
  "stages": [
    {{
      "title": "Stage heading (2-6 words)",
      "topics": ["topic 1", "topic 2", "topic 3"],
      "material": "What materials and theory to study this week (1-2 sentences)",
      "check": "A concrete check for this week: a self-test / task / skill to demonstrate (1 sentence)",
      "duration": "7 days"
    }}
  ]
}}
- 7 to 9 stages total (7-9 weeks). Stages build on each other: foundations first, then core theory, then practice, then exam-format work, and a FINAL stage that is a full mock check in the format of the goal (mock test / olympiad set / exam).
- Every stage must list 3-5 concrete topics. "material" and "check" must be specific to the subject and goal, not generic advice.
- Write everything ONLY in {lang_name}."""
    user = f'The student wants to master: "{topic}" for {goal_name}.'
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.5,
    )
    raw = (response.choices[0].message.content or "{}").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    stages_raw = data.get("stages") if isinstance(data, dict) else None
    if not isinstance(stages_raw, list):
        return {"stages": [], "total_weeks": 0, "deadline": None}
    stages: list[dict[str, Any]] = []
    for item in stages_raw[:9]:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        stages.append(
            {
                "title": str(item["title"]),
                "topics": [str(t) for t in item.get("topics", []) if str(t).strip()][:5],
                "material": str(item.get("material", "") or ""),
                "check": str(item.get("check", "") or ""),
                "duration": str(item.get("duration", "7 days") or "7 days"),
            }
        )
    if not stages:
        return {"stages": [], "total_weeks": 0, "deadline": None}
    total_weeks = len(stages)
    return {"stages": stages, "total_weeks": total_weeks, "deadline": None}
