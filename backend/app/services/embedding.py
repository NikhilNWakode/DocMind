"""Embedding service — uses HuggingFace Inference API in production, local model in development."""

import os
import time

import numpy as np
import structlog

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Use API-based embeddings in production (saves ~400MB RAM)
USE_API = settings.app_env == "production" or os.getenv("USE_EMBEDDING_API", "").lower() == "true"

_model = None
_hf_client = None


def get_embedding_model():
    """Lazy-load the local embedding model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("loading_embedding_model", model=settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("embedding_model_loaded", model=settings.embedding_model)
    return _model


def get_hf_client():
    """Lazy-load the HuggingFace InferenceClient."""
    global _hf_client
    if _hf_client is None:
        from huggingface_hub import InferenceClient
        hf_token = os.getenv("HF_TOKEN", "")
        if not hf_token:
            raise RuntimeError("HF_TOKEN environment variable is required for embeddings API")
        _hf_client = InferenceClient(token=hf_token)
        logger.info("hf_inference_client_created")
    return _hf_client


class EmbeddingService:
    """Generate embeddings using local model or HuggingFace Inference API."""

    def __init__(self):
        self.dimension = settings.embedding_dimension
        self._model_id = f"sentence-transformers/{settings.embedding_model}"

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
        """Use HuggingFace Inference API for embeddings via official client."""
        client = get_hf_client()
        all_embeddings = []

        # Process each text individually for reliability
        for text in texts:
            last_error = None

            for attempt in range(3):
                try:
                    result = client.feature_extraction(
                        text=text,
                        model=self._model_id,
                    )

                    # result shape: could be [384], [[384]], or [tokens x 384]
                    arr = np.array(result, dtype=np.float32)

                    # If 2D (token-level embeddings), mean pool to get sentence embedding
                    if arr.ndim == 2:
                        arr = arr.mean(axis=0)
                    elif arr.ndim == 3:
                        # [1, tokens, dim] -> mean pool
                        arr = arr[0].mean(axis=0)

                    # Normalize
                    norm = np.linalg.norm(arr)
                    if norm > 0:
                        arr = arr / norm

                    all_embeddings.append(arr)
                    last_error = None
                    break

                except Exception as e:
                    last_error = e
                    logger.warning(
                        "embedding_attempt_failed",
                        attempt=attempt + 1,
                        error=str(e)[:150],
                    )
                    if attempt < 2:
                        time.sleep(3 * (attempt + 1))
                        continue

            if last_error is not None:
                raise RuntimeError(f"Embedding failed after 3 attempts: {last_error}")

        return all_embeddings
