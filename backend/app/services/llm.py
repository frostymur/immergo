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


_lesson_clients: dict[str, AsyncOpenAI] = {}


def get_lesson_llm_client(lang: str = "en") -> AsyncOpenAI:
    """Client for live lesson turns only. Uses the dedicated LESSON_LLM_*
    endpoint when LESSON_LLM_MODEL is set, otherwise the per-language default.
    Planning / diagnostics / roadmap keep using get_llm_client()."""
    if not settings.LESSON_LLM_MODEL:
        return get_llm_client(lang)
    group = f"lesson:{lang}"
    if group not in _lesson_clients:
        api_key = settings.LESSON_LLM_API_KEY or settings.QWEN_API_KEY
        base_url = settings.LESSON_LLM_BASE_URL or settings.QWEN_API_BASE
        _lesson_clients[group] = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _lesson_clients[group]


def get_lesson_llm_model(lang: str = "en") -> str:
    return settings.LESSON_LLM_MODEL or get_llm_model(lang)


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
You teach by WRITING rich notes on the whiteboard and SPEAKING a natural spoken explanation for each note (read aloud via TTS). The student watches the board and can answer or ask questions at any time.

OUTPUT FORMAT — one JSON object per line (NDJSON). No markdown fences, no commentary, nothing outside the JSON lines. Each line is one whiteboard block:
{"kind":"section","title":"...","speak":"..."}                       big topic heading (use once, at the start of a new topic)
{"kind":"subsection","title":"...","speak":"..."}                    sub-topic heading
{"kind":"note","text":"...","speak":"..."}                           short written note — MUST be 1-2 brief sentences max. Avoid large blocks of text.
{"kind":"formula","text":"$3x + 5 = 17$","speak":"..."}              formula/equation as LaTeX inside $...$
{"kind":"bullets","items":["...","..."],"speak":"..."}               3-5 short bullet points, each a complete factual statement
{"kind":"steps","items":["...","..."],"speak":"..."}                 numbered worked steps — include 3-5 steps minimum
{"kind":"table","columns":["Col A","Col B"],"rows":[["a1","b1"],["a2","b2"]],"speak":"..."}   comparison/list table (max 5 columns, 6 rows)
{"kind":"diagram","nodes":[{"id":"n1","label":"Start","shape":"start"},{"id":"n2","label":"x > 0?","shape":"decision"},{"id":"n3","label":"End","shape":"end"}],"edges":[["n1","n2"],["n2","n3","yes"],["n2","n4","no"]],"speak":"..."}   flowchart/branching diagram (max 8 nodes; shape: start|end|decision; short labels; optional edge labels)
{"kind":"svg","content":"<svg viewBox='0 0 200 200'>...</svg>","speak":"..."}      raw SVG graphic — use for math functions, geometry, physics vectors, plots
{"kind":"task","text":"...","speak":"..."}                           a task/question the STUDENT must solve
{"kind":"feedback","text":"...","correct":true,"speak":"..."}        evaluation of the student's answer ("correct": true/false)
{"kind":"choice","title":"What's next?","options":["Practice more","Go deeper","Move on"],"speak":"..."}   offer the student a choice of next direction (then "end" and wait for their pick)
{"kind":"plan_update","steps":[{"title":"...","detail":"..."}]}   (optional, only at the very start of a turn) new steps starting from the CURRENT one through the end
{"kind":"end"}                                                       end of your turn — ALWAYS the last line

VISUAL EXAMPLES — copy these exact JSON shapes when showing a process/flow (diagram) or a comparison (table) or math graphic (svg):
{"kind":"diagram","nodes":[{"id":"n1","label":"Start","shape":"start"},{"id":"n2","label":"Net force?","shape":"decision"},{"id":"n3","label":"No change","shape":"end"},{"id":"n4","label":"Accelerates","shape":"end"}],"edges":[["n1","n2"],["n2","n3","yes"],["n2","n4","no"]],"speak":"Balanced forces mean no change; an unbalanced net force accelerates the object."}
{"kind":"table","columns":["Solid","Liquid","Gas"],"rows":[["fixed shape","takes container shape","fills container"],["fixed volume","fixed volume","fills volume"]],"speak":"Here is how the three states of matter compare."}
{"kind":"svg","content":"<svg viewBox='0 0 200 200'><line x1='10' y1='190' x2='190' y2='190' stroke='black'/><line x1='10' y1='10' x2='10' y2='190' stroke='black'/><path d='M10,190 Q100,10 190,10' fill='none' stroke='blue'/></svg>","speak":"This curve represents an accelerating trend."}

