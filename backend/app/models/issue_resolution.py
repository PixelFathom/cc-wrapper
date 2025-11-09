from sqlmodel import Field, Relationship, Column
from sqlalchemy import JSON, Text
from typing import Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .task import Task
    from .project import Project
    from .github_issue import GitHubIssue
    from .chat import Chat


class IssueResolution(BaseModel, table=True):
    """
    Tracks the resolution workflow for a GitHub issue.
    Links GitHub issues to tasks and manages the solution process.
    """
    __tablename__ = "issue_resolutions"

    # Foreign keys
    task_id: UUID = Field(foreign_key="tasks.id", index=True, nullable=False, unique=True)
    project_id: UUID = Field(foreign_key="projects.id", index=True, nullable=False)
    github_issue_id: Optional[UUID] = Field(default=None, foreign_key="github_issues.id", index=True)
    chat_id: Optional[UUID] = Field(default=None, foreign_key="chats.id", index=True)

    # Issue metadata (cached for quick access)
    issue_number: int = Field(index=True, nullable=False)
    issue_title: str = Field(max_length=500, nullable=False)
    issue_body: Optional[str] = Field(default=None, sa_column=Column(Text))
    issue_labels: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))

    # Resolution workflow state
    resolution_state: str = Field(
        default="pending",
        max_length=50,
        index=True
    )  # pending, initializing, analyzing, implementing, testing, ready_for_pr, pr_created, completed, failed

    # Four-stage workflow tracking
    current_stage: str = Field(
        default="deployment",
        max_length=50,
        index=True
    )  # deployment, planning, implementation, testing

    # Stage-specific session and chat tracking
    planning_session_id: Optional[str] = Field(default=None, max_length=255, index=True)
    planning_chat_id: Optional[UUID] = Field(default=None, foreign_key="chats.id")
    implementation_session_id: Optional[str] = Field(default=None, max_length=255, index=True)
    implementation_chat_id: Optional[UUID] = Field(default=None, foreign_key="chats.id")

    # Stage approval tracking
    planning_approved: bool = Field(default=False)
    planning_approval_by: Optional[UUID] = Field(default=None, foreign_key="users.id")
    planning_approval_at: Optional[datetime] = Field(default=None)

    # Stage completion flags
    deployment_complete: bool = Field(default=False)
    planning_complete: bool = Field(default=False)
    implementation_complete: bool = Field(default=False)
    testing_complete: bool = Field(default=False)

    # Resolution branch and PR info
    resolution_branch: Optional[str] = Field(default=None, max_length=255)
    pr_number: Optional[int] = Field(default=None, index=True)
    pr_url: Optional[str] = Field(default=None, max_length=500)
    pr_state: Optional[str] = Field(default=None, max_length=20)  # open, closed, merged

    # Auto-query tracking (kept for backward compatibility)
    auto_query_triggered: bool = Field(default=False)
    auto_query_session_id: Optional[str] = Field(default=None, max_length=255, index=True)
    auto_query_completed: bool = Field(default=False)

    # Solution metadata
    solution_approach: Optional[str] = Field(default=None, sa_column=Column(Text))
    files_changed: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    test_cases_generated: int = Field(default=0)
    test_cases_passed: int = Field(default=0)

    # Timestamps
    started_at: Optional[datetime] = Field(default=None)

    # Stage-specific timestamps
    deployment_started_at: Optional[datetime] = Field(default=None)
    deployment_completed_at: Optional[datetime] = Field(default=None)
    planning_started_at: Optional[datetime] = Field(default=None)
    planning_completed_at: Optional[datetime] = Field(default=None)
    implementation_started_at: Optional[datetime] = Field(default=None)
    implementation_completed_at: Optional[datetime] = Field(default=None)
    testing_started_at: Optional[datetime] = Field(default=None)
    testing_completed_at: Optional[datetime] = Field(default=None)

    # Legacy timestamps (kept for backward compatibility)
    analyzing_started_at: Optional[datetime] = Field(default=None)
    implementing_started_at: Optional[datetime] = Field(default=None)

    pr_created_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)

    # Error tracking
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    retry_count: int = Field(default=0)

    # Relationships
    task: "Task" = Relationship(back_populates="issue_resolution")
    project: "Project" = Relationship()
    github_issue: Optional["GitHubIssue"] = Relationship()
    # Remove ambiguous chat relationship - we have stage-specific chats
    # chat: Optional["Chat"] = Relationship()  # Removed due to multiple foreign keys

    # Stage-specific chat relationships (if needed, can be added with explicit foreign_keys)
    # planning_chat: Optional["Chat"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[IssueResolution.planning_chat_id]"})
    # implementation_chat: Optional["Chat"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[IssueResolution.implementation_chat_id]"})
