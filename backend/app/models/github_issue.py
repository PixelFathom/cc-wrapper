from sqlmodel import Field, Relationship, Column
from sqlalchemy import JSON, BigInteger
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .github_repository import GitHubRepository
    from .task import Task


class GitHubIssue(BaseModel, table=True):
    """
    Cached GitHub issue data for quick access and task generation.
    Synced from GitHub API and linked to generated tasks.
    """
    __tablename__ = "github_issues"

    repository_id: UUID = Field(foreign_key="github_repositories.id", index=True, nullable=False)

    # GitHub issue identity (use BigInteger for GitHub IDs that exceed int32 range)
    github_issue_id: int = Field(sa_column=Column(BigInteger, index=True, nullable=False))
    github_issue_number: int = Field(index=True, nullable=False)

    # Issue content
    title: str = Field(max_length=500, nullable=False)
    body: Optional[str] = Field(default=None)
    state: str = Field(max_length=20, nullable=False, index=True)  # open, closed

    # Labels and categorization
    labels: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # User information
    author_login: str = Field(max_length=255)
    author_avatar_url: Optional[str] = Field(default=None, max_length=500)
    assignees: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Engagement metrics
    comments_count: int = Field(default=0)
    reactions_count: int = Field(default=0)

    # URLs
    html_url: str = Field(max_length=500)

    # Timestamps from GitHub
    github_created_at: datetime
    github_updated_at: datetime
    github_closed_at: Optional[datetime] = Field(default=None)

    # Task generation
    is_task_generated: bool = Field(default=False)
    generated_task_id: Optional[UUID] = Field(default=None, foreign_key="tasks.id")

    # Sync metadata
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    # Priority (can be derived from labels or set manually)
    priority: Optional[str] = Field(default=None, max_length=20)  # low, medium, high, critical

    # Relationships
    repository: "GitHubRepository" = Relationship(back_populates="github_issues")
    generated_task: Optional["Task"] = Relationship()