EXAMPLE — the end of a turn that finishes a step and offers a branch:
{"kind":"feedback","text":"Exactly — acceleration halves.","correct":true,"speak":"Exactly right. If the mass doubles, the acceleration halves."}
{"kind":"choice","title":"What's next?","options":["Practice one more","Go deeper into F = ma","Move to the next topic"],"speak":"Where would you like to go next?"}
{"kind":"end"}

RULES:
- CLEAR & STRUCTURED TEXT: Use "bullets", "steps", "table", or "diagram" for most explanations. When using "note", keep it to 1-2 brief sentences. NEVER write large, unstructured walls of text. "speak" is natural spoken language (2-4 sentences) that ADDS context beyond what is written — never just reads it verbatim.
- BOLD FOR EMPHASIS: use **bold** markdown in "text", "items", and bullet strings to highlight key terms, definitions, and important words. Example: "**Newton's First Law** states that an object at rest stays at rest." Do NOT use bold in "speak" — TTS cannot render it.
- MATH NOTATION: write all formulas and math expressions in LaTeX inside $...$ (e.g. $v = s/t$, $3x + 5 = 17$, $S = 5t^2$). The board renders $...$ as real math. In "speak" fields NEVER use LaTeX — speak the math in plain words.
- VISUALS ARE MANDATORY EVERY TURN: every turn that introduces new content MUST include at least one "table", "diagram", OR "svg" block. Use "table" for comparisons, lists, properties, pros/cons; use "diagram" for processes, flows, cycles, algorithms, cause-effect chains, decision trees; use "svg" for math functions, geometry, physics vectors, or exact charts. Keep diagram labels short and node ids unique. For SVG, stick to standard viewBox sizes like 0 0 200 200.
- Teach one sub-topic per turn: explanation blocks (section/subsection/note/formula/bullets/steps) → ONE visual (table/diagram) → ONE "task" block → "end". Never answer your own task.
- LESSON ARC: when introducing a NEW technique, never open with a bare formula or a bare task. The order is: (1) motivation — 1-2 short notes on what problem this technique solves (a relatable hook); (2) the core idea in words ("bullets"); (3) the formula; (4) one fully worked example from scratch ("steps"); (5) only then the first task, analogous to the example.
- SELF-CONTAINED TASKS: every task must stand on its own — never reference an integral, setup, or example that the student has not seen written on the board in this lesson.
- VISUALS COMPLEMENT, NEVER REPLACE: a diagram or flowchart is not an explanation by itself — the same turn must also explain the idea in words (note/bullets).
- SOCRATIC METHOD: when the student answers a task, open with a "feedback" block. If the answer is wrong or incomplete NEVER reveal the solution — point at the gap and follow with a guiding "note"/"task". If correct ("correct": true), confirm briefly, then continue the lesson with the next sub-topic.
- CLARIFY FIRST: when the student says they are stuck or lost without specifics ("I don't get it", "I'm confused", "не понимаю"), do NOT launch into a lecture: ask ONE short targeted question that locates the gap (or a 10-second probe, e.g. "what do you think happens when..."), then explain exactly that gap. This also applies at the start of a lesson when the request is vague.
- RE-EXPLAIN ON DEMAND: when the student asks for a different angle (simpler, an analogy, a picture, another example), re-present the SAME material in exactly that form — never repeat the previous wording. Follow up with one small check question. Stay warm and encouraging; never make the student feel behind. This stays inside the current step — no plan_update.
- QUIZ MODE: when the student asks to be tested or quizzed, switch to quiz mode IMMEDIATELY (even if a task is still pending — the quiz replaces it): 3-5 short questions drawn ONLY from sub-topics already covered (no new content), one "task" or "choice" question per turn. After the final question, close the quiz with a "note" + "bullets" summary of what is solid and what is still shaky (judge from the feedback history of this lesson), then return to the regular lesson flow.
- TASK DIFFICULTY LADDER: never send the same kind of question twice in a row. Ladder steps: (1) recall from the notes just shown; (2) apply a rule/formula to a simple new case; (3) multi-step problem combining 2+ concepts; (4) exam-format problem (real context, timed wording); (5) tricky olympiad-style twist. Pick the step from "STUDENT TRACK" in the user message: after 2+ correct answers in a row go UP one step; after a wrong answer go DOWN one step and add scaffolding (a hint, or a fully-worked similar example as "steps") before re-asking.
- PRACTICE TURNS: a turn right after an explanation may add NO new content: a fully-worked example ("steps") and then ONE task at the current ladder step. Multi-part tasks ("a) ... b) ... c) ...") are allowed inside a single "task" block.
- FAIR GRADING: for multi-step tasks grade the METHOD, not just the final number. Correct method + arithmetic slip → correct:true, point out the slip. Right final answer but no reasoning shown → correct:false, ask for the work. A partially-correct multi-part answer → correct:false with part-by-part feedback.
- ADAPTIVE: the lesson plan is a guide, not a contract. Stay in the current step while the student struggles (extra notes/tasks) and only advance once it is learned; every advance opens a new "section". If the lesson takes an unexpected turn (student confused, wants more depth, topic changes), revise the plan with a "plan_update" block at the start of a turn — list the steps starting with the CURRENT one (re-worded if needed) through the end; the system keeps done steps and replaces the current-and-future part. Do NOT use plan_update for a plain re-explanation or quiz request.
- CHOICE: when a step is COMPLETE (usually right after the student solved a task correctly), END your turn with a "choice" block so the student picks the next direction, then "end" and wait. If the student is still wrong or incomplete, keep teaching in the current step instead — do not offer a choice yet.
- When the student asks a question, answer it with note/formula/steps/table/diagram blocks, then continue the lesson.
- At most 8 blocks per turn (excluding "end").
- Write and speak ONLY in {lang_name}.
- When MATERIAL from the student's own documents is provided, ground the lesson in it — quote specific facts and examples from the material.
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

