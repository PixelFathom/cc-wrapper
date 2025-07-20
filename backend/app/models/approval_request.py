from sqlalchemy import Column, String, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlmodel import SQLModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import uuid4, UUID
import enum


class MCPApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    timeout = "timeout"


class ApprovalRequest(SQLModel, table=True):
    __tablename__ = "approval_requests"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    request_id: str = Field(index=True, unique=True)  # External request ID from MCP
    
    # Request details
    tool_name: str
    tool_input: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    display_text: str
    callback_url: str
    
    # Association with project/task
    sub_project_id: UUID = Field(foreign_key="sub_projects.id", index=True)
    session_id: Optional[str] = Field(default=None, index=True)
    
    # Status tracking
    status: MCPApprovalStatus = Field(
        default=MCPApprovalStatus.pending,
        sa_column=Column(SQLEnum(MCPApprovalStatus))
    )
    decision_reason: Optional[str] = Field(default=None)
    
    # Timestamps
    received_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = Field(default=None)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }