from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import List
from uuid import UUID

from app.deps import get_session
from app.models import Task, Project, DeploymentHook, SubProject
from app.schemas import TaskCreate, TaskRead, TaskUpdate
from app.services.deployment_service import deployment_service

router = APIRouter()


@router.post("/tasks", response_model=TaskRead)
async def create_task(
    task: TaskCreate,
    session: AsyncSession = Depends(get_session)
):
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db_task = Task(**task.dict())
    session.add(db_task)
    await session.commit()
    await session.refresh(db_task)
    
    # Automatically initialize deployment for new task
    try:
        print(f"Initializing deployment for task {db_task.id}")
        await deployment_service.initialize_project(session, db_task.id)
        print(f"Deployment initialization completed for task {db_task.id}")
    except Exception as e:
        # Log error but don't fail task creation
        print(f"Failed to initialize deployment: {e}")
        import traceback
        traceback.print_exc()
    
    return db_task


@router.get("/projects/{project_id}/tasks", response_model=List[TaskRead])
async def list_tasks(
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    tasks = result.scalars().all()
    return tasks


@router.get("/tasks/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    return task


@router.patch("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    task_update: TaskUpdate,
    session: AsyncSession = Depends(get_session)
):
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    await session.delete(task)
    await session.commit()


@router.get("/tasks/{task_id}/deployment-hooks")
async def get_task_deployment_hooks(
    task_id: UUID,
    limit: int = 20,
    session: AsyncSession = Depends(get_session)
):
    """Get deployment hooks for a task"""
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    hooks = await deployment_service.get_deployment_hooks(session, task_id, limit)
    return {
        "task_id": task_id,
        "deployment_status": task.deployment_status,
        "deployment_completed": task.deployment_completed,
        "hooks": hooks
    }


@router.post("/tasks/{task_id}/retry-deployment")
async def retry_task_deployment(
    task_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Retry deployment initialization for a task"""
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    if task.deployment_status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deployment already completed"
        )
    
    try:
        request_id = await deployment_service.initialize_project(session, task_id)
        return {"status": "initiated", "request_id": request_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize deployment: {str(e)}"
        )


@router.get("/tasks/{task_id}/sub-projects")
async def get_task_sub_projects(
    task_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get all sub-projects for a task"""
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    result = await session.execute(
        select(SubProject)
        .where(SubProject.task_id == task_id)
        .order_by(SubProject.created_at.desc())
    )
    sub_projects = result.scalars().all()
    
    # If no sub-projects exist, create one
    if not sub_projects:
        sub_project = SubProject(task_id=task_id)
        session.add(sub_project)
        await session.commit()
        await session.refresh(sub_project)
        sub_projects = [sub_project]
    
    return {
        "task_id": task_id,
        "sub_projects": [
            {
                "id": str(sub_project.id),
                "created_at": sub_project.created_at.isoformat()
            }
            for sub_project in sub_projects
        ]
    }