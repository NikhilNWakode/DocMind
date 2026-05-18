"""Document summarization background task (FastAPI BackgroundTasks)."""

import uuid

import structlog

from app.infrastructure.database import async_session_factory
from app.infrastructure import llm_client
from app.repositories.document import DocumentRepository

logger = structlog.get_logger()

SUMMARIZATION_PROMPT = """You are a document summarization expert. Provide a concise, well-structured summary of the following document content.

Rules:
1. Capture the key themes, findings, and conclusions.
2. Use bullet points for clarity.
3. Keep the summary under 500 words.
4. Preserve important terminology and concepts.

Document content:
{content}

Provide a structured summary:"""


async def summarize_document(document_id: str) -> dict:
    """Generate an AI summary for a document — runs as a FastAPI background task."""
    doc_uuid = uuid.UUID(document_id)

    try:
        return await _summarize_async(doc_uuid)
    except Exception as exc:
        logger.error("summarization_failed", document_id=document_id, error=str(exc))
        raise


async def _summarize_async(document_id: uuid.UUID) -> dict:
    """Async implementation of document summarization."""
    async with async_session_factory() as session:
        repo = DocumentRepository(session)
        doc = await repo.get_with_chunks(document_id)
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        # Combine chunk content (limit to first ~8000 tokens worth)
        content_parts = []
        total_tokens = 0
        for chunk in sorted(doc.chunks, key=lambda c: c.chunk_index):
            content_parts.append(chunk.content)
            total_tokens += chunk.token_count
            if total_tokens > 6000:
                break

        full_content = "\n\n".join(content_parts)
        prompt = SUMMARIZATION_PROMPT.format(content=full_content)

        messages = [{"role": "user", "content": prompt}]
        summary = ""
        async for token in llm_client.stream_chat_completion(
            messages=messages,
            temperature=0.3,
            max_tokens=1000,
        ):
            summary += token

        # Store summary in document metadata
        metadata = doc.metadata_ or {}
        metadata["summary"] = summary
        doc.metadata_ = metadata
        await session.commit()

        logger.info("document_summarized", document_id=str(document_id), summary_length=len(summary))
        return {"status": "summarized", "summary_length": len(summary)}
