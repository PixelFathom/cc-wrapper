from sqlmodel import SQLModel, Field, Relationship
from uuid import UUID
from typing import Optional
from datetime import datetime
from enum import Enum

from .base import BaseModel


class TestCaseStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"


class TestCase(BaseModel, table=True):
    __tablename__ = "test_cases"
    
    title: str = Field(max_length=255)
    description: Optional[str] = None
    test_steps: str = Field(description="Test steps to execute")
    expected_result: str = Field(description="Expected outcome")
    status: TestCaseStatus = Field(default=TestCaseStatus.PENDING)
    last_execution_at: Optional[datetime] = None
    execution_result: Optional[str] = None
    
    # Relationship to task
    task_id: UUID = Field(foreign_key="tasks.id")
    task: Optional["Task"] = Relationship(back_populates="test_cases")


class TestCaseCreate(SQLModel):
    title: str = Field(max_length=255)
    description: Optional[str] = None
    test_steps: str
    expected_result: str
    task_id: Optional[UUID] = None


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


class TestCaseExecutionRequest(SQLModel):
    test_case_id: UUID