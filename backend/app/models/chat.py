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


class Chat(BaseModel, table=True):
    __tablename__ = "chats"
    
    sub_project_id: UUID = Field(foreign_key="sub_projects.id")
    session_id: str = Field(index=True, nullable=True)
    role: ChatRole
    content: Dict[str, Any] = Field(sa_column=Column(JSON))
    
    sub_project: Optional["SubProject"] = Relationship(back_populates="chats")