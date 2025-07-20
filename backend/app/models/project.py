from sqlmodel import Field, SQLModel, Relationship
from typing import List, TYPE_CHECKING
from .base import BaseModel

if TYPE_CHECKING:
    from .task import Task


class Project(BaseModel, table=True):
    __tablename__ = "projects"
    
    name: str = Field(index=True)
    repo_url: str
    
    tasks: List["Task"] = Relationship(back_populates="project")