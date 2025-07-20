from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from .base import BaseModel

if TYPE_CHECKING:
    from .sub_project import SubProject


class File(BaseModel, table=True):
    __tablename__ = "files"
    
    sub_project_id: UUID = Field(foreign_key="sub_projects.id")
    filename: str
    storage_path: str
    
    sub_project: Optional["SubProject"] = Relationship(back_populates="files")