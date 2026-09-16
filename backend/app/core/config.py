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

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().strip("'\"")
            if v.startswith("${{"):
                raise ValueError(
                    f"DATABASE_URL contains an unexpanded Railway template reference: '{v}'. "
                    "Please copy and paste the actual PostgreSQL connection string from your Railway Postgres service's Connect tab."
                )
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    # ── Object Storage (Cloudflare R2 / S3 / Local) ───────────────────────────
    STORAGE_BACKEND: str = "r2"  # "r2", "local"
    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET_NAME: str = "aria-documents"
    R2_ENDPOINT_URL: str | None = None
    R2_PUBLIC_URL_PREFIX: str | None = None
    # ── Qdrant Vector Database & Hybrid Engine ───────────────────────────────
    VECTOR_DB_BACKEND: str = "qdrant"  # "qdrant", "pgvector", "memory"
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_URL: str | None = None
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION: str = "aria_chunks"
    QDRANT_PREFER_GRPC: bool = False
    QDRANT_TIMEOUT_SECONDS: float = 10.0

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
    RERANKER_MIN_THRESHOLD: float = 0.15  # V1: lower threshold ensures demo stability
    # ── LLM & DeepSeek Provider ───────────────────────────────────────────────
    DEEPSEEK_API_KEY: str | None = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    LLM_PROVIDER: str = "deepseek"  # "deepseek", "openai", "mock"
    LLM_MODEL: str = "deepseek-chat"  # "deepseek-chat" (DeepSeek-V3), "deepseek-reasoner" (R1)
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 4096
    LLM_TIMEOUT_SECONDS: int = 60
    LLM_MAX_RETRIES: int = 3
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
