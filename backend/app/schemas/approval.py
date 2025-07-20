from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.approval import ApprovalStatus


class ApprovalBase(BaseModel):
    prompt: str
    status: ApprovalStatus


class ApprovalRead(ApprovalBase):
    id: UUID
    sub_project_id: UUID
    response: Optional[str]
    created_at: datetime
    responded_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ApprovalUpdate(BaseModel):
    status: Optional[ApprovalStatus] = None
    response: Optional[str] = None


class ApprovalResult(BaseModel):
    approval_id: UUID
    decision: str
    comment: Optional[str] = None