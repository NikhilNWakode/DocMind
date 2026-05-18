"""FastAPI application factory with Phase 2 enhancements."""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.exceptions import DocMindError
from app.core.rate_limiter import limiter
from app.infrastructure.redis_client import close_redis

settings = get_settings()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info(
        "starting_application",
        app_name=settings.app_name,
        env=settings.app_env,
        features={
            "hybrid_search": settings.enable_hybrid_search,
            "reranking": settings.enable_reranking,
            "semantic_cache": settings.enable_semantic_cache,
            "conversation_summary": settings.enable_conversation_summary,
        },
    )
    yield
    # Cleanup
    await close_redis()
    logger.info("shutting_down_application")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        description="AI Document Intelligence Platform — Semantic search, Q&A, and multi-document reasoning",
        version="0.2.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global exception handler for domain errors
    @app.exception_handler(DocMindError)
    async def docmind_error_handler(request: Request, exc: DocMindError):
        return JSONResponse(
            status_code=exc.status,
            content={"error": exc.code, "message": exc.message},
        )

    # Include API routes
    app.include_router(api_router, prefix=settings.api_prefix)

    return app


# Application instance
app = create_app()
