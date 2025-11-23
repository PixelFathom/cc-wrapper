from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Dict, Any, Optional
from uuid import UUID
import logging

from ..deps import get_session, require_feature
from ..models.user import User
from ..models.subscription import Feature
from ..models.contest_harvesting import (
    ContestHarvestingStartRequest,
    ContestHarvestingStartResponse,
    QuestionAnswerRequest,
    QuestionAnswerResponse,
    QuestionSkipRequest,
    HarvestingQuestionRead,
    ContestHarvestingSessionRead,
    HarvestingSessionListResponse
)
from ..services.contest_harvesting_service import contest_harvesting_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/tasks/{task_id}/contest-harvesting/start", response_model=ContestHarvestingStartResponse)
async def start_contest_harvesting(
    task_id: UUID,
    request: Optional[ContestHarvestingStartRequest] = None,
    current_user: User = Depends(require_feature(Feature.CONTEXT_HARVESTING)),
    session: AsyncSession = Depends(get_session)
):
    """Start a new contest harvesting session for a task (requires CONTEXT_HARVESTING feature)"""
    try:
        context_prompt = request.context_prompt if request else None
        
        result = await contest_harvesting_service.start_contest_harvesting(
            db=session,
            task_id=task_id,
            context_prompt=context_prompt
        )
        
        return ContestHarvestingStartResponse(
            session_id=result["session_id"],
            total_questions=result.get("total_questions", 0),
            message=result["message"]
        )
        
    except Exception as e:
        logger.error(f"Error starting contest harvesting for task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}/contest-harvesting/sessions", response_model=HarvestingSessionListResponse)
async def get_contest_harvesting_sessions(
    task_id: UUID,
    current_user: User = Depends(require_feature(Feature.CONTEXT_HARVESTING)),
    session: AsyncSession = Depends(get_session)
):
    """Get all contest harvesting sessions for a task (requires CONTEXT_HARVESTING feature)"""
    try:
        sessions = await contest_harvesting_service.get_task_sessions(
            db=session,
            task_id=task_id
        )
        
        return HarvestingSessionListResponse(
            sessions=[
                ContestHarvestingSessionRead(
                    id=UUID(s["id"]),
                    task_id=UUID(s["task_id"]),
                    agent_response=None,  # Don't return raw response
                    total_questions=s["total_questions"],
                    questions_answered=s["questions_answered"],
                    status=s["status"],
                    created_at=s["created_at"],
                    questions=[]  # Questions fetched separately
                ) for s in sessions
            ],
            total_sessions=len(sessions)
        )
        
    except Exception as e:
        logger.error(f"Error getting contest harvesting sessions for task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contest-harvesting/sessions/{session_id}")
async def get_contest_harvesting_session(
    session_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get full session data with all questions"""
    try:
        result = await contest_harvesting_service.get_session_with_questions(
            db=session,
            session_id=session_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting contest harvesting session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contest-harvesting/sessions/{session_id}/current-question")
async def get_current_question(
    session_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get the current (next unanswered) question for a session"""
    try:
        question = await contest_harvesting_service.get_current_question(
            db=session,
            session_id=session_id
        )
        
        if not question:
            return {"message": "No more questions in this session", "question": None}
        
        return {"question": question}
        
    except Exception as e:
        logger.error(f"Error getting current question for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contest-harvesting/questions/{question_id}/answer", response_model=QuestionAnswerResponse)
async def answer_question(
    question_id: UUID,
    request: QuestionAnswerRequest,
    session: AsyncSession = Depends(get_session)
):
    """Answer a question and get the next one"""
    try:
        result = await contest_harvesting_service.answer_question(
            db=session,
            question_id=question_id,
            answer=request.answer
        )
        
        next_question = None
        if result.get("next_question"):
            next_q = result["next_question"]
            next_question = HarvestingQuestionRead(
                id=next_q["id"],
                question_text=next_q["question_text"],
                question_order=next_q["order"],
                answer=None,
                answered_at=None,
                status=next_q["status"],
                context_category=next_q["category"],
                priority=next_q["priority"],
                created_at="2025-08-17T10:43:36.739293"  # placeholder
            )
        
        return QuestionAnswerResponse(
            success=result["success"],
            message=result["message"],
            next_question=next_question
        )
        
    except Exception as e:
        logger.error(f"Error answering question {question_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contest-harvesting/questions/{question_id}/skip")
async def skip_question(
    question_id: UUID,
    request: Optional[QuestionSkipRequest] = None,
    session: AsyncSession = Depends(get_session)
):
    """Skip a question and get the next one"""
    try:
        reason = request.reason if request else None
        
        result = await contest_harvesting_service.skip_question(
            db=session,
            question_id=question_id,
            reason=reason
        )
        
        return {
            "success": result["success"],
            "message": result["message"],
            "next_question": result.get("next_question")
        }
        
    except Exception as e:
        logger.error(f"Error skipping question {question_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contest-harvesting/sessions/{session_id}/process-agent-response")
async def process_agent_response(
    session_id: UUID,
    request: Dict[str, Any],
    session: AsyncSession = Depends(get_session)
):
    """Process agent response from webhook to extract questions using OpenAI"""
    try:
        agent_response = request.get("agent_response", "")
        
        if not agent_response:
            raise HTTPException(status_code=400, detail="agent_response is required")
        
        result = await contest_harvesting_service.process_agent_response(
            db=session,
            session_id=session_id,
            agent_response=agent_response
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing agent response for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))