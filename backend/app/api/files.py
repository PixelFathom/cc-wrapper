from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile, Form
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pathlib import Path
import aiofiles
from uuid import UUID, uuid4
from typing import Optional

from app.deps import get_session
from app.models import File, SubProject
from app.services.cwd import parse_cwd
from app.services.file_upload_service import file_upload_service

router = APIRouter()

# Keep local upload dir for fallback
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload_file")
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    org_name: str = Form(...),
    cwd: str = Form(...),
    remote_path: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_session)
):
    """Upload file to remote server via temporary file"""
    sub_project_id = await parse_cwd(cwd, session)
    if not sub_project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cwd format"
        )
    
    sub_project = await session.get(SubProject, sub_project_id)
    if not sub_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-project not found"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Upload to remote server
        result = await file_upload_service.upload_file_to_remote(
            db=session,
            file_content=content,
            filename=file.filename,
            sub_project_id=sub_project_id,
            remote_path=remote_path
        )
        
        return {
            "file_id": result["file_id"],
            "filename": result["filename"],
            "remote_path": result["remote_path"],
            "message": "File uploaded successfully to remote server"
        }
        
    except Exception as e:
        # Fallback to local storage if remote upload fails
        print(f"Remote upload failed, falling back to local storage: {e}")
        
        file_id = uuid4()
        file_extension = Path(file.filename).suffix
        storage_path = UPLOAD_DIR / f"{file_id}{file_extension}"
        
        # Reset file position after reading
        await file.seek(0)
        content = await file.read()
        
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(content)
        
        db_file = File(
            sub_project_id=sub_project_id,
            filename=file.filename,
            storage_path=str(storage_path)
        )
        session.add(db_file)
        await session.commit()
        await session.refresh(db_file)
        
        return {
            "file_id": str(db_file.id),
            "filename": db_file.filename,
            "remote_path": str(storage_path),
            "message": "File uploaded locally (remote server unavailable)"
        }


@router.get("/files/{sub_project_id}")
async def list_files(
    sub_project_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """List files for a sub-project"""
    stmt = select(File).where(File.sub_project_id == sub_project_id)
    result = await session.execute(stmt)
    files = result.scalars().all()
    
    return {
        "files": [
            {
                "id": str(file.id),
                "filename": file.filename,
                "storage_path": file.storage_path,
                "created_at": file.created_at.isoformat()
            }
            for file in files
        ]
    }