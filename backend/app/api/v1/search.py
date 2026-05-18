"""Semantic search API routes with hybrid retrieval and reranking."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, get_vector_store_service
from app.config import get_settings
from app.models.user import User
from app.services.embedding import EmbeddingService
from app.services.hybrid_retriever import HybridRetriever
from app.services.reranker import RerankerService
from app.services.vector_store import VectorStoreService

router = APIRouter(prefix="/search", tags=["Search"])
settings = get_settings()


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    workspace_id: uuid.UUID
    top_k: int = Field(default=10, ge=1, le=50)
    document_ids: list[str] | None = None
    use_reranking: bool = True


class SearchResult(BaseModel):
    chunk_id: str
    content: str
    document_title: str
    document_id: str
    page_number: int | None
    relevance_score: float
    rerank_score: float | None = None


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total_results: int
    query: str
    retrieval_method: str  # "hybrid" or "dense"


@router.post("", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
):
    """Search documents using hybrid retrieval (dense + BM25 + reranking)."""
    embedding_service = EmbeddingService()
    reranker = RerankerService() if (request.use_reranking and settings.enable_reranking) else None

    retriever = HybridRetriever(
        vector_store=vector_store,
        embedding_service=embedding_service,
        reranker=reranker,
    )

    results = await retriever.retrieve(
        query=request.query,
        workspace_id=str(request.workspace_id),
        top_k=request.top_k,
        rerank_top_k=request.top_k,
        document_ids=request.document_ids,
    )

    search_results = [
        SearchResult(
            chunk_id=r["id"],
            content=r["content"],
            document_title=r["document_title"],
            document_id=r["document_id"],
            page_number=r.get("page_number"),
            relevance_score=r.get("score", 0.0),
            rerank_score=r.get("rerank_score"),
        )
        for r in results
    ]

    retrieval_method = "hybrid" if settings.enable_hybrid_search else "dense"

    return SearchResponse(
        results=search_results,
        total_results=len(search_results),
        query=request.query,
        retrieval_method=retrieval_method,
    )
