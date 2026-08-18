from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Direct Postgres connection (service role bypasses RLS)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

    # Supabase project (required for Storage and Auth metadata)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # LLM provider (OpenAI-compatible Alem endpoint)
    OPENAI_API_KEY: str = ""
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    ALEM_LLM_API_KEY: str = ""
    ALEM_LLM_BASE_URL: str = "https://llm.alem.ai/v1"

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
