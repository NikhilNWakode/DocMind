"""Application configuration using Pydantic Settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "DocMind"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://docmind:docmind_dev@localhost:5432/docmind"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection_prefix: str = "workspace"

    # Object Storage (MinIO/S3)
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minio"
    s3_secret_key: str = "minio123"
    s3_bucket: str = "docmind-documents"

    # JWT Auth
    jwt_secret_key: str = "super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # LLM Provider (Groq — free, OpenAI-compatible)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"

    # Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # RAG Settings
    chunk_size: int = 500
    chunk_overlap: int = 50
    retrieval_top_k: int = 5

    # Rate Limiting
    rate_limit_per_minute: int = 30
    rate_limit_chat_per_minute: int = 10

    # CORS
    cors_origins: str = '["http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from string (JSON array or comma-separated)."""
        import json
        value = self.cors_origins.strip()
        if not value:
            return ["http://localhost:3000"]
        if value.startswith("["):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return ["http://localhost:3000"]
        return [o.strip() for o in value.split(",")]

    # Upload
    max_upload_size_mb: int = 50
    allowed_file_types: list[str] = ["pdf", "docx", "txt", "png", "jpg", "jpeg"]

    # Conversation Memory
    max_conversation_turns: int = 6


@lru_cache
def get_settings() -> Settings:
    return Settings()
