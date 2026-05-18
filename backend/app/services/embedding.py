"""Embedding service using sentence-transformers."""

import numpy as np
import structlog
from sentence_transformers import SentenceTransformer

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Module-level model loading (loaded once, reused)
_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    """Lazy-load the embedding model (expensive, load once)."""
    global _model
    if _model is None:
        logger.info("loading_embedding_model", model=settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info(
            "embedding_model_loaded",
            model=settings.embedding_model,
            dimension=_model.get_sentence_embedding_dimension(),
        )
    return _model


class EmbeddingService:
    """Generate embeddings for text using sentence-transformers."""

    def __init__(self):
        self.model = get_embedding_model()
        self.dimension = self.model.get_sentence_embedding_dimension()

    def embed_texts(self, texts: list[str]) -> list[np.ndarray]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        embeddings = self.model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return [emb for emb in embeddings]

    def embed_query(self, query: str) -> np.ndarray:
        """Generate embedding for a single query."""
        embedding = self.model.encode(
            query,
            normalize_embeddings=True,
        )
        return embedding

    def get_dimension(self) -> int:
        """Return the embedding dimension."""
        return self.dimension
