from sqlmodel import SQLModel, Field, Relationship
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from enum import Enum

from .base import BaseModel


class QuestionStatus(str, Enum):
    PENDING = "pending"
    ANSWERED = "answered"
    SKIPPED = "skipped"


class ContestHarvestingSession(BaseModel, table=True):
    __tablename__ = "contest_harvesting_sessions"
    
    # Relationship to task
    task_id: UUID = Field(foreign_key="tasks.id")
    task: Optional["Task"] = Relationship(back_populates="contest_harvesting_sessions")
    
    # Session metadata
    agent_response: Optional[str] = Field(default=None, description="Raw response from context_harvestor agent")
    total_questions: int = Field(default=0, description="Total number of questions generated")
    questions_answered: int = Field(default=0, description="Number of questions answered")
    status: str = Field(default="active", description="Session status: active, completed, abandoned")
    
    # Relationship to questions
    questions: List["HarvestingQuestion"] = Relationship(back_populates="session")


class HarvestingQuestion(BaseModel, table=True):
    __tablename__ = "harvesting_questions"
    
    # Question content
    question_text: str = Field(description="The actual question text")
    question_order: int = Field(description="Order of the question in the session")
    
    # Answer information
    answer: Optional[str] = Field(default=None, description="User's answer to the question")
    answered_at: Optional[datetime] = Field(default=None, description="When the question was answered")
    status: QuestionStatus = Field(default=QuestionStatus.PENDING)
    
    # Metadata
    context_category: Optional[str] = Field(default=None, description="Category of context this question helps gather")
    priority: int = Field(default=1, description="Priority level (1-5, 5 being highest)")
    
    # Relationship to session
    session_id: UUID = Field(foreign_key="contest_harvesting_sessions.id")
    session: Optional[ContestHarvestingSession] = Relationship(back_populates="questions")


# Request/Response schemas
class ContestHarvestingStartRequest(SQLModel):
    context_prompt: Optional[str] = Field(default=None, description="Optional prompt to guide context harvesting")


class ContestHarvestingStartResponse(SQLModel):
    session_id: UUID
    total_questions: int
    message: str


class QuestionAnswerRequest(SQLModel):
    answer: str


class HarvestingQuestionRead(SQLModel):
    id: UUID
    question_text: str
    question_order: int
    answer: Optional[str]
    answered_at: Optional[datetime]
    status: QuestionStatus
    context_category: Optional[str]
    priority: int
    created_at: datetime


class QuestionAnswerResponse(SQLModel):
    success: bool
    message: str
    next_question: Optional[HarvestingQuestionRead] = None


class ContestHarvestingSessionRead(SQLModel):
    id: UUID
    task_id: UUID
    agent_response: Optional[str]
    total_questions: int
    questions_answered: int
    status: str
    created_at: datetime
    questions: List[HarvestingQuestionRead]


class QuestionSkipRequest(SQLModel):
    reason: Optional[str] = Field(default=None, description="Optional reason for skipping")


class HarvestingSessionListResponse(SQLModel):
    sessions: List[ContestHarvestingSessionRead]
    total_sessions: int