from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON
from typing import List, Optional, TYPE_CHECKING, Dict, Any
from uuid import UUID
from datetime import datetime
from .base import BaseModel

if TYPE_CHECKING:
    from .project import Project
    from .sub_project import SubProject
    from .deployment_hook import DeploymentHook
    from .knowledge_base_file import KnowledgeBaseFile
    from .test_case import TestCase
    from .contest_harvesting import ContestHarvestingSession


class Task(BaseModel, table=True):
    __tablename__ = "tasks"
    
    name: str = Field(index=True)
    project_id: UUID = Field(foreign_key="projects.id")
    
    # MCP servers configuration
    mcp_servers: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSON))
    
    # Deployment fields
    deployment_status: str = Field(default="pending")  # pending, initializing, deploying, completed, failed
    deployment_request_id: Optional[str] = Field(default=None)
    deployment_completed: bool = Field(default=False)
    deployment_started_at: Optional[datetime] = Field(default=None)
    deployment_completed_at: Optional[datetime] = Field(default=None)
    
    # Deployment guide fields
    deployment_guide: Optional[str] = Field(default=None)
    deployment_guide_updated_at: Optional[datetime] = Field(default=None)
    
    project: Optional["Project"] = Relationship(back_populates="tasks")
    sub_projects: List["SubProject"] = Relationship(back_populates="task")
    deployment_hooks: List["DeploymentHook"] = Relationship(back_populates="task")
    knowledge_base_files: List["KnowledgeBaseFile"] = Relationship(back_populates="task")
    test_cases: List["TestCase"] = Relationship(back_populates="task")
    contest_harvesting_sessions: List["ContestHarvestingSession"] = Relationship(back_populates="task")