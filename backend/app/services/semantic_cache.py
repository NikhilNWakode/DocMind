"""Semantic caching service — reduces LLM calls for similar queries.

Strategy:
- Hash the query embedding and check Redis for a cached response.
- If found, return cached response (saving LLM cost + latency).
- If not, generate a new response and cache it.
- Uses cosine similarity on embeddings to match "similar enough" queries.
"""

import hashlib
import json
import time

import numpy as np
import structlog
from redis.asyncio import Redis

from app.config import get_settings
from app.services.embedding import EmbeddingService

logger = structlog.get_logger()
settings = get_settings()


class SemanticCache:
    """Cache LLM responses by semantic similarity of queries."""

    def __init__(self, redis: Redis, embedding_service: EmbeddingService | None = None):
        self.redis = redis
        self.embedding_service = embedding_service or EmbeddingService()
        self.ttl = settings.cache_ttl_seconds
        self.threshold = settings.cache_similarity_threshold

    def _cache_key(self, workspace_id: str) -> str:
        """Redis key prefix for a workspace's cache."""
        return f"semantic_cache:{workspace_id}"

    def _query_hash(self, query: str) -> str:
        """Create a deterministic hash for exact query matching."""
        return hashlib.sha256(query.strip().lower().encode()).hexdigest()[:16]

    async def get(self, query: str, workspace_id: str) -> dict | None:
        """Check if a semantically similar query exists in cache.

        Returns cached response dict or None.
        """
        if not settings.enable_semantic_cache:
            return None

        cache_key = self._cache_key(workspace_id)
        query_hash = self._query_hash(query)

        # First: try exact match (fastest)
        exact_key = f"{cache_key}:exact:{query_hash}"
        cached = await self.redis.get(exact_key)
        if cached:
            logger.info("cache_hit_exact", query=query[:60])
            data = json.loads(cached)
            data["cache_hit"] = True
            return data

        # Second: try semantic similarity match
        # Get query embedding
        query_embedding = self.embedding_service.embed_query(query)

        # Scan cached embeddings for this workspace
        pattern = f"{cache_key}:embed:*"
        match_found = None

        async for key in self.redis.scan_iter(match=pattern, count=50):
            cached_data = await self.redis.get(key)
            if not cached_data:
                continue

            entry = json.loads(cached_data)
            cached_embedding = np.array(entry["embedding"])

            # Cosine similarity
            similarity = float(
                np.dot(query_embedding, cached_embedding)
                / (np.linalg.norm(query_embedding) * np.linalg.norm(cached_embedding) + 1e-8)
            )

            if similarity >= self.threshold:
                match_found = entry
                logger.info(
                    "cache_hit_semantic",
                    query=query[:60],
                    similarity=f"{similarity:.4f}",
                    original_query=entry.get("query", "")[:60],
                )
                break

        if match_found:
            response = match_found.get("response", {})
            response["cache_hit"] = True
            response["cache_similarity"] = similarity
            return response

        return None

    async def set(
        self,
        query: str,
        workspace_id: str,
        response: str,
        citations: list[dict],
        model: str,
    ) -> None:
        """Cache a query response with its embedding for future matching."""
        if not settings.enable_semantic_cache:
            return

        cache_key = self._cache_key(workspace_id)
        query_hash = self._query_hash(query)
        query_embedding = self.embedding_service.embed_query(query)

        response_data = {
            "response": response,
            "citations": citations,
            "model": model,
            "cached_at": time.time(),
        }

        # Store exact match
        exact_key = f"{cache_key}:exact:{query_hash}"
        await self.redis.setex(exact_key, self.ttl, json.dumps(response_data))

        # Store embedding entry for semantic matching
        embed_entry = {
            "query": query,
            "embedding": query_embedding.tolist(),
            "response": response_data,
        }
        embed_key = f"{cache_key}:embed:{query_hash}"
        await self.redis.setex(embed_key, self.ttl, json.dumps(embed_entry))

        logger.info("cache_set", query=query[:60], workspace_id=workspace_id)

    async def invalidate_workspace(self, workspace_id: str) -> int:
        """Invalidate all cache entries for a workspace (e.g., on new document upload)."""
        cache_key = self._cache_key(workspace_id)
        count = 0
        async for key in self.redis.scan_iter(match=f"{cache_key}:*"):
            await self.redis.delete(key)
            count += 1
        if count:
            logger.info("cache_invalidated", workspace_id=workspace_id, entries=count)
        return count
