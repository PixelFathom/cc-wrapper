import httpx
import logging
import json
import re
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from openai import AsyncOpenAI

from app.core.settings import get_settings
from app.models import (
    ContestHarvestingSession, 
    HarvestingQuestion, 
    Task, 
    Project,
    QuestionStatus
)

logger = logging.getLogger(__name__)


class ContestHarvestingService:
    def __init__(self):
        self.settings = get_settings()
        self.org_name = self.settings.org_name
        self.webhook_base_url = self.settings.webhook_base_url
        self.query_url = self.settings.query_url
        self.redis_client = None
        
        # Initialize OpenAI client if API key is available
        self.openai_client = None
        if self.settings.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        
    def set_redis_client(self, redis_client):
        """Set Redis client for real-time updates"""
        self.redis_client = redis_client
        
    async def start_contest_harvesting(
        self, 
        db: AsyncSession, 
        task_id: UUID,
        context_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Start a new contest harvesting session by calling context_harvestor agent"""
        try:
            # Get task and project for context
            task = await db.get(Task, task_id)
            if not task:
                raise ValueError("Task not found")
            
            project = await db.get(Project, task.project_id)
            if not project:
                raise ValueError("Project not found")
            
            project_path = f"{project.name}/{task.name}-{task.id}"
            
            # Create contest harvesting session first
            session = ContestHarvestingSession(
                task_id=task_id,
                agent_response=None,
                total_questions=0,  # Will be updated after processing
                questions_answered=0,
                status="processing"
            )
            
            db.add(session)
            await db.commit()
            await db.refresh(session)
            
            # Generate webhook URL for the session
            webhook_url = f"{self.webhook_base_url}/api/webhooks/contest-harvesting/{session.id}"
            
            # Prepare the context harvesting query
            base_prompt = """
You are a context harvesting expert. Your job is to generate intelligent questions that will help gather comprehensive context about this project and task. 

Please analyze the current codebase, project structure, and task requirements to generate a list of relevant questions that would help understand:
1. Business requirements and use cases
2. Technical architecture decisions
3. User experience considerations
4. Performance and scalability requirements
5. Integration and deployment needs
6. Testing and quality assurance strategies

Generate 8-12 specific, actionable questions that would provide the most valuable context for working on this project. Each question should be:
- Clear and specific
- Focused on gathering actionable information
- Relevant to the current project/task context
- Open-ended enough to provide rich details

Format your response as a JSON array of question objects, where each object has:
- "question": the question text
- "category": the context category (business, technical, ux, performance, integration, testing, etc.)
- "priority": priority level 1-5 (5 being highest priority)

Example format:
[
  {
    "question": "What are the primary user personas and their key use cases for this application?",
    "category": "business",
    "priority": 4
  },
  {
    "question": "What are the expected performance requirements (response times, concurrent users, etc.)?",
    "category": "performance", 
    "priority": 3
  }
]
"""
            
            # Add custom context prompt if provided
            if context_prompt:
                base_prompt += f"\n\nAdditional context to consider:\n{context_prompt}"
            
            # Prepare request payload
            payload = {
                "prompt": base_prompt,
                "agent_name": "context-harvestor", 
                "webhook_url": webhook_url,
                "organization_name": self.org_name,
                "project_path": project_path,
                "options": {
                    "permission_mode": "bypassPermissions"
                }
            }
            
            # Make request to remote service
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.query_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    raise Exception(f"Context harvesting request failed: {response.status_code}")
                
                result = response.json()
                
                # Update session with initial response info
                session.agent_response = json.dumps({
                    "initial_request": payload,
                    "response": result
                })
                db.add(session)
                await db.commit()
                
                return {
                    "session_id": session.id,
                    "status": "processing",
                    "message": "Contest harvesting session started. Questions will be available shortly.",
                    "agent_task_id": result.get("task_id")
                }
                
        except Exception as e:
            logger.error(f"Error starting contest harvesting for task {task_id}: {str(e)}")
            raise
    
    async def process_webhook(
        self,
        db: AsyncSession,
        session_id: UUID,
        webhook_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process incoming webhook from remote service"""
        try:
            logger.info(f"🎯 Processing contest harvesting webhook for session {session_id}")
            
            session = await db.get(ContestHarvestingSession, session_id)
            if not session:
                raise ValueError(f"Contest harvesting session {session_id} not found")
            
            # Check if this is a completion message
            is_completion = (
                webhook_data.get("status") in ["completed", "failed"] or
                webhook_data.get("type") == "result"
            )
            
            if is_completion:
                # Extract the agent's response
                result_text = webhook_data.get("result", "")
                error_text = webhook_data.get("error", "")
                
                if result_text:
                    # Process the agent response using OpenAI
                    try:
                        await self.process_agent_response(db, session_id, result_text)
                        logger.info(f"✅ Successfully processed agent response for session {session_id}")
                    except Exception as e:
                        logger.error(f"❌ Error processing agent response: {str(e)}")
                        session.status = "failed"
                        db.add(session)
                        await db.commit()
                elif error_text:
                    session.status = "failed"
                    session.agent_response = json.dumps({
                        "error": error_text,
                        "webhook_data": webhook_data
                    })
                    db.add(session)
                    await db.commit()
            
            # Publish to Redis for real-time updates
            if self.redis_client:
                await self.redis_client.publish(
                    f"contest_harvesting:{session_id}",
                    json.dumps({
                        "type": "webhook",
                        "data": webhook_data,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                )
            
            return {"status": "processed"}
            
        except Exception as e:
            logger.error(f"💥 Contest harvesting webhook processing error: {str(e)}")
            raise
    
    async def process_agent_response(
        self,
        db: AsyncSession,
        session_id: UUID,
        agent_response: str
    ) -> Dict[str, Any]:
        """Process the agent response using OpenAI to extract questions"""
        try:
            if not self.openai_client:
                raise ValueError("OpenAI API key not configured")
            
            session = await db.get(ContestHarvestingSession, session_id)
            if not session:
                raise ValueError("Contest harvesting session not found")
            
            # Use OpenAI to parse and structure the questions from agent response
            processing_prompt = f"""
You are a JSON extraction expert. Extract meaningful questions from the following agent response and structure them as a JSON array.

Agent Response:
{agent_response}

Your task is to:
1. Find all questions or question-like content in the response
2. Clean and improve the question phrasing if needed
3. Categorize each question appropriately
4. Assign priority levels (1-5, with 5 being highest)
5. Return as a valid JSON array

If the response doesn't contain clear questions, generate 8-10 intelligent context-gathering questions based on the content and intent of the response.

Expected JSON format:
[
  {{
    "question": "Clear, specific question text",
    "category": "business|technical|ux|performance|integration|testing|security|deployment",
    "priority": 1-5
  }}
]

Return ONLY the JSON array, no other text.
"""
            
            # Call OpenAI to process the response
            openai_response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a JSON extraction expert. Always return valid JSON arrays only."},
                    {"role": "user", "content": processing_prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            questions_text = openai_response.choices[0].message.content
            
            # Parse the JSON response
            try:
                questions_data = json.loads(questions_text)
            except json.JSONDecodeError:
                # Fallback: try to extract JSON from the response
                json_match = re.search(r'\[.*\]', questions_text, re.DOTALL)
                if json_match:
                    questions_data = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse questions from OpenAI response")
            
            # Create question records in database
            questions_created = []
            for i, question_data in enumerate(questions_data):
                question = HarvestingQuestion(
                    session_id=session_id,
                    question_text=question_data.get("question", ""),
                    question_order=i + 1,
                    context_category=question_data.get("category", "general"),
                    priority=question_data.get("priority", 3),
                    status=QuestionStatus.PENDING
                )
                db.add(question)
                questions_created.append(question)
            
            # Update session
            session.total_questions = len(questions_created)
            session.status = "active"
            db.add(session)
            
            await db.commit()
            
            # Refresh all objects
            for question in questions_created:
                await db.refresh(question)
            await db.refresh(session)
            
            logger.info(f"Created {len(questions_created)} questions for session {session_id}")
            
            return {
                "session_id": session_id,
                "total_questions": len(questions_created),
                "questions": [
                    {
                        "id": str(q.id),
                        "question_text": q.question_text,
                        "category": q.context_category,
                        "priority": q.priority,
                        "order": q.question_order
                    }
                    for q in questions_created
                ]
            }
            
        except Exception as e:
            logger.error(f"Error processing agent response for session {session_id}: {str(e)}")
            # Update session status to failed
            session = await db.get(ContestHarvestingSession, session_id)
            if session:
                session.status = "failed"
                db.add(session)
                await db.commit()
            raise
    
    async def get_current_question(
        self,
        db: AsyncSession,
        session_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get the next unanswered question in the session"""
        try:
            # Get the next pending question
            query = select(HarvestingQuestion).where(
                HarvestingQuestion.session_id == session_id,
                HarvestingQuestion.status == QuestionStatus.PENDING
            ).order_by(HarvestingQuestion.question_order.asc()).limit(1)
            
            result = await db.execute(query)
            question = result.scalar_one_or_none()
            
            if not question:
                return None
            
            return {
                "id": str(question.id),
                "question_text": question.question_text,
                "category": question.context_category,
                "priority": question.priority,
                "order": question.question_order,
                "status": question.status
            }
            
        except Exception as e:
            logger.error(f"Error getting current question for session {session_id}: {str(e)}")
            raise
    
    async def answer_question(
        self,
        db: AsyncSession,
        question_id: UUID,
        answer: str
    ) -> Dict[str, Any]:
        """Answer a question and return the next one"""
        try:
            question = await db.get(HarvestingQuestion, question_id)
            if not question:
                raise ValueError("Question not found")
            
            # Update the question
            question.answer = answer
            question.answered_at = datetime.utcnow()
            question.status = QuestionStatus.ANSWERED
            db.add(question)
            
            # Update session answered count
            session = await db.get(ContestHarvestingSession, question.session_id)
            if session:
                session.questions_answered += 1
                
                # Check if all questions are answered
                total_answered = await db.execute(
                    select(HarvestingQuestion).where(
                        HarvestingQuestion.session_id == session.id,
                        HarvestingQuestion.status == QuestionStatus.ANSWERED
                    )
                )
                answered_count = len(total_answered.scalars().all())
                
                if answered_count >= session.total_questions:
                    session.status = "completed"
                
                db.add(session)
            
            await db.commit()
            
            # Get next question
            next_question = await self.get_current_question(db, question.session_id)
            
            return {
                "success": True,
                "message": "Question answered successfully",
                "next_question": next_question
            }
            
        except Exception as e:
            logger.error(f"Error answering question {question_id}: {str(e)}")
            raise
    
    async def skip_question(
        self,
        db: AsyncSession,
        question_id: UUID,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Skip a question and return the next one"""
        try:
            question = await db.get(HarvestingQuestion, question_id)
            if not question:
                raise ValueError("Question not found")
            
            # Update the question
            question.status = QuestionStatus.SKIPPED
            question.answer = f"Skipped: {reason}" if reason else "Skipped"
            question.answered_at = datetime.utcnow()
            db.add(question)
            
            await db.commit()
            
            # Get next question
            next_question = await self.get_current_question(db, question.session_id)
            
            return {
                "success": True,
                "message": "Question skipped",
                "next_question": next_question
            }
            
        except Exception as e:
            logger.error(f"Error skipping question {question_id}: {str(e)}")
            raise
    
    async def get_session_with_questions(
        self,
        db: AsyncSession,
        session_id: UUID
    ) -> Dict[str, Any]:
        """Get full session data with all questions"""
        try:
            session = await db.get(ContestHarvestingSession, session_id)
            if not session:
                raise ValueError("Session not found")
            
            # Get all questions for the session
            query = select(HarvestingQuestion).where(
                HarvestingQuestion.session_id == session_id
            ).order_by(HarvestingQuestion.question_order.asc())
            
            result = await db.execute(query)
            questions = result.scalars().all()
            
            return {
                "session": {
                    "id": str(session.id),
                    "task_id": str(session.task_id),
                    "total_questions": session.total_questions,
                    "questions_answered": session.questions_answered,
                    "status": session.status,
                    "created_at": session.created_at.isoformat()
                },
                "questions": [
                    {
                        "id": str(q.id),
                        "question_text": q.question_text,
                        "answer": q.answer,
                        "category": q.context_category,
                        "priority": q.priority,
                        "order": q.question_order,
                        "status": q.status,
                        "answered_at": q.answered_at.isoformat() if q.answered_at else None
                    }
                    for q in questions
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting session {session_id}: {str(e)}")
            raise
    
    async def get_task_sessions(
        self,
        db: AsyncSession,
        task_id: UUID
    ) -> List[Dict[str, Any]]:
        """Get all contest harvesting sessions for a task"""
        try:
            query = select(ContestHarvestingSession).where(
                ContestHarvestingSession.task_id == task_id
            ).order_by(ContestHarvestingSession.created_at.desc())
            
            result = await db.execute(query)
            sessions = result.scalars().all()
            
            return [
                {
                    "id": str(session.id),
                    "task_id": str(session.task_id),
                    "total_questions": session.total_questions,
                    "questions_answered": session.questions_answered,
                    "status": session.status,
                    "created_at": session.created_at.isoformat()
                }
                for session in sessions
            ]
            
        except Exception as e:
            logger.error(f"Error getting sessions for task {task_id}: {str(e)}")
            raise


# Create service instance
contest_harvesting_service = ContestHarvestingService()