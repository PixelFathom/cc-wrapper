from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from app.models.chat import ChatRole


class ChatBase(BaseModel):
    session_id: str
    role: ChatRole
    content: Dict[str, Any]


class ChatCreate(ChatBase):
    sub_project_id: UUID


class ChatRead(ChatBase):
    id: UUID
    sub_project_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class QueryRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    org_name: str
    cwd: str
    webhook_url: Optional[str] = None


class QueryResponse(BaseModel):
    session_id: str
    assistant_response: str
    chat_id: Optional[str] = None
    task_id: Optional[str] = None