from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import List, Annotated
from uuid import UUID

from app.deps import get_session
from app.models import Project
from app.models.user import User
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.core.auth import get_current_active_user

router = APIRouter()


@router.post("/projects", response_model=ProjectRead)
async def create_project(
    project: ProjectCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    db_project = Project(**project.dict())
    session.add(db_project)
    await session.commit()
    await session.refresh(db_project)
    return db_project


@router.get("/projects", response_model=List[ProjectRead])
async def list_projects(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = 0,
    limit: int = 100
):
    result = await session.execute(
        select(Project).offset(skip).limit(limit)
    )
    projects = result.scalars().all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return project


@router.patch("/projects/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
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
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    await session.delete(project)
    await session.commit()