"""
Projects API endpoints with proper authentication and authorization.
All endpoints require authenticated user and verify project ownership.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import List
from uuid import UUID

from app.deps import get_session, get_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter()


@router.post("/projects", response_model=ProjectRead)
async def create_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Create a new project for the authenticated user.

    Requires authentication via X-User-ID header.
    Project is automatically associated with the authenticated user.
    """
    # Create project with user_id
    db_project = Project(
        **project.dict(),
        user_id=current_user.id
    )
    session.add(db_project)
    await session.commit()
    await session.refresh(db_project)
    return db_project


@router.get("/projects", response_model=List[ProjectRead])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    List all projects for the authenticated user.

    Users can only see their own projects.
    Requires authentication via X-User-ID header.
    """
    result = await session.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get a specific project.

    Requires authentication and project ownership.
    Users can only access their own projects.
    """
    project = await session.get(Project, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Authorization: verify project ownership
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this project"
        )

    return project


@router.patch("/projects/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Update a project.

    Requires authentication and project ownership.
    Users can only update their own projects.
    """
    project = await session.get(Project, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Authorization: verify project ownership
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this project"
        )

    update_data = project_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Delete a project.

    Requires authentication and project ownership.
    Users can only delete their own projects.
    """
    project = await session.get(Project, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Authorization: verify project ownership
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this project"
        )

    await session.delete(project)
    await session.commit()
