from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import aiohttp
import os
import tempfile
from pathlib import Path

from app.deps import get_session, get_current_user
from app.models import Task, Project, DeploymentHook, SubProject, KnowledgeBaseFile, User
from app.schemas import TaskCreate, TaskRead, TaskUpdate
from app.services.deployment_service import deployment_service
from app.core.rate_limiter import RateLimitExceeded
from app.core.settings import get_settings

settings = get_settings()

router = APIRouter()


async def verify_task_ownership(task_id: UUID, current_user: User, session: AsyncSession) -> Task:
    """
    Verify that the current user owns the task through project ownership.
    Returns the task if authorized, raises HTTPException otherwise.
    """
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    project = await session.get(Project, task.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this task"
        )

    return task


@router.post("/tasks", response_model=TaskRead)
async def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Authorization: verify user owns the project
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create tasks in this project"
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
    except RateLimitExceeded as e:
        await session.delete(db_task)
        await session.commit()
        headers = {}
        if e.retry_after is not None and e.retry_after > 0:
            headers["Retry-After"] = str(e.retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
            headers=headers or None
        )
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Authorization: verify user owns the project
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this project's tasks"
        )

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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    task = await verify_task_ownership(task_id, current_user, session)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    task = await verify_task_ownership(task_id, current_user, session)
    
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    task = await verify_task_ownership(task_id, current_user, session)
    
    await session.delete(task)
    await session.commit()


@router.get("/tasks/{task_id}/deployment-hooks")
async def get_task_deployment_hooks(
    task_id: UUID,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get deployment hooks for a task"""
    task = await verify_task_ownership(task_id, current_user, session)
    
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Retry deployment initialization for a task"""
    task = await verify_task_ownership(task_id, current_user, session)
    
    if task.deployment_status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deployment already completed"
        )
    
    try:
        request_id = await deployment_service.initialize_project(session, task_id)
        return {"status": "initiated", "request_id": request_id}
    except RateLimitExceeded as e:
        headers = {}
        if e.retry_after is not None and e.retry_after > 0:
            headers["Retry-After"] = str(e.retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
            headers=headers or None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize deployment: {str(e)}"
        )


