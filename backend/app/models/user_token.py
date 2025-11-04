from sqlmodel import Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class UserToken(BaseModel, table=True):
    """
    Stores encrypted GitHub OAuth tokens for users.
    Tokens are encrypted at rest for security.
    """
    __tablename__ = "user_tokens"

    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    # Encrypted token storage
    access_token_encrypted: str
    refresh_token_encrypted: Optional[str] = Field(default=None)

    # Token metadata
    token_type: str = Field(default="bearer", max_length=50)
    scope: Optional[str] = Field(default=None)  # Space-separated scopes
    expires_at: Optional[datetime] = Field(default=None)

    # Relationships
    user: "User" = Relationship(back_populates="tokens")
