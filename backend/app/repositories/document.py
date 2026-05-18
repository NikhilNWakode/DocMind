"""Document repository."""

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document, DocumentChunk


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        workspace_id: uuid.UUID,
        title: str,
        file_path: str,
        file_type: str,
        file_size: int,
    ) -> Document:
        doc = Document(
            workspace_id=workspace_id,
            title=title,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            status="pending",
        )
        self.db.add(doc)
        await self.db.flush()
        return doc

    async def get_by_id(self, document_id: uuid.UUID) -> Document | None:
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def get_with_chunks(self, document_id: uuid.UUID) -> Document | None:
        result = await self.db.execute(
            select(Document)
            .where(Document.id == document_id)
            .options(selectinload(Document.chunks))
        )
        return result.scalar_one_or_none()

    async def list_by_workspace(
        self, workspace_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[Document]:
        result = await self.db.execute(
            select(Document)
            .where(Document.workspace_id == workspace_id)
            .order_by(Document.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_workspace(self, workspace_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(Document.id)).where(Document.workspace_id == workspace_id)
        )
        return result.scalar_one()

    async def update_status(
        self,
        document_id: uuid.UUID,
        status: str,
        error_message: str | None = None,
        chunk_count: int | None = None,
        page_count: int | None = None,
    ) -> None:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.status = status
            if error_message is not None:
                doc.error_message = error_message
            if chunk_count is not None:
                doc.chunk_count = chunk_count
            if page_count is not None:
                doc.page_count = page_count
            await self.db.flush()

    async def create_chunks(self, chunks: list[DocumentChunk]) -> None:
        self.db.add_all(chunks)
        await self.db.flush()

    async def get_chunks_by_document(self, document_id: uuid.UUID) -> list[DocumentChunk]:
        result = await self.db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
        )
        return list(result.scalars().all())

    async def delete(self, document: Document) -> None:
        await self.db.delete(document)
        await self.db.flush()
