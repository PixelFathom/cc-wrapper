from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional, TYPE_CHECKING
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .task import Task
    from .file import File
    from .chat import Chat
    from .approval import Approval


class SubProject(BaseModel, table=True):
    __tablename__ = "sub_projects"
    
    task_id: UUID = Field(foreign_key="tasks.id")
    
    task: Optional["Task"] = Relationship(back_populates="sub_projects")
    files: List["File"] = Relationship(back_populates="sub_project")
    chats: List["Chat"] = Relationship(back_populates="sub_project")
    approvals: List["Approval"] = Relationship(back_populates="sub_project")