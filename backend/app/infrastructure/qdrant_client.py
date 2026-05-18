"""Qdrant vector database client."""

from qdrant_client import QdrantClient

from app.config import get_settings

settings = get_settings()

qdrant_client = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key or None,
)


def get_qdrant() -> QdrantClient:
    """Dependency that provides a Qdrant client."""
    return qdrant_client
