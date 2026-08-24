from typing import Any, Optional

from pydantic import BaseModel, Field


class UploadAndIndexRequest(BaseModel):
    workspace_id: str
    file_name: str


class UploadAndIndexResponse(BaseModel):
    source_id: str
    file_hash: str
    chunks_indexed: int
    status: str = "indexed"


class GeneratePodcastRequest(BaseModel):
    workspace_id: str
    source_id: str
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")


class GeneratePodcastResponse(BaseModel):
    artifact_id: str
    audio_url: str
    dialogue: list[dict[str, Any]]
    cached: bool = False


class SocraticChatRequest(BaseModel):
    workspace_id: str
    question: str
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")


class SocraticChatResponse(BaseModel):
    feedback: str
    card: dict[str, Any]
    sources: list[dict[str, Any]]


class SocraticAnswerRequest(BaseModel):
    workspace_id: str
    asked: str
    answer: str
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")


class SocraticAnswerResponse(BaseModel):
    correct: bool
    feedback: str
    card: dict[str, Any]


class SummaryRequest(BaseModel):
    workspace_id: str
    source_id: str
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")


class SummaryResponse(BaseModel):
    summary: str
    cached: bool = False


class HeatmapResponse(BaseModel):
    workspace_id: Optional[str] = None
    nodes: list[dict[str, Any]]


class LessonStartRequest(BaseModel):
    workspace_id: str
    prompt: str
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")
    level: str = Field(default="intermediate", pattern="^(beginner|intermediate|advanced)$")


class LessonMessageRequest(BaseModel):
    text: str


class LessonStateResponse(BaseModel):
    session: dict[str, Any]
    plan: list[dict[str, str]] = []
    blocks: list[dict[str, Any]]


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")
    voice: str | None = None


class DiagnosticStartRequest(BaseModel):
    grade: int = Field(ge=1, le=12)
    subject: str = Field(min_length=1, max_length=60)
    goal: str = Field(default="school", pattern="^(ent|olympiad|school)$")
    lang: str = Field(default="kz", pattern="^(kz|ru|en)$")


class DiagnosticStartResponse(BaseModel):
    questions: list[dict[str, Any]]


class DiagnosticEvaluateRequest(BaseModel):
    grade: int = Field(ge=1, le=12)
    subject: str = Field(min_length=1, max_length=60)
    goal: str = Field(default="school", pattern="^(ent|olympiad|school)$")
    lang: str = Field(default="kz", pattern="^(kz|ru|en)$")
    questions: list[dict[str, Any]]
    answers: list[int]


class DiagnosticEvaluateResponse(BaseModel):
    correct: int
    total: int
    level: str
    feedback: str
    weak_topics: list[str]
    recommendation: str


class RoadmapRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    goal: str = Field(default="school", pattern="^(ent|olympiad|school)$")
    lang: str = Field(default="kz", pattern="^(kz|ru|en)$")
    level: str = Field(default="intermediate", pattern="^(beginner|intermediate|advanced)$")
    weak_topics: list[str] = []
    grade: str = Field(default="", max_length=10)


class RoadmapResponse(BaseModel):
    topic: str
    goal: str
    level: str
    stages: list[dict[str, Any]]
    total_weeks: int = 0
    deadline: Optional[str] = None


class HighlightCreate(BaseModel):
    block_idx: int
    selected_text: str = Field(min_length=1, max_length=2000)
    color: str = Field(default="yellow", pattern="^(yellow|green|blue|pink)$")


class HighlightResponse(BaseModel):
    id: str
    session_id: str
    block_idx: int
    selected_text: str
    color: str
    created_at: str


class DiagnosticHistoryItem(BaseModel):
    subject: str
    correct: int
    total: int
    pct: Optional[int] = None
    level: Optional[str] = None
    created_at: str


class StudentReadiness(BaseModel):
    user_id: str
    email: Optional[str] = None
    subject: Optional[str] = None
    correct: Optional[int] = None
    total: Optional[int] = None
    pct: Optional[int] = None
    level: Optional[str] = None
    completed: int = 0
    failed: int = 0
    assignments_done: int = 0
    assignments_total: int = 0
    roadmap_done: int = 0
    roadmap_total: int = 0
    readiness_score: Optional[int] = None
    readiness: str
    diagnostics: list[DiagnosticHistoryItem] = []


class TopicMastery(BaseModel):
    topic: str
    students: int
    correct: int
    total: int
    pct: int


class ClassAnalyticsResponse(BaseModel):
    workspace_id: str
    subjects: list[str] = []
    students: list[StudentReadiness]
    topics: list[TopicMastery]
