from sqlmodel import Field, Relationship, Column
from sqlalchemy import JSON, BigInteger
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .user import User
    from .project import Project
    from .github_issue import GitHubIssue


class GitHubRepository(BaseModel, table=True):
    """
    Cached GitHub repository metadata.
    Synced from GitHub API to minimize API calls.
    """
    __tablename__ = "github_repositories"

    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    # GitHub repository identity (use BigInteger for GitHub IDs that exceed int32 range)
    github_repo_id: int = Field(sa_column=Column(BigInteger, unique=True, index=True, nullable=False))
    owner: str = Field(max_length=255, nullable=False, index=True)
    name: str = Field(max_length=255, nullable=False, index=True)
    full_name: str = Field(max_length=512, nullable=False)  # "owner/repo"

    # Repository metadata
    description: Optional[str] = Field(default=None)
    is_private: bool = Field(default=False)
    is_fork: bool = Field(default=False)
    is_archived: bool = Field(default=False)

    # Repository URLs
    html_url: str = Field(max_length=500)
    clone_url: str = Field(max_length=500)
    ssh_url: str = Field(max_length=500)

    # Statistics (cached from GitHub)
    stars_count: int = Field(default=0)
    forks_count: int = Field(default=0)
    open_issues_count: int = Field(default=0)
    watchers_count: int = Field(default=0)
    size: int = Field(default=0)  # KB

    # Language and topics
    language: Optional[str] = Field(default=None, max_length=50)
    topics: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Timestamps from GitHub
    github_created_at: datetime
    github_updated_at: datetime
    github_pushed_at: Optional[datetime] = Field(default=None)

    # Sync metadata
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)
    is_initialized: bool = Field(default=False)  # Whether project was created from this repo

    # License
    license_name: Optional[str] = Field(default=None, max_length=100)

    # Default branch
    default_branch: str = Field(default="main", max_length=255)

    # Permissions (from GitHub API)
    has_issues: bool = Field(default=True)
    has_wiki: bool = Field(default=False)
    has_pages: bool = Field(default=False)
    has_downloads: bool = Field(default=False)

    # Fork relationship tracking
    parent_repo_id: Optional[int] = Field(default=None, sa_column=Column(BigInteger, index=True))
    parent_full_name: Optional[str] = Field(default=None, max_length=512)  # "original-owner/repo"

    # User permissions on the repository
    can_push: bool = Field(default=False)  # Whether user has write access
    can_admin: bool = Field(default=False)  # Whether user has admin access

    # Relationships
    user: "User" = Relationship()
    projects: List["Project"] = Relationship(back_populates="github_repository")
    github_issues: List["GitHubIssue"] = Relationship(back_populates="repository")
