from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Direct Postgres connection (service role bypasses RLS)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

    # Supabase project (required for Storage and Auth metadata)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # LLM provider — Kazakh lessons (alemllm)
    ALEM_LLM_API_KEY: str = ""
    ALEM_LLM_BASE_URL: str = "https://llm.alem.ai/v1"
    KZ_MODEL: str = "alemllm"

    # LLM provider — Russian / English lessons (qwen3-8)
    QWEN_API_KEY: str = ""
    QWEN_API_BASE: str = "https://llm.alem.ai/v1"
    QWEN_MODEL: str = "qwen3-8"

    # Embeddings (separate Alem key with access to the "text-1024" embedder)
    ALEM_EMBED_API_KEY: str = ""
    ALEM_EMBED_BASE_URL: str = "https://llm.alem.ai/v1"
    EMBED_MODEL: str = "text-1024"
    EMBED_DIM: int = 1024

    # Observability
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"

    # TTS / Audio
    TTS_CHUNK_SIZE: int = 1000

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
