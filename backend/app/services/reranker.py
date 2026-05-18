"""Cross-encoder reranking service for retrieval quality improvement."""

import structlog

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_reranker_model = None


def get_reranker_model():
    """Lazy-load the cross-encoder reranker model."""
    global _reranker_model
    if _reranker_model is None:
        try:
            from sentence_transformers import CrossEncoder
            logger.info("loading_reranker_model", model=settings.reranker_model)
            _reranker_model = CrossEncoder(settings.reranker_model, max_length=512)
            logger.info("reranker_model_loaded", model=settings.reranker_model)
        except ImportError:
            logger.warning("sentence_transformers_not_installed_reranker_disabled")
            return None
    return _reranker_model


class RerankerService:
    """Rerank retrieved chunks using a cross-encoder model."""

    def __init__(self):
        self.model = get_reranker_model()

    def rerank(
        self,
        query: str,
        chunks: list[dict],
        top_k: int | None = None,
    ) -> list[dict]:
        if not chunks:
            return []

        if top_k is None:
            top_k = len(chunks)

        # If model unavailable, return chunks as-is
        if self.model is None:
            return chunks[:top_k]

        pairs = [(query, chunk["content"]) for chunk in chunks]
        scores = self.model.predict(pairs)

        for chunk, score in zip(chunks, scores):
            chunk["rerank_score"] = float(score)

        reranked = sorted(chunks, key=lambda c: c["rerank_score"], reverse=True)

        logger.info(
            "chunks_reranked",
            input_count=len(chunks),
            output_count=min(top_k, len(reranked)),
            top_score=reranked[0]["rerank_score"] if reranked else 0,
        )

        return reranked[:top_k]