_SVG_WORDS = (
    "graph", "plot", "math", "geometry", "function", "curve", "chart",
    "vector", "physics", "axis", "coordinates", "график", "геометрия",
    "функция", "ось", "сызық", "график", "вектор"
)


def _has_word(text: str, word: str) -> bool:
    if " " in word:
        return word in text
    return re.search(rf"\b{re.escape(word)}\b", text) is not None


def _visual_directive(topic: str, current_step: int, plan: list[dict[str, str]]) -> str:
    """Return a directive telling the model to write a visual block.

    Looks at the lesson topic (first turn only) plus the current and next plan
    step. Comparison-ish wording -> "table"; process/flow wording -> "diagram".
    Always returns a directive (never empty) so visuals are mandatory every turn.
    """
    candidates: list[str] = []
    if current_step < 0 and topic:
        candidates.append(topic)
    for i in (current_step, current_step + 1):
        if 0 <= i < len(plan):
            s = plan[i]
            candidates.append(f"{s.get('title', '')} {s.get('detail', '')}")
    text = " ".join(candidates).lower()
    
    for word in _SVG_WORDS:
        if _has_word(text, word):
            return ('VISUAL DIRECTIVE: this step/lesson involves math, geometry, plotting, or '
                    'spatial relationships — your output MUST include an "svg" block in this turn, '
                    'in the form: {"kind":"svg","content":"<svg viewBox=\'0 0 200 200\'>...</svg>","speak":"..."} '
                    '(use standard SVG tags like <circle>, <rect>, <path>, <line>). Do NOT output '
                    'a "table" or "diagram" block if a visual geometric representation is better.')
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
    # Unconditional fallback: still mandate a visual even when no keyword matched.
    # Prefer a diagram for the first turn (most topics have some kind of structure/flow);
    # use a table for later steps so the lesson alternates visual types.
    if current_step <= 0:
        return ('VISUAL DIRECTIVE: your output MUST include a "diagram" block that shows the '
                'key concepts or structure of this topic as a flowchart or concept map. '
                'Form: {"kind":"diagram","nodes":[{"id":"n1","label":"...","shape":"start"},{"id":"n2","label":"..."},...],"edges":[["n1","n2"],...],"speak":"..."} '
                '(max 8 nodes, short labels, unique ids). This is REQUIRED — do not skip it.')
    return ('VISUAL DIRECTIVE: your output MUST include a "table" block that organises the '
            'key information of this step into rows and columns (e.g. properties, examples, '
            'comparisons, or a summary). '
            'Form: {"kind":"table","columns":["Property","Value"],"rows":[["...","..."],["...","..."]],"speak":"..."} '
            '(min 2 rows, max 5 columns). This is REQUIRED — do not skip it.')


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


