import aiohttp
import tempfile
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from uuid import UUID
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.settings import get_settings
from app.models import KnowledgeBaseFile, Task, Project

logger = logging.getLogger(__name__)
settings = get_settings()


async def upload_to_knowledge_base(
    session: AsyncSession,
    task_id: UUID,
    file_content: bytes,
    filename: str,
    content_type: Optional[str] = None,
    file_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload a file to task's knowledge base (.claude folder)
    
    Args:
        session: Database session
        task_id: Task ID
        file_content: File content as bytes
        filename: Name of the file
        content_type: MIME type of the file
        file_path: Optional file path within knowledge base (e.g., "/" for root, ".claude" for default)
    
    Returns:
        Dictionary with upload result including file details
    """
    # Get task and project
    task = await session.get(Task, task_id)
    if not task:
        raise ValueError("Task not found")
    
    project = await session.get(Project, task.project_id)
    if not project:
        raise ValueError("Project not found")
    
    # Determine the file path - use "/" for root, or default to ".claude" folder
    if file_path == "/":
        # Root level upload
        kb_folder = ""
        api_file_path = filename
        api_file_path_param = "/"
    else:
        # Default to .claude folder
        kb_folder = ".claude"
        api_file_path = f".claude/{filename}" if file_path is None else file_path
        api_file_path_param = None  # Don't send file_path param for default .claude folder
    
    # Prepare form data for Knowledge Base API
    form_data = aiohttp.FormData()
    form_data.add_field('file', file_content, filename=filename)
    form_data.add_field('organization_name', settings.org_name)
    form_data.add_field('project_path', f"{project.name}/{task.id}")
    if api_file_path_param:
        form_data.add_field('file_path', api_file_path_param)
    
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
                        file_name=filename,
                        file_path=result.get('file_path', api_file_path),
                        file_size=result.get('size_bytes', len(file_content)),
                        content_type=content_type
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
                    raise Exception(f"Knowledge Base API error: {error_detail}")
                    
    except aiohttp.ClientError as e:
        logger.warning(f"Knowledge Base API unavailable, using local fallback: {e}")
        # Fallback to local storage
        try:
            # Create a temporary directory for the file
            temp_dir = tempfile.gettempdir()
            temp_kb_base = Path(temp_dir) / "cfpj_knowledge_base"
            temp_kb_base.mkdir(exist_ok=True)
            
            # Create the knowledge base structure
            if file_path == "/":
                # Root level
                kb_path = temp_kb_base / settings.org_name / project.name / f"{task.id}"
            else:
                # Default .claude folder
                kb_path = temp_kb_base / settings.org_name / project.name / f"{task.id}" / ".claude"
            
            kb_path.mkdir(parents=True, exist_ok=True)
            
            file_path_obj = kb_path / filename
            
            # Save file
            with open(file_path_obj, "wb") as buffer:
                buffer.write(file_content)
            
            # Save file details to database
            kb_file = KnowledgeBaseFile(
                task_id=task_id,
                file_name=filename,
                file_path=api_file_path,
                file_size=file_path_obj.stat().st_size,
                content_type=content_type,
                temp_path=str(file_path_obj)
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
            logger.error(f"Failed to upload file to knowledge base: {e}")
            raise Exception(f"Failed to upload file: {str(e)}")

