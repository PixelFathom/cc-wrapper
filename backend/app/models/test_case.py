from sqlmodel import SQLModel, Field, Relationship
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from enum import Enum

from .base import BaseModel


class TestCaseStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"


class TestCaseSource(str, Enum):
    MANUAL = "manual"
    AI_GENERATED = "ai_generated"


class TestCase(BaseModel, table=True):
    __tablename__ = "test_cases"
    
    title: str = Field(max_length=255)
    description: Optional[str] = None
    test_steps: str = Field(description="Test steps to execute")
    expected_result: str = Field(description="Expected outcome")
    status: TestCaseStatus = Field(default=TestCaseStatus.PENDING)
    last_execution_at: Optional[datetime] = None
    execution_result: Optional[str] = None
    
    # Source information for AI-generated test cases
    source: TestCaseSource = Field(default=TestCaseSource.MANUAL)
    session_id: Optional[str] = Field(default=None, description="Chat session ID that generated this test case")
    generated_from_messages: Optional[str] = Field(default=None, description="Summary of chat messages used for generation")
    ai_model_used: Optional[str] = Field(default=None, description="AI model used for generation")
    
    # Relationship to task
    task_id: UUID = Field(foreign_key="tasks.id")
    task: Optional["Task"] = Relationship(back_populates="test_cases")


class TestCaseCreate(SQLModel):
    title: str = Field(max_length=255)
    description: Optional[str] = None
    test_steps: str
    expected_result: str
    task_id: Optional[UUID] = None
    source: Optional[TestCaseSource] = Field(default=TestCaseSource.MANUAL)
    session_id: Optional[str] = None
    generated_from_messages: Optional[str] = None
    ai_model_used: Optional[str] = None


class TestCaseUpdate(SQLModel):
    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    test_steps: Optional[str] = None
    expected_result: Optional[str] = None
    status: Optional[TestCaseStatus] = None


class TestCaseRead(SQLModel):
    id: UUID
    title: str
    description: Optional[str]
    test_steps: str
    expected_result: str
    status: TestCaseStatus
    last_execution_at: Optional[datetime]
    execution_result: Optional[str]
    task_id: UUID
    created_at: datetime
    source: TestCaseSource
    session_id: Optional[str]
    generated_from_messages: Optional[str]
    ai_model_used: Optional[str]


class TestCaseExecutionRequest(SQLModel):
    test_case_id: UUID


class TestCaseGenerationRequest(SQLModel):
    session_id: str
    max_test_cases: Optional[int] = Field(default=5, description="Maximum number of test cases to generate")
    focus_areas: Optional[List[str]] = Field(default=None, description="Specific areas to focus testing on")


class TestCaseGenerationResponse(SQLModel):
    generated_count: int
    test_cases: List[TestCaseRead]
    generation_summary: str