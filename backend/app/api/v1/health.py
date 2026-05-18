"""Health check endpoints."""

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_db
from app.infrastructure.redis_client import get_redis
from app.infrastructure.qdrant_client import get_qdrant

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/live")
async def liveness():
    """Liveness probe — is the process alive?"""
    return {"status": "alive"}


@router.get("/ready")
async def readiness(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    qdrant=Depends(get_qdrant),
):
    """Readiness probe — are all dependencies available?"""
    checks = {}

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"

    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:100]}"

    try:
        qdrant.get_collections()
        checks["qdrant"] = "ok"
    except Exception as e:
        checks["qdrant"] = f"error: {str(e)[:100]}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
    }
