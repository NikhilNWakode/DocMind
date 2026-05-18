"""Document ingestion background tasks (FastAPI BackgroundTasks)."""

import json
import uuid
from pathlib import Path

import structlog
from redis import Redis as SyncRedis

from app.config import get_settings
from app.infrastructure.database import async_session_factory
from app.infrastructure.qdrant_client import get_qdrant
from app.models.document import DocumentChunk
from app.repositories.document import DocumentRepository
from app.services.chunking import TextChunker
from app.services.embedding import EmbeddingService
from app.services.extraction import TextExtractor
from app.services.vector_store import VectorStoreService

logger = structlog.get_logger()
settings = get_settings()


def _publish_progress(redis_client: SyncRedis, document_id: str, stage: str, progress: int, message: str = "") -> None:
    """Publish ingestion progress via Redis pub/sub for SSE consumption."""
    event = json.dumps({
        "document_id": document_id,
        "stage": stage,
        "progress": progress,
        "message": message,
    })
    redis_client.publish(f"ingestion:{document_id}", event)
    redis_client.setex(
        f"ingestion_progress:{document_id}",
        300,
        event,
    )


async def process_document(document_id: str) -> dict:
    """Full ingestion pipeline — runs as a FastAPI background task.

    Stages:
    1. Extract text (20%)
    2. Chunk text (40%)
    3. Generate embeddings (60%)
    4. Index in Qdrant (80%)
    5. Save to database (100%)
    """
    doc_uuid = uuid.UUID(document_id)
    redis_client = SyncRedis.from_url(settings.redis_url, decode_responses=True)

    try:
        result = await _process_document_async(doc_uuid, redis_client)
        return result
    except Exception as exc:
        logger.error("ingestion_failed", document_id=document_id, error=str(exc))
        _publish_progress(redis_client, document_id, "failed", 0, str(exc)[:200])
        await _mark_failed(doc_uuid, str(exc)[:500])
        raise


async def _process_document_async(document_id: uuid.UUID, redis_client: SyncRedis) -> dict:
    """Async implementation of the ingestion pipeline."""
    doc_id_str = str(document_id)

    async with async_session_factory() as session:
        repo = DocumentRepository(session)
        doc = await repo.get_by_id(document_id)
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        # Stage 1: Update status to processing
        await repo.update_status(document_id, "processing")
        await session.commit()
        _publish_progress(redis_client, doc_id_str, "extracting", 10, "Extracting text...")

        # Stage 2: Resolve file path (download from S3 if needed)
        file_path = doc.file_path
        if file_path.startswith("s3://"):
            try:
                from app.infrastructure.s3_client import StorageService
                storage = StorageService()
                s3_key = file_path.split("/", 3)[3]
                data = storage.download_file(s3_key)
                upload_dir = Path("uploads")
                upload_dir.mkdir(exist_ok=True)
                temp_path = upload_dir / f"temp_{uuid.uuid4()}.{doc.file_type}"
                temp_path.write_bytes(data)
                file_path = str(temp_path)
            except Exception as e:
                raise RuntimeError(f"Failed to download file from S3: {e}")

        # Stage 3: Extract text
        extractor = TextExtractor()
        extracted = await extractor.extract(file_path, doc.file_type)
        _publish_progress(redis_client, doc_id_str, "extracting", 20, f"Extracted {extracted.total_pages} pages")

        # Stage 4: Chunk text
        _publish_progress(redis_client, doc_id_str, "chunking", 30, "Chunking document...")
        chunker = TextChunker(
            max_chunk_tokens=settings.chunk_size,
            overlap_tokens=settings.chunk_overlap,
        )
        chunks = chunker.chunk(extracted)

        if not chunks:
            await repo.update_status(document_id, "failed", error_message="No text content extracted")
            await session.commit()
            _publish_progress(redis_client, doc_id_str, "failed", 0, "No text content found")
            return {"status": "failed", "reason": "no_content"}

        _publish_progress(redis_client, doc_id_str, "chunking", 40, f"Created {len(chunks)} chunks")

        # Stage 5: Generate embeddings
        _publish_progress(redis_client, doc_id_str, "embedding", 50, "Generating embeddings...")
        embedding_service = EmbeddingService()
        texts = [chunk.content for chunk in chunks]
        embeddings = embedding_service.embed_texts(texts)
        _publish_progress(redis_client, doc_id_str, "embedding", 60, f"Generated {len(embeddings)} embeddings")

        # Stage 6: Index in Qdrant
        _publish_progress(redis_client, doc_id_str, "indexing", 70, "Indexing vectors...")
        qdrant = get_qdrant()
        vector_store = VectorStoreService(client=qdrant)
        point_ids = vector_store.index_chunks(
            workspace_id=str(doc.workspace_id),
            chunks=chunks,
            embeddings=embeddings,
            document_id=doc_id_str,
        )
        _publish_progress(redis_client, doc_id_str, "indexing", 80, f"Indexed {len(point_ids)} vectors")

        # Stage 7: Save chunks to database
        _publish_progress(redis_client, doc_id_str, "saving", 90, "Saving to database...")
        db_chunks = []
        for chunk, point_id in zip(chunks, point_ids):
            db_chunks.append(
                DocumentChunk(
                    document_id=document_id,
                    content=chunk.content,
                    chunk_index=chunk.chunk_index,
                    page_number=chunk.page_number,
                    token_count=chunk.token_count,
                    embedding_id=point_id,
                )
            )
        await repo.create_chunks(db_chunks)

        # Stage 8: Update document status
        await repo.update_status(
            document_id,
            status="indexed",
            chunk_count=len(chunks),
            page_count=extracted.total_pages,
        )
        await session.commit()

        _publish_progress(redis_client, doc_id_str, "complete", 100, "Processing complete")

        logger.info(
            "document_processed",
            document_id=doc_id_str,
            chunks=len(chunks),
            pages=extracted.total_pages,
        )

        return {
            "status": "indexed",
            "chunks": len(chunks),
            "pages": extracted.total_pages,
        }


async def _mark_failed(document_id: uuid.UUID, error_message: str) -> None:
    """Mark a document as failed in the database."""
    async with async_session_factory() as session:
        repo = DocumentRepository(session)
        try:
            await repo.update_status(document_id, "failed", error_message=error_message)
            await session.commit()
        except Exception as e:
            logger.error("failed_to_mark_document_failed", error=str(e))
            await session.rollback()
