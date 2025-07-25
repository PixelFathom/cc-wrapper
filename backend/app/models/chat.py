from sqlmodel import Field, SQLModel, Relationship, JSON, Column
from typing import Optional, TYPE_CHECKING, Any, Dict
from uuid import UUID
from enum import Enum
from .base import BaseModel

if TYPE_CHECKING:
    from .sub_project import SubProject


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    HOOK = "hook"
    AUTO = "auto"  # For auto-generated continuation messages


class ContinuationStatus(str, Enum):
    NONE = "none"
    NEEDED = "needed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Chat(BaseModel, table=True):
    __tablename__ = "chats"
    
    sub_project_id: UUID = Field(foreign_key="sub_projects.id")
    session_id: str = Field(index=True, nullable=True)
    role: ChatRole
    content: Dict[str, Any] = Field(sa_column=Column(JSON))
    
    # Auto-continuation fields
    continuation_status: ContinuationStatus = Field(default=ContinuationStatus.NONE)
    continuation_count: int = Field(default=0)
    auto_continuation_enabled: bool = Field(default=True)
    parent_message_id: Optional[UUID] = Field(default=None, foreign_key="chats.id")
    
    sub_project: Optional["SubProject"] = Relationship(back_populates="chats")