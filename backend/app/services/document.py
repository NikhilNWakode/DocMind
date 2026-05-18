"""Document management service — upload, storage, and lifecycle management."""

import json
import os
import uuid
from pathlib import Path

import structlog
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.infrastructure.s3_client import StorageService
from app.models.document import DocumentChunk
from app.repositories.document import DocumentRepository
from app.schemas.document import DocumentResponse, DocumentStatusResponse
from app.services.chunking import TextChunker
from app.services.embedding import EmbeddingService
from app.services.extraction import TextExtractor
from app.services.vector_store import VectorStoreService

logger = structlog.get_logger()
settings = get_settings()

# Local upload directory (fallback if S3 unavailable)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class DocumentService:
    """Orchestrates document upload, ingestion, and management."""

    def __init__(
        self,
        db: AsyncSession,
        vector_store: VectorStoreService,
        redis: Redis | None = None,
    ):
        self.repo = DocumentRepository(db)
        self.db = db
        self.vector_store = vector_store
        self.redis = redis
        self.extractor = TextExtractor()
        self.chunker = TextChunker(
            max_chunk_tokens=settings.chunk_size,
            overlap_tokens=settings.chunk_overlap,
        )
        self.embedding_service = EmbeddingService()

        # Use S3 only if endpoint is configured and not localhost
        s3_endpoint = settings.s3_endpoint or ""
        if s3_endpoint and "localhost" not in s3_endpoint and "127.0.0.1" not in s3_endpoint:
            try:
                self.storage = StorageService()
                self.use_s3 = True
            except Exception:
                self.storage = None
                self.use_s3 = False
                logger.warning("s3_unavailable_using_local_storage")
        else:
            self.storage = None
            self.use_s3 = False
            logger.info("using_local_file_storage")

    async def upload_document(
        self,
        workspace_id: uuid.UUID,
        file_name: str,
        file_content: bytes,
        file_type: str,
    ) -> DocumentResponse:
        """Upload and store a document. Returns document metadata."""

        # Validate file type
        if file_type not in settings.allowed_file_types:
            raise ValidationError(f"File type '{file_type}' not supported")

        # Validate file size
        file_size = len(file_content)
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if file_size > max_bytes:
            raise ValidationError(f"File exceeds {settings.max_upload_size_mb}MB limit")

        # Generate unique file key
        file_id = str(uuid.uuid4())

        # Store file
        if self.use_s3 and self.storage:
            s3_key = f"{workspace_id}/{file_id}.{file_type}"
            content_type = self._get_content_type(file_type)
            self.storage.upload_file(s3_key, file_content, content_type)
            file_path = f"s3://{settings.s3_bucket}/{s3_key}"
        else:
            # Fallback to local storage
            local_path = UPLOAD_DIR / f"{file_id}.{file_type}"
            local_path.write_bytes(file_content)
            file_path = str(local_path)

        # Create document record
        doc = await self.repo.create(
            workspace_id=workspace_id,
            title=file_name,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
        )
        await self.db.commit()

        # Invalidate semantic cache for this workspace (new document = stale answers)
        if self.redis and settings.enable_semantic_cache:
            try:
                from app.services.semantic_cache import SemanticCache
                cache = SemanticCache(self.redis)
                await cache.invalidate_workspace(str(workspace_id))
            except Exception as e:
                logger.warning("cache_invalidation_failed", error=str(e)[:100])

        logger.info(
            "document_uploaded",
            document_id=str(doc.id),
            title=file_name,
            file_type=file_type,
            file_size=file_size,
            storage="s3" if self.use_s3 else "local",
        )

        return DocumentResponse.model_validate(doc)

    async def process_document(self, document_id: uuid.UUID) -> None:
        """Full ingestion pipeline: extract -> chunk -> embed -> index.

        Called via FastAPI BackgroundTasks from the upload endpoint.
        """
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", str(document_id))

        try:
            # Stage 1: Update status
            await self.repo.update_status(document_id, "processing")
            await self.db.commit()

            # Stage 2: Get file content (resolve S3 or local path)
            file_path = await self._resolve_file_path(doc.file_path, doc.file_type)

            # Stage 3: Extract text
            logger.info("extracting_text", document_id=str(document_id))
            extracted = await self.extractor.extract(file_path, doc.file_type)

            # Stage 4: Chunk text
            logger.info("chunking_document", document_id=str(document_id))
            chunks = self.chunker.chunk(extracted)

            if not chunks:
                await self.repo.update_status(
                    document_id, "failed", error_message="No text content extracted"
                )
                await self.db.commit()
                return

            # Stage 5: Generate embeddings
            logger.info("generating_embeddings", document_id=str(document_id), chunk_count=len(chunks))
            texts = [chunk.content for chunk in chunks]
            embeddings = self.embedding_service.embed_texts(texts)

            # Stage 6: Index in Qdrant
            logger.info("indexing_vectors", document_id=str(document_id))
            point_ids = self.vector_store.index_chunks(
                workspace_id=str(doc.workspace_id),
                chunks=chunks,
                embeddings=embeddings,
                document_id=str(document_id),
            )

            # Stage 7: Save chunks to database
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
            await self.repo.create_chunks(db_chunks)

            # Stage 8: Update document status
            await self.repo.update_status(
                document_id,
                status="indexed",
                chunk_count=len(chunks),
                page_count=extracted.total_pages,
            )
            await self.db.commit()

            logger.info(
                "document_processed",
                document_id=str(document_id),
                chunks=len(chunks),
                pages=extracted.total_pages,
            )

        except Exception as e:
            logger.error(
                "document_processing_failed",
                document_id=str(document_id),
                error=str(e),
            )
            await self.db.rollback()
            try:
                await self.repo.update_status(
                    document_id, "failed", error_message=str(e)[:500]
                )
                await self.db.commit()
            except Exception as status_err:
                logger.error("failed_to_update_status", error=str(status_err))
                await self.db.rollback()

    async def get_document_status(self, document_id: uuid.UUID) -> DocumentStatusResponse:
        """Get document status with ingestion progress from Redis."""
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", str(document_id))

        progress = None
        if self.redis and doc.status == "processing":
            cached_progress = await self.redis.get(f"ingestion_progress:{document_id}")
            if cached_progress:
                progress = json.loads(cached_progress)

        return DocumentStatusResponse(
            id=doc.id,
            status=doc.status,
            chunk_count=doc.chunk_count,
            error_message=doc.error_message,
            progress=progress,
        )

    async def list_documents(
        self, workspace_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[DocumentResponse], int]:
        """List documents in a workspace."""
        docs = await self.repo.list_by_workspace(workspace_id, skip, limit)
        total = await self.repo.count_by_workspace(workspace_id)
        return [DocumentResponse.model_validate(d) for d in docs], total

    async def get_document(self, document_id: uuid.UUID) -> DocumentResponse:
        """Get a single document by ID."""
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", str(document_id))
        return DocumentResponse.model_validate(doc)

    async def delete_document(self, document_id: uuid.UUID) -> None:
        """Delete a document, its vectors, and its stored file."""
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", str(document_id))

        # Delete vectors from Qdrant
        self.vector_store.delete_document_vectors(
            str(doc.workspace_id), str(document_id)
        )

        # Delete file from storage
        if doc.file_path.startswith("s3://") and self.storage:
            # Extract S3 key from path: s3://bucket/key -> key
            s3_key = doc.file_path.split("/", 3)[3] if "/" in doc.file_path else ""
            if s3_key:
                self.storage.delete_file(s3_key)
        else:
            try:
                os.remove(doc.file_path)
            except OSError:
                pass

        # Invalidate semantic cache
        if self.redis and settings.enable_semantic_cache:
            try:
                from app.services.semantic_cache import SemanticCache
                cache = SemanticCache(self.redis)
                await cache.invalidate_workspace(str(doc.workspace_id))
            except Exception as e:
                logger.warning("cache_invalidation_failed", error=str(e)[:100])

        # Delete from database (cascades to chunks)
        await self.repo.delete(doc)
        await self.db.commit()

        logger.info("document_deleted", document_id=str(document_id))

    async def get_document_summary(self, document_id: uuid.UUID) -> str | None:
        """Get the AI-generated summary for a document."""
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError("Document", str(document_id))
        return (doc.metadata_ or {}).get("summary")

    async def _resolve_file_path(self, file_path: str, file_type: str) -> str:
        """Resolve S3 paths to local temp files for processing."""
        if file_path.startswith("s3://") and self.storage:
            # Download from S3 to a temp location
            s3_key = file_path.split("/", 3)[3]
            data = self.storage.download_file(s3_key)
            temp_path = UPLOAD_DIR / f"temp_{uuid.uuid4()}.{file_type}"
            temp_path.write_bytes(data)
            return str(temp_path)
        return file_path

    def _get_content_type(self, file_type: str) -> str:
        """Map file extension to content type."""
        content_types = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "txt": "text/plain",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
        }
        return content_types.get(file_type, "application/octet-stream")
