from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import DateTime, Text
from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID, uuid4


class TestCaseHook(SQLModel, table=True):
    """Model for storing test case processing hooks"""
    __tablename__ = "test_case_hooks"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Test case reference
    test_case_id: UUID = Field(foreign_key="test_cases.id", index=True)
    session_id: Optional[str] = Field(default=None, index=True)
    conversation_id: Optional[str] = Field(default=None, index=True)
    
    # Hook details
    hook_type: str = Field(default="query")  # status, query, error
    status: str = Field(default="received")  # received, processing, completed, error
    data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    message: Optional[str] = Field(default=None)
    
    # New fields from webhook format
    message_type: Optional[str] = Field(default=None)  # AssistantMessage, UserMessage, etc.
    content_type: Optional[str] = Field(default=None)  # text, tool_use, tool_result, etc.
    tool_name: Optional[str] = Field(default=None)
    tool_input: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    
    # Processing state
    is_complete: bool = Field(default=False)
    received_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Additional metadata
    step_name: Optional[str] = Field(default=None)
    step_index: Optional[int] = Field(default=None)
    total_steps: Optional[int] = Field(default=None)