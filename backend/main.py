import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.core.config import settings
from app.db.database import close_pool
from app.routers import ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(
    title="AI Study Workspace - AI Microservice",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "system": "AI Study Workspace",
        "llm_base": settings.OPENAI_API_BASE,
    }
