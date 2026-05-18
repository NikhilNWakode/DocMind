"""Semantic search API routes — simple dense vector search."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, get_vector_store_service
from app.config import get_settings
from app.models.user import User
from app.services.embedding import EmbeddingService
from app.services.vector_store import VectorStoreService

router = APIRouter(prefix="/search", tags=["Search"])
settings = get_settings()


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    workspace_id: uuid.UUID
    top_k: int = Field(default=10, ge=1, le=50)
    document_ids: list[str] | None = None
    use_reranking: bool = False


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
    retrieval_method: str


@router.post("", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
):
    """Search documents using dense vector search."""
    try:
        embedding_service = EmbeddingService()
        query_embedding = embedding_service.embed_query(request.query)

        results = vector_store.search(
            workspace_id=str(request.workspace_id),
            query_vector=query_embedding,
            top_k=request.top_k,
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
                rerank_score=None,
            )
            for r in results
        ]

        return SearchResponse(
            results=search_results,
            total_results=len(search_results),
            query=request.query,
            retrieval_method="dense",
        )
    except Exception as e:
        import structlog
        structlog.get_logger().error("search_failed", error=str(e))
        return SearchResponse(
            results=[],
            total_results=0,
            query=request.query,
            retrieval_method="dense",
        )
