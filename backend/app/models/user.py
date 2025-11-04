from sqlmodel import Field, Relationship
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .user_token import UserToken
    from .project import Project
    from .audit_log import AuditLog


class User(BaseModel, table=True):
    """
    User model for GitHub-authenticated users.
    Stores core GitHub profile information.
    """
    __tablename__ = "users"

    # GitHub identity
    github_id: int = Field(unique=True, index=True, nullable=False)
    github_login: str = Field(unique=True, index=True, max_length=255, nullable=False)
    github_name: Optional[str] = Field(default=None, max_length=255)

    # Contact & profile
    email: Optional[str] = Field(default=None, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=500)

    # GitHub profile metadata
    bio: Optional[str] = Field(default=None)
    company: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    blog: Optional[str] = Field(default=None, max_length=500)

    # GitHub stats (cached)
    public_repos: int = Field(default=0)
    followers: int = Field(default=0)
    following: int = Field(default=0)

    # Account management
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    last_login_at: Optional[datetime] = Field(default=None)

    # Relationships
    tokens: List["UserToken"] = Relationship(back_populates="user")
    projects: List["Project"] = Relationship(back_populates="user")
    audit_logs: List["AuditLog"] = Relationship(back_populates="user")
