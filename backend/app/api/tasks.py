from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
import aiohttp
import os
import tempfile
import base64
import logging
from pathlib import Path

from app.deps import get_session, get_current_user
from app.models import Task, Project, DeploymentHook, SubProject, KnowledgeBaseFile, User
from app.schemas import TaskCreate, TaskRead, TaskUpdate, VSCodeLinkResponse
from app.services.deployment_service import deployment_service
from app.services.knowledge_base_service import upload_to_knowledge_base
from app.services.coin_service import coin_service, InsufficientCoinsError
from app.core.rate_limiter import RateLimitExceeded
from app.core.settings import get_settings
from pydantic import BaseModel, Field

settings = get_settings()
logger = logging.getLogger(__name__)

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
    
    # Read file content once and store it
    file_content = await file.read()
    
    try:
        # Use knowledge base service utility (default to .claude folder)
        result = await upload_to_knowledge_base(
            session=session,
            task_id=task_id,
            file_content=file_content,
            filename=file.filename,
            content_type=file.content_type,
            file_path=None  # None means use default .claude folder
        )
        return result
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


@router.get("/tasks/{task_id}/vscode-link", response_model=VSCodeLinkResponse)
async def get_task_vscode_link(
    task_id: UUID,
    file_path: Optional[str] = None,
    user_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get VS Code tunnel link for the task.

    Args:
        task_id: UUID of the task
        file_path: Optional path to a specific file to open
        user_name: Optional GitHub username for tunnel naming

    Returns:
        VSCodeLinkResponse with tunnel information and optional authentication details:
        - If authentication required:
          {
            "tunnel_link": "https://vscode.dev/tunnel/portfolio_325c76d8-1d57-4d97-a7e",
            "tunnel_name": "portfolio_325c76d8-1d57-4d97-a7e",
            "authentication_required": true,
            "authentication_url": "https://github.com/login/device",
            "device_code": "ABCD-1234"
          }
        - If already authenticated:
          {
            "tunnel_link": "https://vscode.dev/tunnel/portfolio_325c76d8-1d57-4d97-a7e",
            "tunnel_name": "portfolio_325c76d8-1d57-4d97-a7e",
            "authentication_required": false,
            "authentication_url": null,
            "device_code": null
          }
    """
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
            if user_name:
                payload["user_name"] = user_name
            if file_path:
                payload["file_path"] = file_path

            async with client.post(
                f"{settings.external_api_url}/vscode/generate-link",
                json=payload
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return VSCodeLinkResponse(**result)
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


def parse_env_content(content: str) -> Dict[str, str]:
    """Parse .env file content and extract key-value pairs"""
    env_variables = {}
    lines = content.split('\n')
    
    for line in lines:
        # Remove leading/trailing whitespace
        line = line.strip()
        
        # Skip empty lines and comments
        if not line or line.startswith('#'):
            continue
        
        # Check if line contains '='
        if '=' not in line:
            continue
        
        # Split on first '=' only
        parts = line.split('=', 1)
        if len(parts) != 2:
            continue
        
        key = parts[0].strip()
        value = parts[1].strip()
        
        # Remove quotes if present
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        
        # Handle escaped quotes
        value = value.replace('\\"', '"').replace("\\'", "'")
        
        if key:
            env_variables[key] = value
    
    return env_variables


def format_env_content(env_variables: Dict[str, str]) -> str:
    """Convert key-value pairs to .env file format"""
    lines = []
    for key, value in sorted(env_variables.items()):
        # Escape special characters in value
        if not value:
            lines.append(f"{key}=")
        else:
            # If value contains spaces or special chars, quote it
            if ' ' in value or '=' in value or value.startswith('#') or '\n' in value:
                # Escape quotes and wrap in quotes
                escaped_value = value.replace('"', '\\"')
                lines.append(f'{key}="{escaped_value}"')
            else:
                lines.append(f"{key}={value}")
    return '\n'.join(lines)


async def read_env_file_from_project(project_path: str) -> Dict[str, str]:
    """Read .env file from project using read-file API"""
    try:
        async with aiohttp.ClientSession() as client:
            read_params = {
                'organization_name': settings.org_name,
                'project_name': project_path,
                'upload_location': 'main',
                'file_path': '.env'
            }
            
            read_response = await client.get(
                f"{settings.external_api_url}/project/read-file-legacy",
                params=read_params
            )

            if read_response.status == 404:
                # File doesn't exist yet, return empty dict
                return {}
            
            if read_response.status != 200:
                error_detail = await read_response.text()
                raise HTTPException(
                    status_code=read_response.status,
                    detail=f"Failed to read .env file: {error_detail}"
                )
            
            read_result = await read_response.json()
            base64_content = read_result.get('content', '')
            
            if not base64_content:
                return {}
            
            # Decode base64
            decoded_content = base64.b64decode(base64_content).decode('utf-8')
            
            # Parse .env content
            return parse_env_content(decoded_content)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read .env file: {str(e)}"
        )


async def write_env_file_to_project(
    session: AsyncSession,
    task_id: UUID,
    env_variables: Dict[str, str]
) -> None:
    """Write .env file to project using knowledge base upload service"""
    try:
        # Convert to .env format
        env_content = format_env_content(env_variables)
        env_bytes = env_content.encode('utf-8')
        
        # Use knowledge base upload service with file_path="/" for root level
        result = await upload_to_knowledge_base(
            session=session,
            task_id=task_id,
            file_content=env_bytes,
            filename='.env',
            content_type='text/plain',
            file_path="/"  # Root level upload for .env file
        )
        
        logger.info(f"Successfully uploaded .env file: {result.get('file_path')}")
        
    except HTTPException as e:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        # Convert ValueError to HTTPException
        logger.error(f"Error writing .env file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to write .env file: {str(e)}"
        )
    except Exception as e:
        # Convert any other exception to HTTPException
        logger.error(f"Error writing .env file: {e}", exc_info=True)
        error_msg = str(e)
        # Check if it's an upload failure
        if "Upload failed" in error_msg or "does not exist" in error_msg or "Target path" in error_msg or "Failed to upload" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to upload .env file: {error_msg}"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write .env file: {str(e)}"
        )


@router.post("/tasks/{task_id}/deployment/env-upload")
async def upload_deployment_env(
    task_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Upload .env file for deployment task, then read it back and parse"""
    task = await verify_task_ownership(task_id, current_user, session)
    
    if not file.filename or not file.filename.endswith('.env'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .env file"
        )
    
    # Read file content once and store it
    file_content = await file.read()
    
    # Build project path: project_name/task.id
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project_path = f"{project.name}/{task.id}"
    
    try:
        # Step 1: Upload .env file to knowledge base at root level (file_path="/")
        upload_result = await upload_to_knowledge_base(
            session=session,
            task_id=task_id,
            file_content=file_content,
            filename='.env',
            content_type=file.content_type,
            file_path="/"  # Root level upload for .env file
        )
        
        logger.info(f"Successfully uploaded .env file: {upload_result.get('file_path')}")
        
        # Step 2: Read file back using read-file API to parse it
        async with aiohttp.ClientSession() as client:
            read_params = {
                'organization_name': settings.org_name,
                'project_name': project_path,
                'upload_location': 'main',
                'file_path': '.env'
            }
            
            read_response = await client.get(
                f"{settings.external_api_url}/project/read-file-legacy",
                params=read_params
            )
            
            if read_response.status != 200:
                error_detail = await read_response.text()
                raise HTTPException(
                    status_code=read_response.status,
                    detail=f"Failed to read .env file: {error_detail}"
                )
            
            read_result = await read_response.json()
            
            # Step 3: Decode base64 content and parse
            base64_content = read_result.get('content', '')
            if not base64_content:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No content returned from read-file API"
                )
            
            # Decode base64
            try:
                decoded_content = base64.b64decode(base64_content).decode('utf-8')
            except Exception as decode_error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to decode file content: {str(decode_error)}"
                )
            
            # Parse .env content
            env_variables = parse_env_content(decoded_content)
            
            # Store file path and parsed variables
            task.env_file_path = '.env'  # Store relative path
            task.env_variables = env_variables
            
            session.add(task)
            await session.commit()
            await session.refresh(task)
            
            return {
                "message": "Environment file uploaded and parsed successfully",
                "task_id": str(task_id),
                "env_variables": env_variables,
                "file_path": task.env_file_path
            }
            
    except HTTPException:
        raise
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to external service: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process .env file: {str(e)}"
        )


