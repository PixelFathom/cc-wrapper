from pydantic import BaseModel, HttpUrl, validator
from uuid import UUID
from datetime import datetime
from typing import List, Optional
import re


class ProjectBase(BaseModel):
    name: str
    repo_url: str


class ProjectCreate(ProjectBase):
    @validator('repo_url')
    def validate_github_ssh_url(cls, v):
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None
    
    @validator('repo_url')
    def validate_github_ssh_url(cls, v):
        return v


class ProjectRead(ProjectBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True