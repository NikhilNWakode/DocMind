"""Embedding service — uses HuggingFace API in production, local model in development."""

import os
import time

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
        self._api_url = f"https://router.huggingface.co/hf-inference/models/sentence-transformers/{settings.embedding_model}"

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
        """Use HuggingFace Inference API for embeddings."""
        hf_token = os.getenv("HF_TOKEN", "")
        if not hf_token:
            raise RuntimeError("HF_TOKEN environment variable is required for embeddings API")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {hf_token}",
        }

        all_embeddings = []
        for i in range(0, len(texts), 32):
            batch = texts[i:i + 32]
            last_error = None

            for attempt in range(3):
                try:
                    response = httpx.post(
                        self._api_url,
                        json={"inputs": batch, "options": {"wait_for_model": True}},
                        headers=headers,
                        timeout=120.0,
                    )
                    response.raise_for_status()
                    data = response.json()

                    for emb in data:
                        arr = np.array(emb, dtype=np.float32)
                        norm = np.linalg.norm(arr)
                        if norm > 0:
                            arr = arr / norm
                        all_embeddings.append(arr)

                    last_error = None
                    break

                except httpx.HTTPStatusError as e:
                    last_error = e
                    status = e.response.status_code
                    body = e.response.text[:200]
                    logger.warning(
                        "embedding_api_http_error",
                        attempt=attempt + 1,
                        status=status,
                        body=body,
                    )
                    # 503 = model loading, retry
                    if status in (503, 429):
                        time.sleep(3 * (attempt + 1))
                        continue
                    raise RuntimeError(f"Embedding API failed (HTTP {status}): {body}")

                except Exception as e:
                    last_error = e
                    logger.warning("embedding_api_error", attempt=attempt + 1, error=str(e)[:100])
                    if attempt < 2:
                        time.sleep(2 * (attempt + 1))
                        continue

            if last_error is not None:
                raise RuntimeError(f"Embedding API failed after 3 attempts: {last_error}")

        return all_embeddings
