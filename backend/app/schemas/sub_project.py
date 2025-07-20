from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class SubProjectBase(BaseModel):
    pass


class SubProjectCreate(SubProjectBase):
    task_id: UUID


class SubProjectRead(SubProjectBase):
    id: UUID
    task_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True