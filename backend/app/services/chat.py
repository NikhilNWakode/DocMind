"""Chat service — RAG query pipeline with retrieval and streaming."""

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


@dataclass
class StreamEvent:
    """An event in the response stream."""
    type: str  # "token", "citations", "metadata", "done", "error", "start"
    content: str = ""
    data: dict | None = None


class ChatService:
    """Orchestrates the RAG query pipeline — simplified for reliability."""

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

    async def query_stream(
        self,
        query: str,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID | None = None,
        document_id: uuid.UUID | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Execute RAG pipeline and stream the response."""
        start_time = time.time()

        # Step 1: Get or create conversation
        if conversation_id:
            conversation = await self.conv_repo.get_by_id(conversation_id)
            if not conversation:
                raise NotFoundError("Conversation", str(conversation_id))
            # Use the conversation's linked document_id if not explicitly passed
            if document_id is None and conversation.document_id:
                document_id = conversation.document_id
        else:
            conversation = await self.conv_repo.create(
                workspace_id=workspace_id,
                user_id=user_id,
                title=query[:100],
                document_id=document_id,
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

        # Step 3: Retrieve relevant chunks (with error handling)
        logger.info("retrieving_context", query=query[:100], workspace_id=str(workspace_id))
        retrieved_chunks = []

        try:
            query_embedding = self.embedding_service.embed_query(query)
            doc_filter = [str(document_id)] if document_id else None
            retrieved_chunks = self.vector_store.search(
                workspace_id=str(workspace_id),
                query_vector=query_embedding,
                top_k=settings.retrieval_top_k,
                document_ids=doc_filter,
            )
        except Exception as e:
            logger.error("retrieval_failed", error=str(e))
            # Don't crash — just proceed with no context

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

        # Step 4: Build context from retrieved chunks
        context = self._build_context(retrieved_chunks)

        # Step 5: Get recent conversation history
        history = await self._get_conversation_history(conversation_id)

        # Step 6: Build messages for LLM
        messages = self._build_messages(query, context, history)

        # Step 7: Stream LLM response
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
            error_content = f"AI generation failed: {str(e)}"
            yield StreamEvent(type="error", content=error_content)

            await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=error_content,
            )
            await self.db.commit()
            return

        # Step 8: Extract and yield citations
        citations = self._extract_citations(retrieved_chunks)
        yield StreamEvent(
            type="citations",
            data={"citations": [c.model_dump() for c in citations]},
        )

        # Step 9: Metadata
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

        # Step 10: Save assistant message
        await self.conv_repo.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=full_response,
            citations={"sources": [c.model_dump() for c in citations]},
            model=settings.llm_model,
            latency_ms=latency_ms,
        )
        await self.db.commit()

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
            context_parts.append(f"{source}\n{chunk['content']}")
        return "\n\n---\n\n".join(context_parts)

    async def _get_conversation_history(
        self, conversation_id: uuid.UUID, max_turns: int = 6
    ) -> list[dict[str, str]]:
        """Get recent conversation history (simple truncation, no summarization)."""
        messages = await self.conv_repo.get_messages(conversation_id, limit=max_turns + 1)

        if not messages:
            return []

        # Exclude the just-added user message (last one)
        all_history = [{"role": msg.role, "content": msg.content} for msg in messages[:-1]]
        return all_history[-max_turns:]

    def _build_messages(
        self, query: str, context: str, history: list[dict[str, str]]
    ) -> list[dict[str, str]]:
        """Build the full message list for the LLM."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add recent conversation history
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
                    relevance_score=chunk.get("score"),
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
                "document_id": str(conv.document_id) if conv.document_id else None,
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
