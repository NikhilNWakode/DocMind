"""Chat request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=5000)
    workspace_id: uuid.UUID
    conversation_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None  # Filter retrieval to a specific document


class CitationSchema(BaseModel):
    document_title: str
    document_id: str
    page_number: int | None
    chunk_content: str
    relevance_score: float | None = None


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    response: str
    citations: list[CitationSchema]
    model: str
    latency_ms: int


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: dict | None
    model: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: str
    workspace_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    conversations: list[ConversationResponse]
    total: int
