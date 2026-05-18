"""Qdrant vector database client with graceful error handling."""

import structlog
from qdrant_client import QdrantClient

from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

_qdrant_client: QdrantClient | None = None


def _create_client() -> QdrantClient:
    """Create Qdrant client with connection validation."""
    global _qdrant_client
    if _qdrant_client is not None:
        return _qdrant_client

    try:
        client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=10,
        )
        # Verify connection
        client.get_collections()
        logger.info("qdrant_connected", url=settings.qdrant_url[:50])
        _qdrant_client = client
        return client
    except Exception as e:
        logger.error("qdrant_connection_failed", url=settings.qdrant_url[:50], error=str(e)[:100])
        # Return a client anyway — operations will fail with clear errors
        _qdrant_client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=10,
        )
        return _qdrant_client


def get_qdrant() -> QdrantClient:
    """Dependency that provides a Qdrant client."""
    return _create_client()
