"""Ingestion progress SSE endpoint — streams real-time processing updates."""

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from app.api.deps import get_current_user
from app.infrastructure.redis_client import get_redis
from app.models.user import User

router = APIRouter(prefix="/ingestion", tags=["Ingestion"])


@router.get("/{document_id}/progress")
async def stream_ingestion_progress(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    """Stream ingestion progress via SSE using Redis pub/sub.

    The background task publishes progress events to a Redis channel.
    This endpoint subscribes and forwards them as SSE to the frontend.

    Event format:
    - {stage, progress, message} — progress updates (0-100%)
    - Complete when progress = 100 or stage = "failed"/"complete"
    """

    async def progress_stream():
        pubsub = redis.pubsub()
        channel = f"ingestion:{document_id}"

        try:
            await pubsub.subscribe(channel)

            # First, check if there's already a cached progress state
            cached = await redis.get(f"ingestion_progress:{document_id}")
            if cached:
                yield f"data: {cached}\n\n"
                data = json.loads(cached)
                if data.get("stage") in ("complete", "failed"):
                    return

            # Listen for live updates
            timeout_count = 0
            while timeout_count < 120:  # Max 2 minutes of listening
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )

                if message and message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
                    timeout_count = 0

                    # Check if done
                    try:
                        event = json.loads(message["data"])
                        if event.get("stage") in ("complete", "failed"):
                            break
                    except (json.JSONDecodeError, TypeError):
                        pass
                else:
                    timeout_count += 1
                    # Send keepalive every 5 seconds
                    if timeout_count % 5 == 0:
                        yield f": keepalive\n\n"

                await asyncio.sleep(0.1)

        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    return StreamingResponse(
        progress_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
