from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any


class TaskBase(BaseModel):
    name: str


class TaskCreate(TaskBase):
    project_id: UUID
    mcp_servers: Optional[List[Dict[str, Any]]] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None


class TaskRead(TaskBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    mcp_servers: Optional[List[Dict[str, Any]]]
    deployment_status: str
    deployment_request_id: Optional[str]
    deployment_completed: bool
    deployment_started_at: Optional[datetime]
    deployment_completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True