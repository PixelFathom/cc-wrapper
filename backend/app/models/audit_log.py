from sqlmodel import Field, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class AuditLog(BaseModel, table=True):
    """
    Audit logging for security-sensitive operations.
    Tracks all GitHub OAuth operations, token usage, and data access.
    """
    __tablename__ = "audit_logs"

    user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)

    # Action details
    action: str = Field(max_length=100, index=True, nullable=False)
    resource_type: Optional[str] = Field(default=None, max_length=50, index=True)
    resource_id: Optional[UUID] = Field(default=None, index=True)

    # Request context
    ip_address: Optional[str] = Field(default=None, max_length=45)
    user_agent: Optional[str] = Field(default=None)

    # Additional metadata (JSON for flexibility)
    meta_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Relationships
    user: Optional["User"] = Relationship(back_populates="audit_logs")
