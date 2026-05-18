"""Embedding service — uses local sentence-transformers or HuggingFace API fallback."""

import os

import httpx
import numpy as np
import structlog

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Use API-based embeddings in production (saves ~400MB RAM)
USE_API = settings.app_env == "production" or os.getenv("USE_EMBEDDING_API", "").lower() == "true"

_model = None


def get_embedding_model():
    """Lazy-load the local embedding model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("loading_embedding_model", model=settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("embedding_model_loaded", model=settings.embedding_model)
    return _model


class EmbeddingService:
    """Generate embeddings using local model or HuggingFace API."""

    def __init__(self):
        self.dimension = settings.embedding_dimension
        self._api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{settings.embedding_model}"

    def embed_texts(self, texts: list[str]) -> list[np.ndarray]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        if USE_API:
            return self._embed_via_api(texts)

        model = get_embedding_model()
        embeddings = model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return [emb for emb in embeddings]

    def embed_query(self, query: str) -> np.ndarray:
        """Generate embedding for a single query."""
        if USE_API:
            results = self._embed_via_api([query])
            return results[0]

        model = get_embedding_model()
        return model.encode(query, normalize_embeddings=True)

    def get_dimension(self) -> int:
        return self.dimension

    def _embed_via_api(self, texts: list[str]) -> list[np.ndarray]:
        """Use HuggingFace Inference API for embeddings (free, no key needed)."""
        headers = {"Content-Type": "application/json"}
        hf_token = os.getenv("HF_TOKEN", "")
        if hf_token:
            headers["Authorization"] = f"Bearer {hf_token}"

        # HF API has payload limits, batch in chunks of 32
        all_embeddings = []
        for i in range(0, len(texts), 32):
            batch = texts[i:i + 32]
            try:
                response = httpx.post(
                    self._api_url,
                    json={"inputs": batch, "options": {"wait_for_model": True}},
                    headers=headers,
                    timeout=60.0,
                )
                response.raise_for_status()
                data = response.json()

                for emb in data:
                    arr = np.array(emb, dtype=np.float32)
                    # Normalize
                    norm = np.linalg.norm(arr)
                    if norm > 0:
                        arr = arr / norm
                    all_embeddings.append(arr)

            except Exception as e:
                logger.error("embedding_api_failed", error=str(e), batch_size=len(batch))
                raise RuntimeError(f"Embedding API failed: {e}")

        return all_embeddings
