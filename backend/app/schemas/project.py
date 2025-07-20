from pydantic import BaseModel, HttpUrl
from uuid import UUID
from datetime import datetime
from typing import List, Optional


class ProjectBase(BaseModel):
    name: str
    repo_url: str


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None


class ProjectRead(ProjectBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True