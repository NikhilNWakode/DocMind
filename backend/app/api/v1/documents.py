"""Document API routes — upload triggers async background processing."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile

from app.api.deps import get_current_user, get_document_service
from app.models.user import User
from app.schemas.document import DocumentListResponse, DocumentResponse, DocumentStatusResponse
from app.services.document import DocumentService

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    workspace_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    doc_service: DocumentService = Depends(get_document_service),
):
    """Upload a document for processing.

    Returns 202 Accepted — document processing runs in the background.
    The frontend can poll /status or subscribe to SSE progress events.
    """
    # Extract file extension
    file_name = file.filename or "untitled"
    file_type = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "txt"

    # Read file content
    content = await file.read()

    # Upload and create document record (stores in S3 + DB)
    doc_response = await doc_service.upload_document(
        workspace_id=workspace_id,
        file_name=file_name,
        file_content=content,
        file_type=file_type,
    )

    # Dispatch background task for ingestion
    from app.tasks.ingestion import process_document
    background_tasks.add_task(process_document, str(doc_response.id))

    return doc_response


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    workspace_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    doc_service: DocumentService = Depends(get_document_service),
):
    """List documents in a workspace."""
    docs, total = await doc_service.list_documents(workspace_id, skip, limit)
    return DocumentListResponse(documents=docs, total=total)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    doc_service: DocumentService = Depends(get_document_service),
):
    """Get document details."""
    return await doc_service.get_document(document_id)


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    doc_service: DocumentService = Depends(get_document_service),
):
    """Get document processing status with progress info."""
    return await doc_service.get_document_status(document_id)


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    doc_service: DocumentService = Depends(get_document_service),
):
    """Delete a document, its vectors, and its stored file."""
    await doc_service.delete_document(document_id)


