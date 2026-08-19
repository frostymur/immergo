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


class LessonMessageRequest(BaseModel):
    text: str


class LessonStateResponse(BaseModel):
    session: dict[str, Any]
    plan: list[dict[str, str]] = []
    blocks: list[dict[str, Any]]


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    lang: str = Field(default="en", pattern="^(kz|ru|en)$")