@router.get("/tasks/{task_id}/sub-projects")
async def get_task_sub_projects(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get all sub-projects for a task"""
    task = await verify_task_ownership(task_id, current_user, session)
    
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


@router.post("/tasks/{task_id}/knowledge-base/upload")
async def upload_to_task_knowledge_base(
    task_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Upload a file to task's .claude knowledge base folder"""
    # Get task and verify ownership
    task = await verify_task_ownership(task_id, current_user, session)

    project = await session.get(Project, task.project_id)
    
    # Read file content once and store it
    file_content = await file.read()
    
    # Prepare form data for Knowledge Base API
    form_data = aiohttp.FormData()
    form_data.add_field('file', file_content, filename=file.filename)
    form_data.add_field('organization_name', settings.org_name)
    form_data.add_field('project_path', f"{project.name}/{task.id}")
        
    # For now, skip the external API and use local storage directly
    # This can be uncommented when the external API has the Knowledge Base endpoints
    try:
        # Call the external Knowledge Base API
        async with aiohttp.ClientSession() as client:
            async with client.post(
                f"{settings.external_api_url}/knowledge-base/upload",
                data=form_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    # Save file details to database
                    kb_file = KnowledgeBaseFile(
                        task_id=task_id,
                        file_name=file.filename,
                        file_path=result.get('file_path', file.filename),
                        file_size=result.get('size_bytes', len(file_content)),
                        content_type=file.content_type
                    )
                    session.add(kb_file)
                    await session.commit()
                    await session.refresh(kb_file)
                    
                    # Add database info to response
                    result['id'] = str(kb_file.id)
                    result['uploaded_at'] = kb_file.uploaded_at.isoformat()
                    
                    return result
                else:
                    error_detail = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Knowledge Base API error: {error_detail}"
                    )
    except aiohttp.ClientError as e:
        try:
            # Create a temporary directory for the file
            temp_dir = tempfile.gettempdir()
            temp_kb_base = Path(temp_dir) / "cfpj_knowledge_base"
            temp_kb_base.mkdir(exist_ok=True)
            
            # Create the knowledge base structure
            kb_path = temp_kb_base / settings.org_name / project.name / f"{task.id}" / ".claude"
            kb_path.mkdir(parents=True, exist_ok=True)
            
            file_path = kb_path / file.filename
            
            # Save file using the content we already read
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            
            # Save file details to database
            kb_file = KnowledgeBaseFile(
                task_id=task_id,
                file_name=file.filename,
                file_path=file.filename,  # Simple path for now, can be nested later
                file_size=file_path.stat().st_size,
                content_type=file.content_type,
                temp_path=str(file_path)
            )
            session.add(kb_file)
            await session.commit()
            await session.refresh(kb_file)
            
            return {
                "id": str(kb_file.id),
                "file_name": kb_file.file_name,
                "file_path": kb_file.file_path,
                "size_bytes": kb_file.file_size,
                "content_type": kb_file.content_type,
                "uploaded_at": kb_file.uploaded_at.isoformat(),
                "status": "uploaded",
                "message": f"File stored in knowledge base"
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/tasks/{task_id}/knowledge-base/files")
async def list_task_knowledge_base_files(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """List all files in task's .claude knowledge base folder"""
    # Get task and verify ownership
    task = await verify_task_ownership(task_id, current_user, session)

    project = await session.get(Project, task.project_id)
    
    # Get knowledge base files from database
    try:
        stmt = select(KnowledgeBaseFile).where(KnowledgeBaseFile.task_id == task_id).order_by(KnowledgeBaseFile.uploaded_at.desc())
        result = await session.execute(stmt)
        kb_files = result.scalars().all()
        
        files = []
        for kb_file in kb_files:
            files.append({
                "id": str(kb_file.id),
                "file_name": kb_file.file_name,
                "file_path": kb_file.file_path,
                "size_bytes": kb_file.file_size,
                "content_type": kb_file.content_type,
                "uploaded_at": kb_file.uploaded_at.isoformat()
            })
        
        return {
            "files": files,
            "total_files": len(files)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list knowledge base files: {str(e)}"
        )


@router.get("/tasks/{task_id}/vscode-link")
async def get_task_vscode_link(
    task_id: UUID,
    file_path: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get VS Code tunnel link for the task"""
    # Get task and verify ownership
    task = await verify_task_ownership(task_id, current_user, session)
    
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Call the external VS Code API
    try:
        async with aiohttp.ClientSession() as client:
            payload = {
                "org_name": settings.org_name,
                "project_name": f"{project.name}/{task.id}"
            }
            if file_path:
                payload["file_path"] = file_path
                
            async with client.post(
                f"{settings.external_api_url}/vscode/generate-link",
                json=payload
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_detail = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"VS Code API error: {error_detail}"
                    )
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to generate VS Code link: {str(e)}"
        )


@router.get("/tasks/{task_id}/deployment-guide")
async def get_task_deployment_guide(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get deployment guide for a task"""
    task = await verify_task_ownership(task_id, current_user, session)
    
    return {
        "task_id": str(task_id),
        "content": task.deployment_guide or "",
        "updated_at": task.deployment_guide_updated_at.isoformat() if task.deployment_guide_updated_at else None
    }


@router.put("/tasks/{task_id}/deployment-guide")
async def update_task_deployment_guide(
    task_id: UUID,
    content_data: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update deployment guide for a task"""
    task = await verify_task_ownership(task_id, current_user, session)
    
    content = content_data.get('content', '')
    
    # Update the task
    task.deployment_guide = content
    task.deployment_guide_updated_at = datetime.utcnow()
    
    session.add(task)
    await session.commit()
    await session.refresh(task)
    
    return {
        "message": "Deployment guide updated successfully",
        "task_id": str(task_id),
        "content": task.deployment_guide,
        "updated_at": task.deployment_guide_updated_at.isoformat()
    }