def merge_plan_update(
    plan: list[dict[str, str]],
    base_step: int,
    new_steps: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Merge a plan_update into the stored plan.

    Done steps (index < base_step) are always kept. The model usually re-lists
    the CURRENT step as the first "remaining" step (it is not done yet); detect
    that via the title and replace current+future instead of duplicating the
    current step.
    """

    def _norm(s: str) -> str:
        allowed = set("abcdefghijklmnopqrstuvwxyz0123456789а-яёіұңғқһөәү-")
        return "".join(ch for ch in s.lower() if ch in allowed)

    head = list(plan[: base_step + 1])
    if plan and new_steps and 0 <= base_step < len(plan) and head:
        cur = _norm(str(plan[base_step].get("title", "")))
        nxt = _norm(str(new_steps[0].get("title", "")))
        if cur and nxt and (cur in nxt or nxt in cur):
            head = list(plan[:base_step])
    return head + new_steps


_TEX_CMD = re.compile(r"\\[a-zA-Z]{2,}")
_MATH_CHARS = re.compile(r"[A-Za-z0-9.,;'^_{}=+\-*/\\()\s%]")


def balance_math(text: str, whole_block: bool = False) -> str:
    """Repair unbalanced $...$ delimiters the model sometimes drops so raw
    LaTeX (\\text, \\cdot, ...) never leaks onto the board.

    Cases handled: no delimiters at all (wrap the LaTeX span; if whole_block,
    wrap plain text too — formula blocks), a missing opening $ (span runs to
    the end / trailing $), a missing closing $ (a $ with a command after it).
    """
    if not text:
        return text
    s = text.strip()
    if not s:
        return text
    n = s.count("$")
    if n > 0 and n % 2 == 0:
        return text
    def _span_start(pos: int) -> int:
        start = pos
        while start > 0 and _MATH_CHARS.match(s[start - 1]):
            start -= 1
        # Do not let a plain-text space join the span across a word boundary
        while start < len(s) and s[start] == " ":
            start += 1
        return start

    cmd = _TEX_CMD.search(s)
    if n == 0:
        if not cmd:
            return f"${s}$" if whole_block else text
        start = _span_start(cmd.start())
        return s[:start] + "$" + s[start:] + "$"
    last = s.rfind("$")
    if _TEX_CMD.search(s, last + 1):
        return f"{s}$"
    if cmd:
        return s[: _span_start(cmd.start())] + "$" + s[_span_start(cmd.start()):]
    return text


def _sanitize_block_math(block: dict[str, Any]) -> None:
    kind = block.get("kind")
    for field in ("text", "title"):
        if isinstance(block.get(field), str):
            block[field] = balance_math(block[field], whole_block=(kind == "formula"))
    for field in ("items", "options"):
        if isinstance(block.get(field), list):
            block[field] = [balance_math(it) if isinstance(it, str) else it for it in block[field]]


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
    _sanitize_block_math(block)
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


def difficulty_track(history: list[dict[str, Any]], level: str) -> dict[str, Any]:
    """Running mastery stats from feedback blocks + the current ladder step.

    Base step by level (beginner=1, intermediate=2, advanced=3); +2 for a streak
    of 3+ correct, +1 for a streak of 2, -1 when the latest feedback was wrong;
    clamped to 1..5.
    """
    base = {"beginner": 1, "intermediate": 2, "advanced": 3}.get(level, 2)
    feedbacks = [
        b for b in history
        if b.get("kind") == "feedback" and isinstance(b.get("correct"), bool)
    ]
    correct = sum(1 for b in feedbacks if b["correct"])
    wrong = len(feedbacks) - correct
    streak = 0
    for b in reversed(feedbacks):
        if b["correct"]:
            streak += 1
        else:
            break
    if feedbacks and not feedbacks[-1]["correct"]:
        offset, direction = -1, "one below base (latest answer wrong — scaffold and simplify)"
    elif streak >= 3:
        offset, direction = 2, "two above base"
    elif streak >= 2:
        offset, direction = 1, "one above base"
    else:
        offset, direction = 0, "at base"
    step = max(1, min(5, base + offset))
    return {"correct": correct, "wrong": wrong, "streak": streak, "step": step, "direction": direction}


JUDGE_SYSTEM = (
    "You are a strict but fair grader for a student's answer to ONE task. "
    "A partial answer, a missing key step, or a wrong final result is NOT correct. "
    "If the student's message is a question, a request, or not an attempt to answer the task at all, "
    "set is_answer to false and correct to false. "
    "Respond with ONLY a JSON object, no other text:\n"
    '{{"is_answer": true|false, "correct": true|false, "reason": "one short sentence in {lang_name}"}}'
)


async def grade_answer(task_text: str, answer_text: str, lang: str = "en") -> dict[str, Any] | None:
    """Judge the student's answer to the pending task with a dedicated grader
    call on the per-language default model (deliberately different from the
    lesson teacher model). Returns None on any failure so the caller falls
    back to the teacher's own judgement."""
    lang_name = LESSON_LANG_NAMES.get(lang, "English")
    try:
        client = get_llm_client(lang)
        model = get_llm_model(lang)
        resp = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM.replace("{lang_name}", lang_name)},
                    {
                        "role": "user",
                        "content": f"TASK:\n{task_text[:1500]}\n\nSTUDENT ANSWER:\n{answer_text[:1500]}",
                    },
                ],
                temperature=0.1,
                max_tokens=200,
            ),
            timeout=20,
        )
        raw = (resp.choices[0].message.content or "").strip()
        data = json.loads(raw) if raw.startswith("{") else None
        if not isinstance(data, dict) or "correct" not in data:
            m = re.search(r'"correct"\s*:\s*(true|false)', raw)
            if not m:
                return None
            data = {"is_answer": True, "correct": m.group(1) == "true", "reason": ""}
        return {
            "is_answer": bool(data.get("is_answer", True)),
            "correct": bool(data["correct"]),
            "reason": str(data.get("reason", ""))[:300],
        }
    except Exception:
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
    verdict: dict[str, Any] | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """Stream one lesson turn from the LLM as parsed whiteboard blocks.

    The model emits NDJSON (one block per line); each block is yielded as soon
    as its line completes so the frontend can render/speak it immediately.
    Falls back to a non-streaming call if the endpoint rejects streaming.
    """
    client = get_lesson_llm_client(lang)
    model = model or get_lesson_llm_model(lang)
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
            "each time. You may revise the steps with a \"plan_update\" "
            "block at the start of a turn (list from the CURRENT step to the end).\n"
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
        parts.append("Start the lesson now: greet the student in one short spoken line. If the requested topic is specific, begin teaching it. If the request is vague or a complaint of not understanding something, follow CLARIFY FIRST: keep this first turn short (at most 2 small blocks) and end it with your locating question — do NOT lecture yet.")
    track = difficulty_track(history, level)
    if track["correct"] + track["wrong"] > 0:
        parts.append(
            f"STUDENT TRACK: {track['correct']} correct / {track['wrong']} wrong "
            f"(streak {track['streak']}) — current difficulty step {track['step']}/5 "
            f"({track['direction']}). Set your next TASK at this step."
        )
    if student_message and verdict:
        if verdict.get("is_answer") is False:
            parts.append(
                "The student's last message is NOT an answer to the pending task (it is a question or a request). "
                "Do NOT emit a \"feedback\" block for it — handle the message normally and keep the task pending."
            )
        else:
            verdict_word = "CORRECT" if verdict.get("correct") else "NOT CORRECT"
            reason = f" Grader's note: {verdict['reason']}." if verdict.get("reason") else ""
            parts.append(
                f"OFFICIAL VERDICT from the grader: the student's answer is {verdict_word}.{reason} "
                f'Your "feedback" block MUST use exactly this verdict '
                f'("correct": {str(bool(verdict.get("correct"))).lower()}); build your explanation on the grader\'s note.'
            )
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
            # Only serve complete tests; a truncated (e.g. 1-question) cache is a bug, not a feature.
            if isinstance(cached, list) and len(cached) >= 8:
                return cached
        except (json.JSONDecodeError, OSError):
            pass

    # Call 1: main curriculum topics of the subject for this grade.
    topics_prompt = f"""{system}

List the MAIN TOPICS of the "{subject}" curriculum for grade {grade} (Kazakhstan schools).
Output ONLY valid JSON, no markdown fences: an array of 12 to 15 topic names (strings), one per element.
Each topic must be a distinct curriculum block. Language: {lang.upper()}
"""
    def parse_json_array(raw: str) -> list:
        """Parse a JSON array from an LLM reply, tolerating fences/empty output."""
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            start, end = raw.find("["), raw.rfind("]")
            if start != -1 and end > start:
                try:
                    parsed = json.loads(raw[start : end + 1])
                    return parsed if isinstance(parsed, list) else []
                except json.JSONDecodeError:
                    return []
            return []

    # The thinking-mode model can consume the whole token budget on long
    # prompts and return empty content, so retry once with a bigger budget.
    topics: list[str] = []
    for budget in (4096, 8192):
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": topics_prompt},
            ],
            temperature=0.5,
            max_tokens=budget,
        )
        topics = [
            str(t)
            for t in parse_json_array(response.choices[0].message.content or "")
            if str(t).strip()
        ][:15]
        if len(topics) >= 6:
            break
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
        questions: list = []
        for budget in (8192, 16384):
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": questions_prompt},
                ],
                temperature=0.7,
                max_tokens=budget,
            )
            questions = parse_json_array(response.choices[0].message.content or "")
            if questions:
                break
        return questions

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
    grade: str = "",
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
    grade_part = f" in grade {grade}" if grade else ""
    system = f"""You are a study roadmap planner for a Kazakhstani student{grade_part or " in grade 7-12"}.
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
