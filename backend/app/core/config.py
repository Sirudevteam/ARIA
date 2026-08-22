"""
Application configuration using Pydantic Settings.
Reads from environment variables / .env file.
"""

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "ARIA"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # ── Backend server ────────────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    BACKEND_RELOAD: bool = True

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+psycopg://lidar_user:lidar_password@localhost:5432/lidar_db"
    )

    # ── Supabase Auth / JWT ───────────────────────────────────────────────────
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your_supabase_anon_key"
    SUPABASE_SERVICE_ROLE_KEY: str = "your_service_role_key"
    # Default secret for local dev/testing if not set in environment
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    JWT_ALGORITHM: str = "HS256"
    # ── Embedding & Vector Search ─────────────────────────────────────────────
    EMBEDDING_PROVIDER: str = "bge_m3"  # "bge_m3", "openai", "mock"
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSIONS: int = 1024
    EMBEDDING_BATCH_SIZE: int = 32
    EMBEDDING_MAX_RETRIES: int = 3
    # ── Reranker & 2-Stage Retrieval ──────────────────────────────────────────
    RERANKER_PROVIDER: str = "bge_reranker"  # "bge_reranker", "cohere", "local"
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    RETRIEVAL_CANDIDATE_K: int = 20
    RETRIEVAL_FINAL_TOP_K: int = 5
    RERANKER_MIN_THRESHOLD: float = 0.25
    OPENAI_API_KEY: str | None = None
    HUGGINGFACE_API_KEY: str | None = None
    COHERE_API_KEY: str | None = None

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
