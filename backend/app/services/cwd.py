from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from typing import Optional
from uuid import UUID

from app.models import Project, Task, SubProject


async def parse_cwd(cwd: str, session: AsyncSession) -> Optional[UUID]:
    """
    Parse cwd format: project_name/task_name/sub_project_name
    Also handles: project_name/task_name (returns latest sub_project)
    Returns the sub_project_id if found
    """
    parts = cwd.split("/")
    if len(parts) < 2:
        return None
    
    project_name = parts[0]
    task_name = parts[1]
    # sub_project_name = parts[2]  # For now, we'll use the latest sub-project
    
    # Find project (get the most recent one if multiple exist)
    result = await session.execute(
        select(Project)
        .where(Project.name == project_name)
        .order_by(Project.created_at.desc())
        .limit(1)
    )
    project = result.scalar_one_or_none()
    if not project:
        return None
    
    # Find task
    result = await session.execute(
        select(Task)
        .where(Task.project_id == project.id)
        .where(Task.name == task_name)
    )
    task = result.scalar_one_or_none()
    if not task:
        return None
    
    # Find the latest sub-project for this task
    result = await session.execute(
        select(SubProject)
        .where(SubProject.task_id == task.id)
        .order_by(SubProject.created_at.desc())
        .limit(1)
    )
    sub_project = result.scalar_one_or_none()
    
    return sub_project.id if sub_project else None