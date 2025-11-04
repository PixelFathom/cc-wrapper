from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import BigInteger
from typing import List, Optional, TYPE_CHECKING
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .task import Task
    from .user import User
    from .github_repository import GitHubRepository


class Project(BaseModel, table=True):
    __tablename__ = "projects"

    name: str = Field(index=True)
    repo_url: str

    # User association (who owns this project)
    user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)

    # GitHub repository linkage
    github_repo_id: Optional[int] = Field(default=None, index=True)
    github_owner: Optional[str] = Field(default=None, max_length=255)
    github_repo_name: Optional[str] = Field(default=None, max_length=255)
    is_private: bool = Field(default=False)

    # Link to cached GitHub repository data
    github_repository_id: Optional[UUID] = Field(default=None, foreign_key="github_repositories.id")

    # Fork project tracking
    is_fork_project: bool = Field(default=False)  # Whether this project is from a forked repo
    original_issue_repo_id: Optional[int] = Field(default=None, sa_column=Column(BigInteger, index=True))  # Original repo where issues come from

    # Relationships
    tasks: List["Task"] = Relationship(back_populates="project")
    user: Optional["User"] = Relationship(back_populates="projects")
    github_repository: Optional["GitHubRepository"] = Relationship(back_populates="projects")