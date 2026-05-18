"""Document request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    file_type: str
    file_size: int
    page_count: int | None
    status: str
    chunk_count: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class DocumentStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    chunk_count: int
    error_message: str | None
    progress: dict | None = None
