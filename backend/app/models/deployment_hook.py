from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, TYPE_CHECKING, Dict, Any
from uuid import UUID
from datetime import datetime
from .base import BaseModel

if TYPE_CHECKING:
    from .task import Task


class DeploymentHook(BaseModel, table=True):
    __tablename__ = "deployment_hooks"
    
    task_id: UUID = Field(foreign_key="tasks.id", index=True)
    session_id: str = Field(index=True)
    hook_type: str = Field(default="init_project")  # init_project, status, completion, error
    phase: str = Field(default="initialization")  # initialization, deployment - distinguishes between init and deploy logs
    status: str = Field(default="received")  # received, processing, completed, failed
    data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    message: Optional[str] = Field(default=None)
    is_complete: bool = Field(default=False)
    received_at: datetime = Field(default_factory=datetime.utcnow)
    
    task: Optional["Task"] = Relationship(back_populates="deployment_hooks")