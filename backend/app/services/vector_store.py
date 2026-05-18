"""Vector store service for Qdrant operations."""

import uuid

import numpy as np
import structlog
from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from app.config import get_settings
from app.services.chunking import Chunk

logger = structlog.get_logger()
settings = get_settings()


class VectorStoreService:
    """Manages vector storage and retrieval in Qdrant."""

    def __init__(self, client: QdrantClient):
        self.client = client

    def _collection_name(self, workspace_id: str) -> str:
        return f"{settings.qdrant_collection_prefix}_{workspace_id}"

    def ensure_collection(self, workspace_id: str) -> None:
        """Create a collection for a workspace if it doesn't exist."""
        collection_name = self._collection_name(workspace_id)
        try:
            self.client.get_collection(collection_name)
        except UnexpectedResponse as e:
            # Qdrant returns 404 when collection doesn't exist
            if "not found" in str(e).lower() or getattr(e, "status_code", 0) == 404:
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=settings.embedding_dimension,
                        distance=models.Distance.COSINE,
                    ),
                )
                logger.info("collection_created", collection=collection_name)
            else:
                raise

    def index_chunks(
        self,
        workspace_id: str,
        chunks: list[Chunk],
        embeddings: list[np.ndarray],
        document_id: str,
    ) -> list[str]:
        """Index chunk embeddings into Qdrant. Returns list of point IDs."""
        collection_name = self._collection_name(workspace_id)
        self.ensure_collection(workspace_id)

        point_ids = []
        points = []

        for chunk, embedding in zip(chunks, embeddings):
            point_id = str(uuid.uuid4())
            point_ids.append(point_id)

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload={
                        "document_id": document_id,
                        "content": chunk.content,
                        "chunk_index": chunk.chunk_index,
                        "page_number": chunk.page_number,
                        "document_title": chunk.document_title,
                        "token_count": chunk.token_count,
                    },
                )
            )

        # Batch upsert (Qdrant handles batching internally)
        self.client.upsert(collection_name=collection_name, points=points)

        logger.info(
            "chunks_indexed",
            collection=collection_name,
            count=len(points),
            document_id=document_id,
        )

        return point_ids

    def search(
        self,
        workspace_id: str,
        query_vector: np.ndarray,
        top_k: int = 5,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        """Search for similar chunks in the vector store."""
        collection_name = self._collection_name(workspace_id)

        # Build filter if document_ids specified
        query_filter = None
        if document_ids:
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchAny(any=document_ids),
                    )
                ]
            )

        results = self.client.query_points(
            collection_name=collection_name,
            query=query_vector.tolist(),
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
        )

        return [
            {
                "id": str(point.id),
                "score": point.score,
                "content": point.payload.get("content", ""),
                "document_id": point.payload.get("document_id", ""),
                "document_title": point.payload.get("document_title", ""),
                "chunk_index": point.payload.get("chunk_index", 0),
                "page_number": point.payload.get("page_number"),
                "token_count": point.payload.get("token_count", 0),
            }
            for point in results.points
        ]

    def delete_document_vectors(self, workspace_id: str, document_id: str) -> None:
        """Delete all vectors for a specific document."""
        collection_name = self._collection_name(workspace_id)
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id",
                                match=models.MatchValue(value=document_id),
                            )
                        ]
                    )
                ),
            )
            logger.info(
                "vectors_deleted",
                collection=collection_name,
                document_id=document_id,
            )
        except Exception as e:
            logger.warning("vector_deletion_failed", error=str(e))
