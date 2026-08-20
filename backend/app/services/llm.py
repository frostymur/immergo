import json
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

LESSON_SYSTEM = """You are Lumi, a live AI tutor teaching a one-on-one lesson on a digital whiteboard.
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

EXAMPLE — the end of a turn that finishes a step and offers a branch:
{"kind":"feedback","text":"Exactly — acceleration halves.","correct":true,"speak":"Exactly right. If the mass doubles, the acceleration halves."}
{"kind":"choice","title":"What's next?","options":["Practice one more","Go deeper into F = ma","Move to the next topic"],"speak":"Where would you like to go next?"}
{"kind":"end"}

RULES:
- Written "text"/"items" are concise board notes, not essays. "speak" is natural spoken language (1-3 sentences) that explains the block — never just reads it verbatim. Blocks that need no voice (e.g. "end") omit "speak".
- Use "diagram" blocks for processes, flows and decision trees (branching); keep labels short and ids unique. Use "table" blocks for comparisons and listings. "speak" briefly explains the visual.
- Teach one sub-topic per turn: a few explanation blocks, then ONE "task" block, then "end" and wait for the student. Never answer your own task.
- SOCRATIC METHOD: when the student answers a task, open with a "feedback" block. If the answer is wrong or incomplete NEVER reveal the solution — point at the gap and follow with a guiding "note"/"task". If correct ("correct": true), confirm briefly, then continue the lesson with the next sub-topic.
- ADAPTIVE: the lesson plan is a guide, not a contract. Stay in the current step while the student struggles (extra notes/tasks) and only advance once it is learned; every advance opens a new "section". If the lesson takes an unexpected turn (student confused, wants more depth, topic changes), revise the REMAINING steps with a "plan_update" block at the start of a turn — the system keeps already-DONE steps, so only list what still lies ahead.
- CHOICE: when a step is COMPLETE (usually right after the student solved a task correctly), END your turn with a "choice" block so the student picks the next direction, then "end" and wait. If the student is still wrong or incomplete, keep teaching in the current step instead — do not offer a choice yet.
- When the student asks a question, answer it with note/formula/steps blocks, then continue the lesson.
- At most 8 blocks per turn (excluding "end").
- Write and speak ONLY in {lang_name}.
- When MATERIAL from the student's own documents is provided, ground the lesson in it.
"""


def serialize_lesson_history(blocks: list[dict[str, Any]], limit: int = 60) -> str:
    """Render stored lesson blocks into a compact transcript for the LLM."""
    lines: list[str] = []
    for b in blocks[-limit:]:
        kind = b.get("kind")
        if kind == "student":
            lines.append(f"STUDENT: {b.get('text', '')}")
        elif kind == "task":
            lines.append(f"LUMI (task for student): {b.get('text', '')}")
        elif kind == "feedback":
            verdict = "correct" if b.get("correct") else "not quite"
            lines.append(f"LUMI (feedback, {verdict}): {b.get('text', '')}")
        elif kind in ("section", "subsection"):
            lines.append(f"LUMI (heading): {b.get('title', '')}")
        elif kind in ("note", "formula"):
            lines.append(f"LUMI ({kind}): {b.get('text', '')}")
        elif kind in ("bullets", "steps"):
            lines.append(f"LUMI ({kind}): " + " | ".join(b.get("items", [])))
        elif kind == "table":
            lines.append(f"LUMI (table): columns={b.get('columns', [])} rows={b.get('rows', [])}")
        elif kind == "diagram":
            node_repr = "; ".join(f"{n.get('id')}={n.get('label')}" for n in b.get("nodes", []))
            edge_repr = "; ".join("->".join(map(str, e)) for e in b.get("edges", []))
            lines.append(f"LUMI (diagram): nodes[{node_repr}] edges[{edge_repr}]")
        elif kind == "choice":
            lines.append(f"LUMI (choice): {b.get('title', '')} options={b.get('options', [])}")
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


async def stream_lesson_turn(
    history: list[dict[str, Any]],
    context: str,
    lang: str = "en",
    student_message: str | None = None,
    topic: str | None = None,
    plan: list[dict[str, str]] | None = None,
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
    user_prompt = "\n\n".join(parts)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
    ]

    yielded_any = False
    stream = None
    completed = False
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
                yielded_any = True
                yield block
        completed = True
        if not saw_end:
            block = _parse_block_line(buffer)
            if block is not None and block.get("kind") != "end":
                yield block
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
                return
            yield block
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
    """Generate a 5-question diagnostic mini-test (MCQ, one correct answer)."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    system = DIAGNOSTIC_SYSTEM.get(lang, DIAGNOSTIC_SYSTEM["en"])
    goal_name = GOAL_NAMES.get(goal, GOAL_NAMES["school"]).get(lang, "School program")
    prompt = f"""{system}

Create a diagnostic test for grade {grade} in the subject "{subject}" aiming at {goal_name}.
Output ONLY valid JSON, no markdown fences: an array of exactly 5 objects:
[{{"q": "question text", "options": ["A", "B", "C", "D"], "answer": 0, "explain": "one-line explanation of the correct option"}}]
- "answer" is the 0-based index of the correct option.
- Questions must be answerable from school knowledge alone, with varied difficulty.
- Language: {lang.upper()}
"""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )
    raw = (response.choices[0].message.content or "[]").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        questions = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(questions, list):
        return []
    cleaned: list[dict[str, Any]] = []
    for item in questions:
        if not isinstance(item, dict) or not item.get("q") or not isinstance(item.get("options"), list):
            continue
        options = [str(o) for o in item["options"][:4]]
        if len(options) < 2:
            continue
        cleaned.append(
            {
                "q": str(item["q"]),
                "options": options,
                "answer": int(item.get("answer", 0)) % len(options),
                "explain": str(item.get("explain", "") or ""),
            }
        )
    return cleaned[:5]


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
    model: str | None = None,
) -> list[dict[str, str]]:
    """Generate a goal-aware step-by-step study roadmap (4-6 steps)."""
    client = get_llm_client(lang)
    model = model or get_llm_model(lang)
    lang_name = LESSON_LANG_NAMES.get(lang, "English")
    goal_name = GOAL_NAMES.get(goal, GOAL_NAMES["school"]).get(lang, "School program")
    system = f"""You are a study roadmap planner for a Kazakhstani student.
The student's goal: {goal_name}.
Output ONLY a JSON array of 4 to 6 objects, one per step, in the exact shape:
[{{"title": "Short heading (2-6 words)", "detail": "One line on what the student will learn or practice in this step", "duration": "estimate like '3 days' or '1 week'"}}]
- Steps build on each other and cover the whole requested topic.
- Write the plan ONLY in {lang_name}."""
    user = f'The student wants to master: "{topic}"'
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
        steps_raw = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(steps_raw, list):
        return []
    steps: list[dict[str, str]] = []
    for item in steps_raw:
        if isinstance(item, dict) and item.get("title"):
            steps.append(
                {
                    "title": str(item["title"]),
                    "detail": str(item.get("detail", "") or ""),
                    "duration": str(item.get("duration", "") or ""),
                }
            )
    return steps[:6]
