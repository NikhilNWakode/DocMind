"""Chat service — RAG query pipeline with hybrid retrieval, reranking, and semantic caching."""

import time
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass

import structlog
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import NotFoundError
from app.infrastructure import llm_client
from app.repositories.conversation import ConversationRepository
from app.schemas.chat import CitationSchema
from app.services.embedding import EmbeddingService
from app.services.hybrid_retriever import HybridRetriever
from app.services.reranker import RerankerService
from app.services.semantic_cache import SemanticCache
from app.services.vector_store import VectorStoreService

logger = structlog.get_logger()
settings = get_settings()

SYSTEM_PROMPT = """You are DocMind, an intelligent document analysis assistant. Your role is to answer
questions accurately using ONLY the provided document context.

Rules:
1. Base your answers ONLY on the provided context. Do not use prior knowledge.
2. For each claim or fact, cite the source using [Source: document_title, Page N] format.
3. If the context doesn't contain enough information to answer, say so explicitly.
4. Be concise but thorough. Use structured formatting (bullets, headers) when helpful.
5. If multiple documents contain relevant information, synthesize across them.
6. Never fabricate information or citations.
7. When asked to summarize, provide a clear overview of the key points from the context."""

SUMMARY_PROMPT = """Summarize the following conversation in 2-3 sentences, preserving the key topics discussed and any important conclusions:

{conversation}

Summary:"""


@dataclass
class StreamEvent:
    """An event in the response stream."""

    type: str  # "token", "citations", "metadata", "done", "error", "cache_hit"
    content: str = ""
    data: dict | None = None


