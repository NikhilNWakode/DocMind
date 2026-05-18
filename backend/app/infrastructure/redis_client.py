"""Redis async client for caching, pub/sub, and rate limiting."""

from collections.abc import AsyncGenerator

import structlog
import redis.asyncio as aioredis

from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

# Module-level connection pool (shared across all requests)
_redis_pool: aioredis.Redis | None = None


def get_redis_pool() -> aioredis.Redis:
    """Get or create the Redis connection pool singleton."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
        logger.info("redis_pool_created", url=settings.redis_url[:30])
    return _redis_pool


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """FastAPI dependency that provides an async Redis client."""
    pool = get_redis_pool()
    yield pool


async def close_redis() -> None:
    """Close the Redis connection pool (called on app shutdown)."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