@router.get("/tasks/{task_id}/deployment/env")
async def get_deployment_env(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get environment variables for a deployment task by reading from .env file"""
    task = await verify_task_ownership(task_id, current_user, session)
    
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Build project path: project_name/task.id
    project_path = f"{project.name}/{task.id}"
    
    try:
        # Read .env file from project
        env_variables = await read_env_file_from_project(project_path)
        
        # Update database with current values
        task.env_variables = env_variables
        task.env_file_path = ".env"
        session.add(task)
        await session.commit()
        
        return {
            "task_id": str(task_id),
            "env_variables": env_variables,
            "file_path": ".env",
            "has_env_file": len(env_variables) > 0
        }
    except HTTPException:
        raise
    except Exception as e:
        # If file doesn't exist or error, return empty
        return {
            "task_id": str(task_id),
            "env_variables": {},
            "file_path": ".env",
            "has_env_file": False
        }


@router.put("/tasks/{task_id}/deployment/env")
async def update_deployment_env(
    task_id: UUID,
    env_data: Dict[str, str] = Body(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update environment variables for a deployment task - reads existing .env, merges changes, and writes back"""
    task = await verify_task_ownership(task_id, current_user, session)
    
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Validate that env_data is a dictionary of string key-value pairs
    if not isinstance(env_data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="env_data must be a dictionary of key-value pairs"
        )
    
    # Ensure all values are strings
    validated_env = {}
    for key, value in env_data.items():
        if not isinstance(key, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"All keys must be strings, got {type(key).__name__} for key: {key}"
            )
        validated_env[key] = str(value) if value is not None else ""
    
    # Build project path: project_name/task.id
    project_path = f"{project.name}/{task.id}"
    
    # Ensure project is initialized (this will create the directory structure if needed)
    if not task.deployment_request_id:
        try:
            await deployment_service.initialize_project(session, task_id)
            await session.refresh(task)
            # Give it a moment for directory creation (init-project is async)
            import asyncio
            await asyncio.sleep(2)  # Wait longer for directory to be created
        except Exception as e:
            logger.warning(f"Project initialization warning: {e}")
            # Continue anyway - we'll try to write the file
    
    try:
        # Step 1: Try to read existing .env file from project (if it exists)
        existing_env = {}
        try:
            existing_env = await read_env_file_from_project(project_path)
        except HTTPException as e:
            # If file doesn't exist (404), start with empty dict
            if e.status_code == 404:
                existing_env = {}
            else:
                # For other errors, log but continue with empty dict
                logger.warning(f"Could not read existing .env file: {e.detail}")
                existing_env = {}
        except Exception as e:
            # Any other error, start with empty dict
            logger.warning(f"Error reading .env file: {e}")
            existing_env = {}
        
        # Step 2: Replace existing env with new values (frontend sends complete set)
        # This allows deletion of variables by not including them in the request
        final_env = validated_env
        
        # Step 3: Try to write .env file back to project
        # Retry logic in case directory is being created
        file_written = False
        max_retries = 3
        for attempt in range(max_retries):
            try:
                await write_env_file_to_project(session, task_id, final_env)
                file_written = True
                break
            except HTTPException as e:
                # If directory doesn't exist, wait and retry
                if ("does not exist" in str(e.detail) or "Target path" in str(e.detail) or "Upload failed" in str(e.detail)) and attempt < max_retries - 1:
                    logger.info(f"Directory not ready yet (attempt {attempt + 1}/{max_retries}), waiting and retrying...")
                    import asyncio
                    await asyncio.sleep(1)  # Wait 1 second before retry
                    continue
                elif "does not exist" in str(e.detail) or "Target path" in str(e.detail) or "Upload failed" in str(e.detail):
                    # Final attempt failed, store in DB only
                    logger.warning(f"Directory not ready after {max_retries} attempts, storing in database only")
                    file_written = False
                    break
                else:
                    # For other errors, still raise
                    raise
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Error writing .env file (attempt {attempt + 1}/{max_retries}): {e}, retrying...")
                    import asyncio
                    await asyncio.sleep(1)
                    continue
                else:
                    logger.warning(f"Error writing .env file after {max_retries} attempts: {e}")
                    file_written = False
                    break
        
        # Step 4: Always update database with final values
        task.env_variables = final_env
        task.env_file_path = ".env"
        session.add(task)
        await session.commit()
        await session.refresh(task)
        
        message = "Environment variables updated successfully"
        if not file_written:
            message += " (stored in database; file will be written when project directory is ready)"
        
        return {
            "message": message,
            "task_id": str(task_id),
            "env_variables": final_env,
            "file_path": task.env_file_path,
            "file_written": file_written
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update environment variables: {str(e)}"
        )


async def create_nginx_config(host: str, port: int) -> Dict[str, Any]:
    """Create nginx configuration using the nginx API"""
    # Remove protocol if present
    host_clean = host.replace("https://", "").replace("http://", "").strip()
    
    async with aiohttp.ClientSession() as client:
        async with client.post(
            f"{settings.nginx_api_url}/create-config",
            json={"port": port, "host_name": host_clean},
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            if response.status == 200:
                return await response.json()
            else:
                error_text = await response.text()
                raise HTTPException(
                    status_code=response.status,
                    detail=f"Failed to create nginx config: {error_text}"
                )


async def add_nginx_ssl(host: str, email: str = "admin@example.com") -> Dict[str, Any]:
    """Add SSL certificate using the nginx API"""
    # Remove protocol if present
    host_clean = host.replace("https://", "").replace("http://", "").strip()
    
    async with aiohttp.ClientSession() as client:
        async with client.post(
            f"{settings.nginx_api_url}/add-ssl",
            json={"host_name": host_clean, "email": email},
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            if response.status == 200:
                return await response.json()
            else:
                error_text = await response.text()
                raise HTTPException(
                    status_code=response.status,
                    detail=f"Failed to add SSL certificate: {error_text}"
                )


@router.post("/tasks/{task_id}/deployment/deploy")
async def deploy_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Deploy a task with docker setup and testing"""
    task = await verify_task_ownership(task_id, current_user, session)

    # Verify task has port number
    if not task.deployment_port:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task does not have a port number assigned. Please initialize the task first."
        )

    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Deduct coins for deployment (1 coin)
    DEPLOYMENT_COST = 1
    try:
        transaction = await coin_service.deduct_coins(
            session,
            current_user.id,
            DEPLOYMENT_COST,
            f"Deployment for task: {task.name}",
            reference_id=str(task_id),
            reference_type="deployment",
            meta_data={
                "task_id": str(task_id),
                "project_id": str(project.id),
            }
        )
    except InsufficientCoinsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_coins",
                "message": str(e).replace("coins", "credits").replace("Coins", "Credits"),
                "required": DEPLOYMENT_COST,
                "available": current_user.coins_balance,
                "subscription_tier": current_user.subscription_tier
            }
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Construct deployment instruction
    deployment_instruction = (
        f"Deploy the application following Docker best practices in DEVELOPMENT mode with hot reload:\n\n"
        f"1. SCOPE: Deploy ONLY the application within the current project directory. Do not modify or deploy unrelated services. Use the path in cwd only.\n\n"
        f"2. CHECK EXISTING DOCKER SETUP:\n"
        f"   - First, check if there's an existing Docker setup running: 'docker ps' and 'docker-compose ps'\n"
        f"   - If containers are already running for this project, verify they are healthy\n"
        f"   - If existing setup works, skip to SERVICE VALIDATION step\n"
        f"   - Only proceed with deployment if no existing setup or if it's not working properly\n\n"
        f"3. ENVIRONMENT SETUP:\n"
        f"   - Check for .env.example or similar environment template files\n"
        f"   - Create .env file with required variables if not present\n"
        f"   - Ensure all necessary environment variables are set (database URLs, API keys, ports, etc.)\n\n"
        f"4. DOCKER DEPLOYMENT (DEV MODE WITH HOT RELOAD):\n"
        f"   - If docker-compose.yml or docker-compose.dev.yml exists: Use 'docker compose up -d' (prefer dev config if available)\n"
        f"   - For dev mode, ensure volume mounts are configured for source code to enable hot reload\n"
        f"   - Example dev volume mount: './src:/app/src' or '.:/app' with node_modules excluded\n"
        f"   - If only Dockerfile exists: Build and run with volume mounts: 'docker run -v $(pwd):/app -p {task.deployment_port}:PORT IMAGE'\n"
        f"   - Ensure proper network configuration and port mapping to {task.deployment_port}\n"
        f"   - Use named volumes for data persistence (databases, caches)\n"
        f"   - Follow the application's documentation for Docker setup if available\n"
        f"   - Run migrations if necessary or seed data if necessary\n\n"
        f"5. SERVICE VALIDATION:\n"
        f"   - Wait for services to be healthy (use health checks if defined)\n"
        f"   - Verify the application is accessible at localhost:{task.deployment_port}\n"
        f"   - Check logs for any startup errors: 'docker compose logs' or 'docker logs <container>'\n\n"
        f"6. TESTING:\n"
        f"   - Test the deployed service via playwright MCP at port {task.deployment_port}\n"
        f"   - Verify all critical endpoints are responding correctly\n"
        f"   - Confirm the application is fully functional\n\n"
        f"7. CLEANUP:\n"
        f"   - Ensure no dangling containers or images are left behind\n"
        f"   - Document any manual steps required for deployment\n\n"
        f"IMPORTANT: Deploy only what's in scope. Use DEV mode configuration for hot reload support. Ensure the service is properly configured and thoroughly tested."
    )
    # Build CWD path
    cwd = f"{project.name}/{task.id}"
    
    # Webhook URL for deployment
    webhook_url = f"{settings.webhook_base_url}/api/webhooks/deployment/{task.id}/deployment"
    
    # Use existing deployment_request_id or generate new session
    session_id = task.deployment_request_id or None
    
    try:
        # Call query API with deployment instruction
        async with aiohttp.ClientSession() as client:
            payload = {
                "prompt": deployment_instruction,
                "webhook_url": webhook_url,
                "organization_name": settings.org_name,
                "project_path": cwd,
                "options": {
                    "permission_mode": "bypassPermissions"
                }
            }
            
            async with client.post(
                settings.query_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    deployment_session_id = result.get("session_id", session_id)
                    
                    # Update task deployment status
                    task.deployment_status = "deploying"
                    task.deployment_request_id = deployment_session_id
                    task.deployment_started_at = datetime.utcnow()
                    
                    session.add(task)
                    await session.commit()
                    await session.refresh(task)
                    
                    return {
                        "message": "Deployment started successfully",
                        "task_id": str(task_id),
                        "session_id": deployment_session_id,
                        "port": task.deployment_port,
                        "status": task.deployment_status
                    }
                else:
                    error_detail = await response.text()
                    logger.error(f"Failed to start deployment: {error_detail}")

                    # Refund coins on failure
                    await coin_service.refund_coins(
                        session,
                        current_user.id,
                        DEPLOYMENT_COST,
                        f"Refund for failed deployment: {task.name}",
                        reference_id=str(transaction.id),
                        meta_data={"original_transaction_id": str(transaction.id)}
                    )

                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to start deployment: {error_detail}"
                    )
    except aiohttp.ClientError as e:
        logger.error(f"Failed to connect to deployment service: {str(e)}")

        # Refund coins on connection failure
        await coin_service.refund_coins(
            session,
            current_user.id,
            DEPLOYMENT_COST,
            f"Refund for failed deployment (connection error): {task.name}",
            reference_id=str(transaction.id),
            meta_data={"original_transaction_id": str(transaction.id)}
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to deployment service: {str(e)}"
        )


class CommitAndPushRequest(BaseModel):
    """Request model for commit and push operation."""
    branch_name: str = Field(..., description="Branch name to commit and push to")
    commit_message: str = Field(..., description="Commit message")
    create_new_branch: bool = Field(default=True, description="Whether to create a new branch")


class CommitAndPushResponse(BaseModel):
    """Response model for commit and push operation."""
    task_id: str
    session_id: str
    message: str
    coin_transaction_id: str
    coins_remaining: int


@router.post("/tasks/{task_id}/commit-and-push", response_model=CommitAndPushResponse)
async def commit_and_push_task_changes(
    task_id: UUID,
    request: CommitAndPushRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Premium feature: Commit and push changes for a task.
    Costs 1 coin per operation.
    """
    # Verify task ownership
    task = await verify_task_ownership(task_id, current_user, session)

    # Get the project
    project = await session.get(Project, task.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check if task deployment is completed (initialization required)
    if not task.deployment_completed and task.deployment_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task deployment must be initialized and completed before committing changes"
        )

    # Deduct coins for this premium feature (1 coin)
    COMMIT_PUSH_COST = 1
    try:
        transaction = await coin_service.deduct_coins(
            session,
            current_user.id,
            COMMIT_PUSH_COST,
            f"Commit and push changes for task: {task.name}",
            reference_id=str(task_id),
            reference_type="commit_and_push",
            meta_data={
                "task_id": str(task_id),
                "project_id": str(project.id),
                "branch_name": request.branch_name,
                "commit_message": request.commit_message,
            }
        )
    except InsufficientCoinsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_coins",
                "message": str(e).replace("coins", "credits").replace("Coins", "Credits"),
                "required": COMMIT_PUSH_COST,
                "available": current_user.coins_balance,
                "subscription_tier": current_user.subscription_tier
            }
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Build CWD path (organization_name/project_path)
    cwd = f"{project.name}/{task.id}"

    # Webhook URL for commit and push status updates
    webhook_url = f"{settings.webhook_base_url}/api/webhooks/deployment/{task.id}/deployment"

    try:
        # Call external service to commit and push changes
        async with aiohttp.ClientSession() as client:
            payload = {
                "organization_name": settings.org_name,
                "project_path": cwd,
                "branch_name": request.branch_name,
                "commit_message": request.commit_message,
                "webhook_url": webhook_url,
                "create_new_branch": request.create_new_branch
            }

            push_url = f"{settings.external_api_url}/task/push-changes"
            logger.info(f"Calling push-changes API: {push_url}")
            logger.info(f"Payload: {payload}")

            async with client.post(
                push_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    session_id = result.get("session_id", str(task_id))

                    logger.info(f"Commit and push initiated successfully: {result}")

                    # Refresh current_user to get updated balance
                    await session.refresh(current_user)

                    return CommitAndPushResponse(
                        task_id=str(task_id),
                        session_id=session_id,
                        message="Commit and push initiated successfully",
                        coin_transaction_id=str(transaction.id),
                        coins_remaining=current_user.coins_balance
                    )
                else:
                    error_detail = await response.text()
                    logger.error(f"Failed to commit and push: {error_detail}")

                    # Refund coins on failure
                    await coin_service.refund_coins(
                        session,
                        current_user.id,
                        COMMIT_PUSH_COST,
                        f"Refund for failed commit and push: {task.name}",
                        reference_id=str(transaction.id),
                        meta_data={"original_transaction_id": str(transaction.id)}
                    )

                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to commit and push changes: {error_detail}"
                    )
    except aiohttp.ClientError as e:
        logger.error(f"Failed to connect to deployment service: {str(e)}")

        # Refund coins on connection failure
        await coin_service.refund_coins(
            session,
            current_user.id,
            COMMIT_PUSH_COST,
            f"Refund for failed commit and push (connection error): {task.name}",
            reference_id=str(transaction.id),
            meta_data={"original_transaction_id": str(transaction.id)}
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to deployment service: {str(e)}"
        )