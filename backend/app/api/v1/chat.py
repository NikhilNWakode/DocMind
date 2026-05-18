"""Chat API routes with SSE streaming, semantic caching, and hybrid retrieval."""

import json
import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from app.api.deps import get_current_user, get_vector_store_service
from app.core.rate_limiter import limiter, get_user_rate_key
from app.config import get_settings
from app.infrastructure.database import async_session_factory
from app.infrastructure.redis_client import get_redis
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.chat import ChatService
from app.services.vector_store import VectorStoreService

router = APIRouter(prefix="/chat", tags=["Chat"])
settings = get_settings()


@router.post("/stream")
@limiter.limit(f"{settings.rate_limit_chat_per_minute}/minute", key_func=get_user_rate_key)
async def stream_chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
    redis: Redis = Depends(get_redis),
):
    """Stream AI response using Server-Sent Events (SSE).

    IMPORTANT: StreamingResponse runs AFTER FastAPI dependency cleanup.
    The DB session from Depends(get_db) would be closed by the time streaming starts.
    So we create a dedicated session inside the stream generator.

    Event types:
    - start: {conversation_id}
    - token: {content} — individual tokens for streaming display
    - citations: {citations} — source references
    - metadata: {model, latency_ms, chunks_used, cache_hit}
    - cache_hit: response served from semantic cache
    - done: stream complete
    - error: {message}
    """
    # Capture values we need inside the generator (these are safe — plain data)
    user_id = current_user.id
    query = chat_request.query
    workspace_id = chat_request.workspace_id
    conversation_id = chat_request.conversation_id

    async def event_stream():
        # Create a dedicated DB session for the lifetime of the stream
        async with async_session_factory() as session:
            try:
                chat_service = ChatService(
                    db=session,
                    vector_store=vector_store,
                    redis=redis,
                )
                async for event in chat_service.query_stream(
                    query=query,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    conversation_id=conversation_id,
                ):
                    data = {"type": event.type}
                    if event.content:
                        data["content"] = event.content
                    if event.data:
                        data.update(event.data)

                    yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            finally:
                await session.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations")
async def list_conversations(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
    redis: Redis = Depends(get_redis),
):
    """List conversations in a workspace."""
    async with async_session_factory() as session:
        chat_service = ChatService(db=session, vector_store=vector_store, redis=redis)
        conversations = await chat_service.get_conversations(workspace_id, current_user.id)
        return {"conversations": conversations, "total": len(conversations)}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
    redis: Redis = Depends(get_redis),
):
    """Get all messages in a conversation."""
    async with async_session_factory() as session:
        chat_service = ChatService(db=session, vector_store=vector_store, redis=redis)
        messages = await chat_service.get_messages(conversation_id)
        return {"messages": messages}


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    vector_store: VectorStoreService = Depends(get_vector_store_service),
    redis: Redis = Depends(get_redis),
):
    """Delete a conversation and all its messages."""
    async with async_session_factory() as session:
        chat_service = ChatService(db=session, vector_store=vector_store, redis=redis)
        await chat_service.delete_conversation(conversation_id)
        await session.commit()
