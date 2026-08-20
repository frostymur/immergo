import os
import tempfile
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import close_pool
from app.routers import ai
from app.services.storage import LOCAL_STORAGE_ROOT


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
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)

# Serve local storage fallback files (PDFs, audio) when Supabase Storage is unreachable
os.makedirs(LOCAL_STORAGE_ROOT, exist_ok=True)
app.mount("/static", StaticFiles(directory=LOCAL_STORAGE_ROOT), name="static")


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "system": "AI Study Workspace",
        "llm_base": settings.QWEN_API_BASE,
    }
