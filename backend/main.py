import os
import tempfile
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from app.core.config import settings

app = FastAPI(title="AI Study Workspace - Neo-Gov Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str
    lang: str

class SocraticStepRequest(BaseModel):
    topic: str
    student_answer: str

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "system": "Neo-Gov Platform"}

@app.post("/api/tts")
async def generate_tts(request: TTSRequest):
    voice_map = {
        "kz": "kk-KZ-AigulNeural",
        "ru": "ru-RU-SvetlanaNeural",
        "en": "en-US-AriaNeural"
    }
    voice = voice_map.get(request.lang, "en-US-AriaNeural")
    
    # Using edge-tts CLI via subprocess for simplicity in generating the file
    fd, path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    
    # Construct and run edge-tts command
    cmd = ["edge-tts", "--voice", voice, "--text", request.text, "--write-media", path]
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    await process.communicate()
    
    return FileResponse(path, media_type="audio/mpeg", filename="output.mp3")

@app.post("/api/socratic/step")
async def socratic_step(request: SocraticStepRequest):
    return JSONResponse({
        "topic": request.topic,
        "feedback": f"Interesting point about '{request.student_answer}'. Can you elaborate?",
        "card": {
            "type": "question",
            "content": "Why do you think that happens in this context?",
            "expected_actions": ["elaborate", "provide_example"]
        }
    })
