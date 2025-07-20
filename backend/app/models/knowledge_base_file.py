from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from datetime import datetime
from .base import BaseModel

if TYPE_CHECKING:
    from .task import Task


class KnowledgeBaseFile(BaseModel, table=True):
    __tablename__ = "knowledge_base_files"
    
    task_id: UUID = Field(foreign_key="tasks.id", index=True)
    file_name: str = Field(index=True)
    file_path: str  # Relative path within knowledge base (e.g., "document.pdf" or "docs/readme.md")
    file_size: int  # Size in bytes
    content_type: Optional[str] = Field(default=None)  # MIME type
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    temp_path: Optional[str] = Field(default=None)  # Temporary storage path
    
    # Relationships
    task: Optional["Task"] = Relationship(back_populates="knowledge_base_files")