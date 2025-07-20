from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from datetime import datetime
from enum import Enum
from .base import BaseModel

if TYPE_CHECKING:
    from .sub_project import SubProject


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Approval(BaseModel, table=True):
    __tablename__ = "approvals"
    
    sub_project_id: UUID = Field(foreign_key="sub_projects.id")
    prompt: str
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    response: Optional[str] = None
    responded_at: Optional[datetime] = None
    
    sub_project: Optional["SubProject"] = Relationship(back_populates="approvals")