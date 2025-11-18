from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
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
    from .issue_resolution import IssueResolution


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
    deployment_port: Optional[int] = Field(default=None)  # 5-digit port number (10000-99999)
    env_file_path: Optional[str] = Field(default=None)  # Path to uploaded .env file
    env_variables: Optional[Dict[str, str]] = Field(default=None, sa_column=Column(JSONB))  # Parsed key-value pairs from .env

    # Deployment guide fields
    deployment_guide: Optional[str] = Field(default=None)
    deployment_guide_updated_at: Optional[datetime] = Field(default=None)

    # Task workflow state fields (required by database schema)
    state: str = Field(default="pending", index=True)  # pending, context_gathering, planning, executing, completed, failed
    task_type: Optional[str] = Field(default=None)
    initial_description: str = Field(default="")
    refined_requirements: Optional[str] = Field(default=None)

    # Context gathering fields
    context_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    planning_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    execution_plan: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))

    # Progress tracking
    current_step: Optional[int] = Field(default=None)
    total_steps: Optional[int] = Field(default=None)
    progress_percentage: Optional[float] = Field(default=None)

    # Repository analysis
    repo_analysis: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    tech_stack: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    existing_patterns: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))

    # Timestamps for each phase
    context_gathering_started_at: Optional[datetime] = Field(default=None)
    context_gathering_completed_at: Optional[datetime] = Field(default=None)
    planning_started_at: Optional[datetime] = Field(default=None)
    planning_completed_at: Optional[datetime] = Field(default=None)
    execution_started_at: Optional[datetime] = Field(default=None)
    execution_completed_at: Optional[datetime] = Field(default=None)

    # Active session tracking
    active_planning_session_id: Optional[UUID] = Field(default=None)
    
    project: Optional["Project"] = Relationship(back_populates="tasks")
    sub_projects: List["SubProject"] = Relationship(back_populates="task")
    deployment_hooks: List["DeploymentHook"] = Relationship(back_populates="task")
    knowledge_base_files: List["KnowledgeBaseFile"] = Relationship(back_populates="task")
    test_cases: List["TestCase"] = Relationship(back_populates="task")
    contest_harvesting_sessions: List["ContestHarvestingSession"] = Relationship(back_populates="task")
    issue_resolution: Optional["IssueResolution"] = Relationship(back_populates="task")