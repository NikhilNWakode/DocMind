"""Cross-encoder reranking service for retrieval quality improvement."""

import structlog
from sentence_transformers import CrossEncoder

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Module-level model (loaded once)
_reranker_model: CrossEncoder | None = None


def get_reranker_model() -> CrossEncoder:
    """Lazy-load the cross-encoder reranker model."""
    global _reranker_model
    if _reranker_model is None:
        logger.info("loading_reranker_model", model=settings.reranker_model)
        _reranker_model = CrossEncoder(settings.reranker_model, max_length=512)
        logger.info("reranker_model_loaded", model=settings.reranker_model)
    return _reranker_model


class RerankerService:
    """Rerank retrieved chunks using a cross-encoder model.

    Cross-encoders jointly encode (query, document) pairs and produce
    a relevance score. This is more accurate than bi-encoder similarity
    but too slow for first-stage retrieval — used as a second-stage reranker.
    """

    def __init__(self):
        self.model = get_reranker_model()

    def rerank(
        self,
        query: str,
        chunks: list[dict],
        top_k: int | None = None,
    ) -> list[dict]:
        """Rerank chunks by cross-encoder relevance score.

        Args:
            query: The user's query.
            chunks: List of chunk dicts from vector search (must have 'content' key).
            top_k: Number of top results to return. None = return all, reordered.

        Returns:
            Reranked list of chunk dicts with updated 'rerank_score' field.
        """
        if not chunks:
            return []

        if top_k is None:
            top_k = len(chunks)

        # Build (query, content) pairs for the cross-encoder
        pairs = [(query, chunk["content"]) for chunk in chunks]

        # Score all pairs
        scores = self.model.predict(pairs)

        # Attach scores and sort
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
