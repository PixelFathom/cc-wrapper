import httpx
import logging
from typing import Dict, Any, Optional
from pathlib import Path
import aiofiles
import tempfile
import os
from uuid import UUID, uuid4

from app.core.settings import get_settings
from app.models import File, SubProject, Task, Project
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)


class FileUploadService:
    def __init__(self):
        self.settings = get_settings()
        self.org_name = self.settings.org_name
        self.upload_url = "http://host.docker.internal:8001/upload-file"  # Remote file upload endpoint
        
    async def upload_file_to_remote(
        self, 
        db: AsyncSession,
        file_content: bytes,
        filename: str,
        sub_project_id: UUID,
        remote_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Upload file to remote server"""
        try:
            # Get sub_project and related task/project for building the path
            sub_project = await db.get(SubProject, sub_project_id)
            if not sub_project:
                raise ValueError("SubProject not found")
                
            # Get task and project for building the full path
            task = await db.get(Task, sub_project.task_id)
            if not task:
                raise ValueError("Task not found")
                
            project = await db.get(Project, task.project_id)
            if not project:
                raise ValueError("Project not found")
            
            # Build the remote path
            base_path = f"{project.name}/{task.id}"
            if remote_path is None:
                # Default to files/ directory
                full_remote_path = f"{base_path}/files/{filename}"
            elif remote_path == "":
                # Empty string means root level
                full_remote_path = f"{base_path}/{filename}"
            else:
                # Custom path
                full_remote_path = f"{base_path}/{remote_path}/{filename}"
            
            # Create temporary file
            temp_file_path = None
            try:
                # Create a temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as temp_file:
                    temp_file.write(file_content)
                    temp_file_path = temp_file.name
                
                logger.info(f"Created temporary file: {temp_file_path}")
                
                # Prepare multipart upload
                async with httpx.AsyncClient(timeout=60.0) as client:
                    # Open the temporary file for reading
                    async with aiofiles.open(temp_file_path, 'rb') as f:
                        file_data = await f.read()
                    
                    files = {
                        'file': (filename, file_data, 'application/octet-stream')
                    }
                    
                    data = {
                        'organization_name': self.org_name,
                        'remote_path': full_remote_path
                    }
                    
                    logger.info(f"Uploading file to remote server: {full_remote_path}")
                    
                    response = await client.post(
                        self.upload_url,
                        files=files,
                        data=data
                    )
                    
                    logger.info(f"Upload response status: {response.status_code}")
                    
                    if response.status_code != 200:
                        logger.error(f"Upload failed: {response.text}")
                        raise Exception(f"Upload failed with status {response.status_code}")
                    
                    result = response.json()
                    logger.info(f"Upload successful: {result}")
                    
                    # Store file record in database
                    db_file = File(
                        sub_project_id=sub_project_id,
                        filename=filename,
                        storage_path=full_remote_path
                    )
                    db.add(db_file)
                    await db.commit()
                    await db.refresh(db_file)
                    
                    return {
                        "file_id": str(db_file.id),
                        "filename": filename,
                        "remote_path": full_remote_path,
                        "upload_result": result
                    }
                    
            finally:
                # Clean up temporary file
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                    
        except Exception as e:
            logger.error(f"Error uploading file to remote server: {e}")
            raise


# Create service instance
file_upload_service = FileUploadService()