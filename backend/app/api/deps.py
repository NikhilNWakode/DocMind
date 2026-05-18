"""FastAPI dependency injection."""

import uuid

from fastapi import Depends, Header, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.infrastructure.database import get_db
from app.infrastructure.qdrant_client import get_qdrant
from app.infrastructure.redis_client import get_redis
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.document import DocumentService
from app.services.vector_store import VectorStoreService


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate user from JWT token.

    Returns 401 for missing/invalid tokens (not 422 for missing header).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization[7:]
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id))

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


def get_vector_store_service(
    qdrant=Depends(get_qdrant),
) -> VectorStoreService:
    """Provide VectorStoreService."""
    return VectorStoreService(client=qdrant)


def get_document_service(
    db: AsyncSession = Depends(get_db),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
    redis: Redis = Depends(get_redis),
) -> DocumentService:
    """Provide DocumentService with all dependencies."""
    return DocumentService(db=db, vector_store=vector_store, redis=redis)
