"""Conversation repository."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation, Message


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str = "New conversation",
    ) -> Conversation:
        conv = Conversation(workspace_id=workspace_id, user_id=user_id, title=title)
        self.db.add(conv)
        await self.db.flush()
        return conv

    async def get_by_id(self, conversation_id: uuid.UUID) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def get_with_messages(self, conversation_id: uuid.UUID) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(selectinload(Conversation.messages))
        )
        return result.scalar_one_or_none()

    async def list_by_workspace(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(
                Conversation.workspace_id == workspace_id,
                Conversation.user_id == user_id,
            )
            .order_by(Conversation.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_workspace(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.workspace_id == workspace_id,
                Conversation.user_id == user_id,
            )
        )
        return result.scalar_one()

    async def add_message(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        citations: dict | None = None,
        token_count: int | None = None,
        model: str | None = None,
        latency_ms: int | None = None,
    ) -> Message:
        msg = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            citations=citations,
            token_count=token_count,
            model=model,
            latency_ms=latency_ms,
        )
        self.db.add(msg)
        await self.db.flush()
        return msg

    async def get_messages(
        self, conversation_id: uuid.UUID, limit: int = 20
    ) -> list[Message]:
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        return list(reversed(result.scalars().all()))

    async def update_title(self, conversation_id: uuid.UUID, title: str) -> None:
        conv = await self.get_by_id(conversation_id)
        if conv:
            conv.title = title
            await self.db.flush()

    async def get_message_count(self, conversation_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(Message.id)).where(Message.conversation_id == conversation_id)
        )
        return result.scalar_one()

    async def delete(self, conversation: Conversation) -> None:
        await self.db.delete(conversation)
        await self.db.flush()
