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
        if v:
            pattern = r'^git@github\.com:[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+\.git$'
            if not re.match(pattern, v):
                raise ValueError('Only GitHub SSH URLs are allowed (e.g., git@github.com:username/repo-name.git)')
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None
    
    @validator('repo_url')
    def validate_github_ssh_url(cls, v):
        if v:
            pattern = r'^git@github\.com:[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+\.git$'
            if not re.match(pattern, v):
                raise ValueError('Only GitHub SSH URLs are allowed (e.g., git@github.com:username/repo-name.git)')
        return v


class ProjectRead(ProjectBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True