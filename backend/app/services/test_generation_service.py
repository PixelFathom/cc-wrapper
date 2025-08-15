from openai import OpenAI
import logging
import json
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.settings import get_settings
from app.models import TestCase, Chat, SubProject, Task, TestCaseSource

logger = logging.getLogger(__name__)


class TestGenerationService:
    def __init__(self):
        self.settings = get_settings()
        # Check if OpenAI API key is available
        if hasattr(self.settings, 'openai_api_key') and self.settings.openai_api_key:
            self.openai_client = OpenAI(api_key=self.settings.openai_api_key)
            self.openai_enabled = True
        else:
            logger.warning("OpenAI API key not configured. Test generation will be disabled.")
            self.openai_enabled = False
            self.openai_client = None
        
    async def generate_test_cases_from_session(
        self,
        db: AsyncSession,
        session_id: str,
        max_test_cases: int = 5,
        focus_areas: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate test cases based on a chat session's conversation history.
        
        Args:
            db: Database session
            session_id: Chat session ID to analyze
            max_test_cases: Maximum number of test cases to generate
            focus_areas: Specific areas to focus testing on
            
        Returns:
            Dictionary containing generated test cases and metadata
        """
        if not self.openai_enabled:
            raise ValueError("OpenAI API key not configured. Cannot generate test cases.")
        
        try:
            # Fetch chat messages from the session
            chat_messages = await self._get_session_messages(db, session_id)
            
            if not chat_messages:
                raise ValueError(f"No messages found for session {session_id}")
            
            # Get task information for context
            task_info = await self._get_task_from_session(db, session_id)
            
            if not task_info:
                raise ValueError(f"Could not find task information for session {session_id}")
            
            # Analyze conversation and generate test cases
            test_case_data = await self._generate_with_openai(
                chat_messages, 
                task_info, 
                max_test_cases, 
                focus_areas
            )
            
            # Save generated test cases to database
            saved_test_cases = await self._save_test_cases(
                db,
                test_case_data,
                task_info['task_id'],
                session_id,
                chat_messages
            )
            
            return {
                'generated_count': len(saved_test_cases),
                'test_cases': saved_test_cases,
                'generation_summary': f"Generated {len(saved_test_cases)} test cases based on conversation analysis",
                'session_id': session_id,
                'model_used': 'gpt-4o-mini'
            }
            
        except Exception as e:
            logger.error(f"Error generating test cases for session {session_id}: {str(e)}")
            raise
    
    async def _get_session_messages(self, db: AsyncSession, session_id: str) -> List[Dict[str, Any]]:
        """Fetch all messages from a chat session"""
        try:
            statement = select(Chat).where(Chat.session_id == session_id).order_by(Chat.created_at.asc())
            result = await db.execute(statement)
            chats = result.scalars().all()
            
            messages = []
            for chat in chats:
                messages.append({
                    'id': str(chat.id),
                    'role': chat.role,
                    'content': chat.content,
                    'timestamp': chat.created_at.isoformat(),
                })
            
            logger.info(f"Retrieved {len(messages)} messages for session {session_id}")
            return messages
            
        except Exception as e:
            logger.error(f"Error fetching messages for session {session_id}: {str(e)}")
            raise
    
    async def _get_task_from_session(self, db: AsyncSession, session_id: str) -> Optional[Dict[str, Any]]:
        """Get task information from a chat session"""
        try:
            # Get a chat message from this session to find the sub_project
            statement = select(Chat).where(Chat.session_id == session_id).limit(1)
            result = await db.execute(statement)
            chat = result.scalar_one_or_none()
            
            if not chat:
                return None
            
            # Get sub_project and task information
            sub_project = await db.get(SubProject, chat.sub_project_id)
            if not sub_project:
                return None
                
            task = await db.get(Task, sub_project.task_id)
            if not task:
                return None
            
            return {
                'task_id': task.id,
                'task_name': task.name,
                'sub_project_id': sub_project.id,
                'deployment_guide': task.deployment_guide
            }
            
        except Exception as e:
            logger.error(f"Error getting task info for session {session_id}: {str(e)}")
            return None
    
    async def _generate_with_openai(
        self,
        chat_messages: List[Dict[str, Any]],
        task_info: Dict[str, Any],
        max_test_cases: int,
        focus_areas: Optional[List[str]]
    ) -> List[Dict[str, Any]]:
        """Generate test cases using OpenAI GPT-4o-mini"""
        try:
            # Prepare conversation context
            conversation_summary = self._create_conversation_summary(chat_messages)
            
            # Create the prompt for test case generation
            system_prompt = """You are an expert software testing engineer. Your job is to analyze software development conversations and generate comprehensive, specific test cases.

Based on the conversation provided, create detailed test cases that cover:
1. New features implemented or discussed
2. Bug fixes and edge cases
3. API endpoints and their behavior
4. User interface interactions
5. Error handling scenarios
6. Performance considerations
7. Security aspects

Each test case should be:
- Specific and actionable (not generic)
- Include detailed test steps
- Have clear expected results
- Cover both positive and negative scenarios
- Be executable by a developer or QA engineer

Return your response as a JSON array of test cases, where each test case has:
- title: Brief descriptive title
- description: Detailed description of what this test validates
- test_steps: Step-by-step instructions (as a single string with numbered steps)
- expected_result: Clear description of expected outcome
- category: Type of test (feature, api, ui, error_handling, performance, security)"""

            user_prompt = f"""Task: {task_info['task_name']}

Conversation Summary:
{conversation_summary}

Deployment Guide (if available):
{task_info.get('deployment_guide', 'Not provided')}

Focus Areas: {focus_areas if focus_areas else 'General testing coverage'}

Generate up to {max_test_cases} specific, high-quality test cases based on this development conversation. Focus on testing the actual changes, features, and scenarios discussed.

Ensure test cases are:
1. Specific to the actual code and features discussed
2. Not generic (avoid tests like "verify system works")
3. Executable with clear steps
4. Cover edge cases and error scenarios
5. Include API testing if APIs were discussed
6. Include UI testing if frontend changes were made

Return only the JSON array, no additional text."""

            # Call OpenAI API
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent results
                max_tokens=4000,
            )
            
            # Parse the response
            content = response.choices[0].message.content.strip()
            
            # Try to extract JSON from the response
            try:
                # Remove any markdown formatting
                if content.startswith('```json'):
                    content = content[7:]
                if content.endswith('```'):
                    content = content[:-3]
                
                test_cases = json.loads(content)
                
                # Validate the structure
                if not isinstance(test_cases, list):
                    raise ValueError("Response is not a list")
                
                # Validate each test case has required fields
                validated_cases = []
                for i, case in enumerate(test_cases):
                    if not all(key in case for key in ['title', 'description', 'test_steps', 'expected_result']):
                        logger.warning(f"Test case {i} missing required fields, skipping")
                        continue
                    validated_cases.append(case)
                
                logger.info(f"Generated {len(validated_cases)} valid test cases using OpenAI")
                return validated_cases
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse OpenAI response as JSON: {e}")
                logger.error(f"Response content: {content}")
                raise ValueError("Invalid JSON response from OpenAI")
                
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {str(e)}")
            raise
    
    def _create_conversation_summary(self, messages: List[Dict[str, Any]]) -> str:
        """Create a summary of the conversation for context"""
        summary_parts = []
        
        for msg in messages:
            role = msg['role']
            content = msg['content']
            
            # Extract text content
            if isinstance(content, dict):
                text = content.get('text', str(content))
            else:
                text = str(content)
            
            # Truncate very long messages
            if len(text) > 500:
                text = text[:500] + "..."
            
            summary_parts.append(f"{role.upper()}: {text}")
        
        return "\n\n".join(summary_parts)
    
    async def _save_test_cases(
        self,
        db: AsyncSession,
        test_case_data: List[Dict[str, Any]],
        task_id: UUID,
        session_id: str,
        chat_messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Save generated test cases to database"""
        try:
            saved_cases = []
            
            # Create summary of messages used for generation
            message_summary = f"Generated from {len(chat_messages)} messages in session {session_id[:8]}..."
            
            for case_data in test_case_data:
                # Create test case
                test_case = TestCase(
                    title=case_data['title'],
                    description=case_data['description'],
                    test_steps=case_data['test_steps'],
                    expected_result=case_data['expected_result'],
                    task_id=task_id,
                    source=TestCaseSource.AI_GENERATED,
                    session_id=session_id,
                    generated_from_messages=message_summary,
                    ai_model_used="gpt-4o-mini"
                )
                
                db.add(test_case)
                await db.flush()  # Flush to get the ID
                await db.refresh(test_case)
                
                saved_cases.append({
                    'id': str(test_case.id),
                    'title': test_case.title,
                    'description': test_case.description,
                    'test_steps': test_case.test_steps,
                    'expected_result': test_case.expected_result,
                    'status': test_case.status,
                    'last_execution_at': test_case.last_execution_at.isoformat() if test_case.last_execution_at else None,
                    'execution_result': test_case.execution_result,
                    'task_id': str(test_case.task_id),
                    'created_at': test_case.created_at.isoformat(),
                    'source': test_case.source,
                    'session_id': test_case.session_id,
                    'generated_from_messages': test_case.generated_from_messages,
                    'ai_model_used': test_case.ai_model_used,
                    'category': case_data.get('category', 'general')
                })
            
            await db.commit()
            logger.info(f"Saved {len(saved_cases)} test cases to database")
            return saved_cases
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error saving test cases: {str(e)}")
            raise


# Create service instance
test_generation_service = TestGenerationService()