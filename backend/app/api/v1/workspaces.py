"""Workspace API routes."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import AuthorizationError, NotFoundError
from app.infrastructure.database import get_db
from app.models.user import User
from app.repositories.workspace import WorkspaceRepository
from app.schemas.workspace import WorkspaceCreate, WorkspaceListResponse, WorkspaceResponse

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    request: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace."""
    repo = WorkspaceRepository(db)
    workspace = await repo.create(
        name=request.name,
        owner_id=current_user.id,
        description=request.description,
    )
    await db.commit()
    doc_count = 0
    response = WorkspaceResponse.model_validate(workspace)
    response.document_count = doc_count
    return response


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all workspaces owned by the current user."""
    repo = WorkspaceRepository(db)
    workspaces = await repo.list_by_owner(current_user.id)
    result = []
    for ws in workspaces:
        doc_count = await repo.get_document_count(ws.id)
        response = WorkspaceResponse.model_validate(ws)
        response.document_count = doc_count
        result.append(response)
    return WorkspaceListResponse(workspaces=result, total=len(result))


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get workspace details."""
    repo = WorkspaceRepository(db)
    workspace = await repo.get_by_id(workspace_id)
    if not workspace:
        raise NotFoundError("Workspace", str(workspace_id))
    if workspace.owner_id != current_user.id:
        raise AuthorizationError()
    doc_count = await repo.get_document_count(workspace_id)
    response = WorkspaceResponse.model_validate(workspace)
    response.document_count = doc_count
    return response


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a workspace and all its documents."""
    repo = WorkspaceRepository(db)
    workspace = await repo.get_by_id(workspace_id)
    if not workspace:
        raise NotFoundError("Workspace", str(workspace_id))
    if workspace.owner_id != current_user.id:
        raise AuthorizationError()
    await repo.delete(workspace)
    await db.commit()
