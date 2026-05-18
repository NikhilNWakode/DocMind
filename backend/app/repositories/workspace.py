"""Workspace repository."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.workspace import Workspace


class WorkspaceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, name: str, owner_id: uuid.UUID, description: str | None = None) -> Workspace:
        workspace = Workspace(name=name, owner_id=owner_id, description=description)
        self.db.add(workspace)
        await self.db.flush()
        return workspace

    async def get_by_id(self, workspace_id: uuid.UUID) -> Workspace | None:
        result = await self.db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        return result.scalar_one_or_none()

    async def list_by_owner(self, owner_id: uuid.UUID) -> list[Workspace]:
        result = await self.db.execute(
            select(Workspace)
            .where(Workspace.owner_id == owner_id)
            .order_by(Workspace.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_document_count(self, workspace_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(Document.id)).where(Document.workspace_id == workspace_id)
        )
        return result.scalar_one()

    async def delete(self, workspace: Workspace) -> None:
        await self.db.delete(workspace)
        await self.db.flush()