class ChatService:
    """Orchestrates the RAG query pipeline with Phase 2 improvements."""

    def __init__(
        self,
        db: AsyncSession,
        vector_store: VectorStoreService,
        redis: Redis | None = None,
    ):
        self.db = db
        self.conv_repo = ConversationRepository(db)
        self.vector_store = vector_store
        self.redis = redis
        self.embedding_service = EmbeddingService()

        # Phase 2: Hybrid retrieval with reranking (lazy reranker)
        self._reranker = None
        self.retriever = HybridRetriever(
            vector_store=vector_store,
            embedding_service=self.embedding_service,
            reranker=None,  # Loaded lazily on first query
        )

        # Phase 2: Semantic cache
        self.cache = SemanticCache(redis, self.embedding_service) if redis else None

    async def query_stream(
        self,
        query: str,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Execute the full RAG pipeline and stream the response."""
        start_time = time.time()

        # Step 1: Get or create conversation
        if conversation_id:
            conversation = await self.conv_repo.get_by_id(conversation_id)
            if not conversation:
                raise NotFoundError("Conversation", str(conversation_id))
        else:
            conversation = await self.conv_repo.create(
                workspace_id=workspace_id,
                user_id=user_id,
                title=query[:100],
            )
            await self.db.commit()

        conversation_id = conversation.id

        yield StreamEvent(
            type="start",
            data={"conversation_id": str(conversation_id)},
        )

        # Step 2: Save user message
        await self.conv_repo.add_message(
            conversation_id=conversation_id,
            role="user",
            content=query,
        )
        await self.db.commit()

        # Step 3: Check semantic cache
        if self.cache:
            cached = await self.cache.get(query, str(workspace_id))
            if cached:
                logger.info("cache_hit", query=query[:60])
                cached_response = cached.get("response", "")
                cached_citations = cached.get("citations", [])

                yield StreamEvent(type="cache_hit", data={"cached": True})

                # Stream cached response (simulate streaming for consistent UX)
                words = cached_response.split(" ")
                for i in range(0, len(words), 3):
                    chunk = " ".join(words[i:i + 3]) + " "
                    yield StreamEvent(type="token", content=chunk)

                # Yield citations
                citations = [CitationSchema(**c) for c in cached_citations]
                yield StreamEvent(
                    type="citations",
                    data={"citations": [c.model_dump() for c in citations]},
                )

                latency_ms = int((time.time() - start_time) * 1000)
                yield StreamEvent(
                    type="metadata",
                    data={
                        "model": cached.get("model", settings.llm_model),
                        "latency_ms": latency_ms,
                        "chunks_used": len(cached_citations),
                        "cache_hit": True,
                    },
                )

                # Save assistant message
                await self.conv_repo.add_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=cached_response,
                    citations={"sources": cached_citations},
                    model=cached.get("model", settings.llm_model),
                    latency_ms=latency_ms,
                )
                await self.db.commit()

                yield StreamEvent(type="done")
                return

        # Step 4: Retrieve relevant chunks using hybrid retrieval
        logger.info("retrieving_context", query=query[:100], workspace_id=str(workspace_id))

        # Lazy-load reranker only when actually doing retrieval
        if settings.enable_reranking and self.retriever.reranker is None:
            if self._reranker is None:
                self._reranker = RerankerService()
            self.retriever.reranker = self._reranker

        retrieved_chunks = await self.retriever.retrieve(
            query=query,
            workspace_id=str(workspace_id),
            top_k=settings.retrieval_top_k,
            rerank_top_k=settings.rerank_top_k,
        )

        if not retrieved_chunks:
            error_msg = "No relevant documents found. Please upload documents to this workspace first."
            yield StreamEvent(type="token", content=error_msg)
            yield StreamEvent(type="done")

            await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=error_msg,
            )
            await self.db.commit()
            return

        # Step 5: Build context from retrieved chunks
        context = self._build_context(retrieved_chunks)

        # Step 6: Get conversation history with summary for long conversations
        history = await self._get_conversation_history(conversation_id)

        # Step 7: Build messages for LLM
        messages = self._build_messages(query, context, history)

        # Step 8: Stream LLM response
        full_response = ""
        try:
            async for token in llm_client.stream_chat_completion(
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
            ):
                full_response += token
                yield StreamEvent(type="token", content=token)
        except Exception as e:
            logger.error("llm_stream_error", error=str(e))
            yield StreamEvent(type="error", content=f"AI generation failed: {str(e)}")
            return

        # Step 9: Extract and yield citations
        citations = self._extract_citations(retrieved_chunks)
        yield StreamEvent(
            type="citations",
            data={"citations": [c.model_dump() for c in citations]},
        )

        # Step 10: Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)

        yield StreamEvent(
            type="metadata",
            data={
                "model": settings.llm_model,
                "latency_ms": latency_ms,
                "chunks_used": len(retrieved_chunks),
                "cache_hit": False,
            },
        )

        # Step 11: Save assistant message
        await self.conv_repo.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=full_response,
            citations={"sources": [c.model_dump() for c in citations]},
            model=settings.llm_model,
            latency_ms=latency_ms,
        )
        await self.db.commit()

        # Step 12: Cache the response for future similar queries
        if self.cache:
            await self.cache.set(
                query=query,
                workspace_id=str(workspace_id),
                response=full_response,
                citations=[c.model_dump() for c in citations],
                model=settings.llm_model,
            )

        yield StreamEvent(type="done")

        logger.info(
            "query_completed",
            conversation_id=str(conversation_id),
            latency_ms=latency_ms,
            chunks_used=len(retrieved_chunks),
            response_length=len(full_response),
        )

    def _build_context(self, chunks: list[dict]) -> str:
        """Build context string from retrieved chunks."""
        context_parts = []
        for chunk in chunks:
            source = f"[Source: {chunk['document_title']}, Page {chunk.get('page_number', 'N/A')}]"
            score_info = ""
            if chunk.get("rerank_score") is not None:
                score_info = f" (relevance: {chunk['rerank_score']:.3f})"
            elif chunk.get("rrf_score") is not None:
                score_info = f" (RRF: {chunk['rrf_score']:.4f})"
            context_parts.append(f"{source}{score_info}\n{chunk['content']}")
        return "\n\n---\n\n".join(context_parts)

    async def _get_conversation_history(
        self, conversation_id: uuid.UUID, max_turns: int = 6
    ) -> list[dict[str, str]]:
        """Get recent conversation history with summary for long conversations.

        For conversations longer than max_turns, generates a summary of older
        messages and prepends it to the recent turns.
        """
        messages = await self.conv_repo.get_messages(conversation_id, limit=max_turns + 5)

        # Exclude the just-added user message (last one)
        if not messages:
            return []

        all_history = [{"role": msg.role, "content": msg.content} for msg in messages[:-1]]

        if len(all_history) <= max_turns:
            return all_history

        # For long conversations: summarize older messages
        if settings.enable_conversation_summary:
            older = all_history[:-max_turns]
            recent = all_history[-max_turns:]

            # Generate summary of older messages
            summary = await self._summarize_history(older)
            if summary:
                context_msg = {
                    "role": "system",
                    "content": f"Previous conversation summary: {summary}",
                }
                return [context_msg] + recent
            return recent

        return all_history[-max_turns:]

    async def _summarize_history(self, messages: list[dict[str, str]]) -> str:
        """Generate a brief summary of conversation history."""
        conversation_text = ""
        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            conversation_text += f"{role}: {msg['content'][:200]}\n"

        prompt = SUMMARY_PROMPT.format(conversation=conversation_text)

        summary = ""
        try:
            async for token in llm_client.stream_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150,
            ):
                summary += token
        except Exception as e:
            logger.warning("history_summary_failed", error=str(e))
            return ""

        return summary.strip()

    def _build_messages(
        self, query: str, context: str, history: list[dict[str, str]]
    ) -> list[dict[str, str]]:
        """Build the full message list for the LLM."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add conversation history (includes summary for long conversations)
        messages.extend(history[-6:])

        # Add current query with context
        user_message = f"""Context from documents:
{context}

---

User question: {query}

Provide a thorough answer based on the context above. Cite sources using [Source: title, Page N] format."""

        messages.append({"role": "user", "content": user_message})
        return messages

    def _extract_citations(self, chunks: list[dict]) -> list[CitationSchema]:
        """Convert retrieved chunks to citation objects."""
        citations = []
        seen_docs = set()

        for chunk in chunks:
            doc_key = (chunk["document_id"], chunk.get("page_number"))
            if doc_key in seen_docs:
                continue
            seen_docs.add(doc_key)

            citations.append(
                CitationSchema(
                    document_title=chunk["document_title"],
                    document_id=chunk["document_id"],
                    page_number=chunk.get("page_number"),
                    chunk_content=chunk["content"][:200],
                    relevance_score=chunk.get("rerank_score") or chunk.get("score"),
                )
            )
        return citations

    async def get_conversations(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[dict]:
        """List conversations for a workspace."""
        conversations = await self.conv_repo.list_by_workspace(workspace_id, user_id)
        result = []
        for conv in conversations:
            msg_count = await self.conv_repo.get_message_count(conv.id)
            result.append({
                "id": str(conv.id),
                "title": conv.title,
                "workspace_id": str(conv.workspace_id),
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
                "message_count": msg_count,
            })
        return result

    async def get_messages(self, conversation_id: uuid.UUID) -> list[dict]:
        """Get all messages for a conversation."""
        messages = await self.conv_repo.get_messages(conversation_id, limit=100)
        return [
            {
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "citations": msg.citations,
                "model": msg.model,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in messages
        ]

    async def delete_conversation(self, conversation_id: uuid.UUID) -> None:
        """Delete a conversation and all its messages."""
        conv = await self.conv_repo.get_by_id(conversation_id)
        if not conv:
            raise NotFoundError("Conversation", str(conversation_id))
        await self.conv_repo.delete(conv)
        await self.db.commit()
