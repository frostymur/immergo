import json
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings

_client: AsyncOpenAI | None = None


def get_llm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # Prefer Alem endpoint if ALEM_LLM_API_KEY is present, otherwise OpenAI-compatible settings
        api_key = settings.ALEM_LLM_API_KEY or settings.OPENAI_API_KEY
        base_url = settings.ALEM_LLM_BASE_URL or settings.OPENAI_API_BASE
        _client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _client


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
    model: str = "alemllm",
) -> list[dict[str, str]]:
    """Generate a two-speaker JSON dialogue from source material."""
    client = get_llm_client()
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
    model: str = "alemllm",
) -> dict[str, Any]:
    """Generate a Socratic tutor response with one guiding question and a whiteboard card."""
    client = get_llm_client()
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
    model: str = "alemllm",
) -> dict[str, Any]:
    """Evaluate a student's answer to a Socratic guiding question."""
    client = get_llm_client()
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
- "card": the next whiteboard step (same schema as before: type in "question"|"hint"|"example"|"formula"|"diagram", content, expected_actions, optional diagram). If correct, make it a short follow-up "question" deepening understanding.

Output only valid JSON. Language: {lang.upper()}.
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


async def generate_summary(
    context: str,
    lang: str = "en",
    model: str = "alemllm",
) -> str:
    """Generate a concise lesson summary from source chunks."""
    client = get_llm_client()
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
