"""Hybrid retrieval service: Dense + BM25 sparse search with RRF fusion."""

from collections import defaultdict

import structlog
from rank_bm25 import BM25Okapi

from app.config import get_settings
from app.services.embedding import EmbeddingService
from app.services.reranker import RerankerService
from app.services.vector_store import VectorStoreService

logger = structlog.get_logger()
settings = get_settings()


class HybridRetriever:
    """Combines dense vector search with BM25 sparse retrieval.

    Pipeline:
    1. Dense search via Qdrant (semantic similarity)
    2. BM25 sparse search (keyword matching)
    3. Reciprocal Rank Fusion (RRF) to merge rankings
    4. Cross-encoder reranking on fused results
    """

    def __init__(
        self,
        vector_store: VectorStoreService,
        embedding_service: EmbeddingService | None = None,
        reranker: RerankerService | None = None,
    ):
        self.vector_store = vector_store
        self.embedding_service = embedding_service or EmbeddingService()
        self.reranker = reranker

    async def retrieve(
        self,
        query: str,
        workspace_id: str,
        top_k: int = 5,
        rerank_top_k: int | None = None,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        """Execute hybrid retrieval pipeline.

        Args:
            query: User's search query.
            workspace_id: Workspace to search in.
            top_k: Number of results for first-stage retrieval.
            rerank_top_k: Number of results after reranking (default: settings.rerank_top_k).
            document_ids: Optional filter to specific documents.

        Returns:
            List of chunk dicts ordered by relevance.
        """
        if rerank_top_k is None:
            rerank_top_k = settings.rerank_top_k

        # Stage 1: Dense vector search
        query_embedding = self.embedding_service.embed_query(query)
        dense_results = self.vector_store.search(
            workspace_id=workspace_id,
            query_vector=query_embedding,
            top_k=top_k * 2,  # over-retrieve for fusion
            document_ids=document_ids,
        )

        if not settings.enable_hybrid_search:
            # Hybrid disabled — just use dense results
            results = dense_results[:top_k]
            if settings.enable_reranking and self.reranker and results:
                results = self.reranker.rerank(query, results, top_k=rerank_top_k)
            return results

        # Stage 2: BM25 sparse search over the same corpus
        bm25_results = self._bm25_search(query, dense_results, top_k=top_k * 2)

        # Stage 3: RRF fusion
        fused = self._reciprocal_rank_fusion(
            rankings=[dense_results, bm25_results],
            k=60,
        )

        # Take top candidates for reranking
        candidates = fused[:top_k]

        # Stage 4: Cross-encoder reranking
        if settings.enable_reranking and self.reranker and candidates:
            candidates = self.reranker.rerank(query, candidates, top_k=rerank_top_k)

        logger.info(
            "hybrid_retrieval_complete",
            query=query[:80],
            dense_count=len(dense_results),
            bm25_count=len(bm25_results),
            fused_count=len(fused),
            final_count=len(candidates),
        )

        return candidates

    def _bm25_search(self, query: str, corpus: list[dict], top_k: int = 10) -> list[dict]:
        """Run BM25 sparse search over a corpus of chunks.

        Uses the dense results as the corpus — this is an "in-memory reranking"
        approach that avoids maintaining a separate BM25 index. For larger corpora,
        consider Qdrant's built-in sparse vectors or Elasticsearch.
        """
        if not corpus:
            return []

        # Tokenize corpus
        tokenized_corpus = [doc["content"].lower().split() for doc in corpus]
        bm25 = BM25Okapi(tokenized_corpus)

        # Score query
        tokenized_query = query.lower().split()
        scores = bm25.get_scores(tokenized_query)

        # Attach scores and sort
        scored_results = []
        for doc, score in zip(corpus, scores):
            result = doc.copy()
            result["bm25_score"] = float(score)
            scored_results.append(result)

        scored_results.sort(key=lambda x: x["bm25_score"], reverse=True)
        return scored_results[:top_k]

    def _reciprocal_rank_fusion(
        self,
        rankings: list[list[dict]],
        k: int = 60,
    ) -> list[dict]:
        """Merge multiple rankings using Reciprocal Rank Fusion (RRF).

        RRF score = sum(1 / (k + rank_i)) for each ranking.
        k is a constant (typically 60) that controls the impact of high vs low ranks.
        """
        doc_scores: dict[str, float] = defaultdict(float)
        doc_lookup: dict[str, dict] = {}

        for ranking in rankings:
            for rank, doc in enumerate(ranking, start=1):
                doc_id = doc["id"]
                doc_scores[doc_id] += 1.0 / (k + rank)
                if doc_id not in doc_lookup:
                    doc_lookup[doc_id] = doc

        # Sort by RRF score
        sorted_ids = sorted(doc_scores, key=doc_scores.get, reverse=True)

        fused = []
        for doc_id in sorted_ids:
            result = doc_lookup[doc_id].copy()
            result["rrf_score"] = doc_scores[doc_id]
            fused.append(result)

        return fused
