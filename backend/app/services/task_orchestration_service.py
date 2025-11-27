"""
Task Orchestration Service

Manages the lifecycle of task breakdowns and coordinates sub-task execution.
"""
import logging
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.orm.attributes import flag_modified

from app.models import Chat, SubProject
from app.services.task_analysis_service import BreakdownAnalysis, task_analysis_service

logger = logging.getLogger(__name__)


class TaskOrchestrationService:
    """Service for orchestrating task breakdowns and sub-task execution"""
    
    async def create_breakdown_sessions(
        self,
        db: AsyncSession,
        parent_chat: Chat,
        analysis: BreakdownAnalysis,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create initial breakdown structure with all sub-task sessions created upfront.

        Creates Chat entries for all sub-tasks with pre-assigned session_ids.
        Only the first sub-task will be executed immediately, others wait.

        Args:
            db: Database session
            parent_chat: The original user message chat
            analysis: The breakdown analysis from OpenAI
            context: Additional context (project info, etc.)

        Returns:
            Breakdown metadata dict
        """
        try:
            logger.info(f"🏗️ Creating breakdown for chat {str(parent_chat.id)[:8]}... with {len(analysis.sub_tasks)} sub-tasks")

            # Generate prompts for all sub-tasks
            sub_task_prompts = await task_analysis_service.generate_sub_task_prompts(
                parent_chat.content.get('text', ''),
                analysis,
                context
            )

            parent_session_id = parent_chat.session_id

            # First pass: Generate all session_ids upfront so we can link them
            session_ids = [str(uuid4()) for _ in sub_task_prompts]

            # Create all sub-task sessions with pre-assigned session_ids and next_session_id links
            sub_task_sessions = []
            sub_task_chats = []

            for i, prompt_spec in enumerate(sub_task_prompts):
                sub_task_session_id = session_ids[i]
                # Link to next session (None for last task)
                next_session_id = session_ids[i + 1] if i < len(session_ids) - 1 else None

                sub_task_info = {
                    "sequence": prompt_spec["sequence"],
                    "title": prompt_spec["title"],
                    "description": prompt_spec["description"],
                    "prompt": prompt_spec["prompt"],
                    "testing_requirements": prompt_spec["testing_requirements"],
                    "session_id": sub_task_session_id,
                    "next_session_id": next_session_id,  # Link to next task
                    "chat_id": None,  # Will be set after Chat is created
                    "status": "pending",
                    "started_at": None,
                    "completed_at": None,
                    "result_summary": None
                }

                # Create Chat entry for this sub-task (user message)
                sub_task_chat = Chat(
                    sub_project_id=parent_chat.sub_project_id,
                    session_id=sub_task_session_id,
                    parent_session_id=parent_session_id,
                    role="user",
                    content={
                        "text": prompt_spec["prompt"],
                        "metadata": {
                            "is_breakdown_subtask": True,
                            "parent_session_id": parent_session_id,
                            "sequence": prompt_spec["sequence"],
                            "title": prompt_spec["title"],
                            "description": prompt_spec["description"],
                            "testing_requirements": prompt_spec["testing_requirements"],
                            "next_session_id": next_session_id,
                            "status": "pending"
                        }
                    }
                )
                sub_task_chats.append(sub_task_chat)
                sub_task_sessions.append(sub_task_info)

            # Add all sub-task chats to database
            for chat in sub_task_chats:
                db.add(chat)

            await db.flush()  # Flush to get IDs

            # Update chat_ids and next_chat_ids in sub_task_sessions
            for i, chat in enumerate(sub_task_chats):
                sub_task_sessions[i]["chat_id"] = str(chat.id)
                if i < len(sub_task_chats) - 1:
                    sub_task_sessions[i]["next_chat_id"] = str(sub_task_chats[i + 1].id)

            # Build breakdown metadata structure
            breakdown_metadata = {
                "is_breakdown_parent": True,
                "breakdown_analysis": {
                    "reasoning": analysis.reasoning,
                    "total_sub_tasks": len(analysis.sub_tasks)
                },
                "total_sub_tasks": len(analysis.sub_tasks),
                "completed_sub_tasks": 0,
                "current_sub_task": 0,
                "sub_task_sessions": sub_task_sessions
            }

            # Update parent chat content with breakdown metadata
            current_content = parent_chat.content.copy()
            current_metadata = current_content.get("metadata", {})
            current_metadata.update(breakdown_metadata)
            current_content["metadata"] = current_metadata

            parent_chat.content = current_content
            flag_modified(parent_chat, "content")

            # Set parent_session_id to self (this is the parent)
            parent_chat.parent_session_id = parent_chat.session_id

            db.add(parent_chat)
            await db.commit()

            # Refresh all objects
            await db.refresh(parent_chat)
            for chat in sub_task_chats:
                await db.refresh(chat)

            logger.info(f"✅ Breakdown created with {len(analysis.sub_tasks)} sub-tasks (all sessions pre-created)")

            return breakdown_metadata

        except Exception as e:
            logger.error(f"❌ Failed to create breakdown sessions: {e}")
            raise
    
    async def start_next_sub_task(
        self,
        db: AsyncSession,
        parent_session_id: str,
        sub_project_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Start the next pending sub-task.

        Uses the pre-created session from create_breakdown_sessions.

        Args:
            db: Database session
            parent_session_id: The parent session ID
            sub_project_id: The sub-project ID

        Returns:
            Dict with sub-task info, or None if no more tasks
        """
        try:
            # Get parent chat to access breakdown metadata
            stmt = select(Chat).where(
                Chat.session_id == parent_session_id,
                Chat.role == "user",
                Chat.sub_project_id == sub_project_id
            ).order_by(Chat.created_at.asc()).limit(1)

            result = await db.execute(stmt)
            parent_chat = result.scalar_one_or_none()

            if not parent_chat:
                logger.error(f"❌ Parent chat not found for session {parent_session_id}")
                return None

            # Get breakdown metadata
            metadata = parent_chat.content.get("metadata", {})
            if not metadata.get("is_breakdown_parent"):
                logger.error(f"❌ Chat is not a breakdown parent")
                return None

            sub_task_sessions = metadata.get("sub_task_sessions", [])

            # Find the first pending task
            pending_task = None
            pending_index = None
            for i, task_info in enumerate(sub_task_sessions):
                if task_info["status"] == "pending":
                    pending_task = task_info
                    pending_index = i
                    break

            if not pending_task:
                logger.info(f"ℹ️ No more pending sub-tasks for session {parent_session_id}")
                return None

            # Use the pre-assigned session_id (from create_breakdown_sessions)
            # or generate a new one for backward compatibility
            sub_task_session_id = pending_task.get("session_id")
            sub_task_chat_id = pending_task.get("chat_id")

            # For backward compatibility: generate session_id and create chat if not pre-assigned
            if not sub_task_session_id:
                sub_task_session_id = str(uuid4())
                pending_task["session_id"] = sub_task_session_id

                # Create Chat entry for this sub-task (user message)
                sub_task_chat = Chat(
                    sub_project_id=sub_project_id,
                    session_id=sub_task_session_id,
                    parent_session_id=parent_session_id,
                    role="user",
                    content={
                        "text": pending_task.get("prompt", ""),
                        "metadata": {
                            "is_breakdown_subtask": True,
                            "parent_session_id": parent_session_id,
                            "sequence": pending_task["sequence"],
                            "title": pending_task["title"],
                            "description": pending_task["description"],
                            "status": "processing"
                        }
                    }
                )
                db.add(sub_task_chat)
                await db.flush()
                sub_task_chat_id = str(sub_task_chat.id)
                pending_task["chat_id"] = sub_task_chat_id
                logger.info(f"📝 Created chat for backward-compatible sub-task: {sub_task_session_id}")

            # Update task status to processing
            pending_task["status"] = "processing"
            pending_task["started_at"] = datetime.now(timezone.utc).isoformat()

            # Also update the sub-task chat's metadata status
            if sub_task_chat_id:
                sub_task_chat = await db.get(Chat, UUID(sub_task_chat_id))
                if sub_task_chat:
                    content = sub_task_chat.content.copy()
                    if "metadata" in content:
                        content["metadata"]["status"] = "processing"
                        sub_task_chat.content = content
                        flag_modified(sub_task_chat, "content")
                        db.add(sub_task_chat)
            
            # Update parent chat metadata
            metadata["current_sub_task"] = pending_index
            metadata["sub_task_sessions"] = sub_task_sessions
            
            current_content = parent_chat.content.copy()
            current_content["metadata"] = metadata
            parent_chat.content = current_content
            flag_modified(parent_chat, "content")
            
            db.add(parent_chat)
            await db.commit()
            
            logger.info(f"▶️ Starting sub-task {pending_index + 1}/{len(sub_task_sessions)}: {pending_task['title']}")
            
            return {
                "sequence": pending_task["sequence"],
                "title": pending_task["title"],
                "description": pending_task["description"],
                "prompt": pending_task["prompt"],
                "session_id": sub_task_session_id,
                "chat_id": sub_task_chat_id,
                "parent_session_id": parent_session_id,
                "sub_project_id": str(sub_project_id)
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to start next sub-task: {e}")
            raise
    
    async def handle_sub_task_completion(
        self,
        db: AsyncSession,
        completed_chat: Chat
    ) -> bool:
        """
        Handle completion of a sub-task.
        
        Updates breakdown metadata and triggers next sub-task if available.
        
        Args:
            db: Database session
            completed_chat: The completed assistant message
            
        Returns:
            True if next sub-task was triggered, False otherwise
        """
        try:
            # Check if this is a sub-task
            if not completed_chat.parent_session_id:
                return False
            
            # Check if parent_session_id is different from session_id (indicating it's a sub-task)
            if completed_chat.parent_session_id == completed_chat.session_id:
                return False
            
            logger.info(f"🎯 Handling sub-task completion for session {completed_chat.session_id[:8]}...")
            
            # Get parent chat
            stmt = select(Chat).where(
                Chat.session_id == completed_chat.parent_session_id,
                Chat.role == "user",
                Chat.sub_project_id == completed_chat.sub_project_id
            ).order_by(Chat.created_at.asc()).limit(1)
            
            result = await db.execute(stmt)
            parent_chat = result.scalar_one_or_none()
            
            if not parent_chat:
                logger.error(f"❌ Parent chat not found for completed sub-task")
                return False
            
            # Get breakdown metadata
            metadata = parent_chat.content.get("metadata", {})
            if not metadata.get("is_breakdown_parent"):
                logger.warning(f"⚠️ Parent chat is not a breakdown parent")
                return False
            
            sub_task_sessions = metadata.get("sub_task_sessions", [])
            
            # Find and update the completed sub-task
            updated = False
            completed_task_chat_id = None
            for task_info in sub_task_sessions:
                if task_info["session_id"] == completed_chat.session_id:
                    task_info["status"] = "completed"
                    task_info["completed_at"] = datetime.now(timezone.utc).isoformat()
                    completed_task_chat_id = task_info.get("chat_id")

                    # Extract result summary from completed chat
                    if completed_chat.content:
                        text = completed_chat.content.get("text", "")
                        # Take first 200 chars as summary
                        task_info["result_summary"] = text[:200] + "..." if len(text) > 200 else text

                    metadata["completed_sub_tasks"] = metadata.get("completed_sub_tasks", 0) + 1
                    updated = True
                    logger.info(f"✅ Sub-task {task_info['sequence']} marked as completed")
                    break

            if not updated:
                logger.warning(f"⚠️ Could not find sub-task with session_id {completed_chat.session_id}")
                return False

            # Also update the individual sub-task user chat's metadata to "completed"
            if completed_task_chat_id:
                sub_task_user_chat = await db.get(Chat, UUID(completed_task_chat_id))
                if sub_task_user_chat:
                    sub_task_content = sub_task_user_chat.content.copy()
                    if "metadata" in sub_task_content:
                        sub_task_content["metadata"]["status"] = "completed"
                        sub_task_user_chat.content = sub_task_content
                        flag_modified(sub_task_user_chat, "content")
                        db.add(sub_task_user_chat)
                        logger.info(f"📝 Updated sub-task user chat metadata to completed")
            
            # Update parent chat metadata
            metadata["sub_task_sessions"] = sub_task_sessions
            current_content = parent_chat.content.copy()
            current_content["metadata"] = metadata
            parent_chat.content = current_content
            flag_modified(parent_chat, "content")
            
            db.add(parent_chat)
            await db.commit()
            
            # Check if all sub-tasks are completed
            total = metadata.get("total_sub_tasks", 0)
            completed = metadata.get("completed_sub_tasks", 0)
            
            if completed >= total:
                logger.info(f"🎉 All sub-tasks completed for breakdown {parent_chat.session_id[:8]}...")
                return False
            
            # Trigger next sub-task
            logger.info(f"⏭️ Triggering next sub-task ({completed + 1}/{total})")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to handle sub-task completion: {e}")
            return False

    async def handle_sub_task_failure(
        self,
        db: AsyncSession,
        failed_chat: Chat,
        error_message: str = ""
    ) -> bool:
        """
        Handle failure of a sub-task.

        Updates breakdown metadata to mark the sub-task as failed.

        Args:
            db: Database session
            failed_chat: The failed chat (user or assistant message)
            error_message: The error message from the failure

        Returns:
            True if successfully marked as failed, False otherwise
        """
        try:
            # Check if this is a sub-task
            if not failed_chat.parent_session_id:
                return False

            # Check if parent_session_id is different from session_id (indicating it's a sub-task)
            if failed_chat.parent_session_id == failed_chat.session_id:
                return False

            logger.info(f"❌ Handling sub-task failure for session {failed_chat.session_id[:8]}...")

            # Get parent chat
            stmt = select(Chat).where(
                Chat.session_id == failed_chat.parent_session_id,
                Chat.role == "user",
                Chat.sub_project_id == failed_chat.sub_project_id
            ).order_by(Chat.created_at.asc()).limit(1)

            result = await db.execute(stmt)
            parent_chat = result.scalar_one_or_none()

            if not parent_chat:
                logger.error(f"❌ Parent chat not found for failed sub-task")
                return False

            # Get breakdown metadata
            metadata = parent_chat.content.get("metadata", {})
            if not metadata.get("is_breakdown_parent"):
                logger.warning(f"⚠️ Parent chat is not a breakdown parent")
                return False

            sub_task_sessions = metadata.get("sub_task_sessions", [])

            # Find and update the failed sub-task
            updated = False
            for task_info in sub_task_sessions:
                if task_info["session_id"] == failed_chat.session_id:
                    task_info["status"] = "failed"
                    task_info["completed_at"] = datetime.now(timezone.utc).isoformat()
                    task_info["result_summary"] = error_message[:500] if error_message else "Task failed"
                    updated = True
                    logger.info(f"❌ Sub-task {task_info['sequence']} marked as failed")
                    break

            if not updated:
                logger.warning(f"⚠️ Could not find sub-task with session_id {failed_chat.session_id}")
                return False

            # Update parent chat metadata
            metadata["sub_task_sessions"] = sub_task_sessions
            current_content = parent_chat.content.copy()
            current_content["metadata"] = metadata
            parent_chat.content = current_content
            flag_modified(parent_chat, "content")

            db.add(parent_chat)
            await db.commit()

            logger.info(f"💾 Sub-task failure recorded for breakdown {parent_chat.session_id[:8]}...")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to handle sub-task failure: {e}")
            return False

    async def retry_sub_task(
        self,
        db: AsyncSession,
        parent_session_id: str,
        sub_project_id: UUID,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retry a failed sub-task.

        Resets the sub-task status to pending and returns task info for re-execution.

        Args:
            db: Database session
            parent_session_id: The parent session ID
            sub_project_id: The sub-project ID
            session_id: The session ID of the failed sub-task to retry

        Returns:
            Dict with sub-task info for retry, or None if not found
        """
        try:
            # Get parent chat
            stmt = select(Chat).where(
                Chat.session_id == parent_session_id,
                Chat.role == "user",
                Chat.sub_project_id == sub_project_id
            ).order_by(Chat.created_at.asc()).limit(1)

            result = await db.execute(stmt)
            parent_chat = result.scalar_one_or_none()

            if not parent_chat:
                logger.error(f"❌ Parent chat not found for retry")
                return None

            # Get breakdown metadata
            metadata = parent_chat.content.get("metadata", {})
            if not metadata.get("is_breakdown_parent"):
                logger.error(f"❌ Chat is not a breakdown parent")
                return None

            sub_task_sessions = metadata.get("sub_task_sessions", [])

            # Find the failed task
            task_to_retry = None
            for task_info in sub_task_sessions:
                if task_info["session_id"] == session_id:
                    if task_info["status"] != "failed":
                        logger.warning(f"⚠️ Sub-task is not in failed state: {task_info['status']}")
                        return None
                    task_to_retry = task_info
                    break

            if not task_to_retry:
                logger.error(f"❌ Sub-task not found for retry: {session_id}")
                return None

            # Reset task status to processing
            task_to_retry["status"] = "processing"
            task_to_retry["started_at"] = datetime.now(timezone.utc).isoformat()
            task_to_retry["completed_at"] = None
            task_to_retry["result_summary"] = None

            # Update parent chat metadata
            metadata["sub_task_sessions"] = sub_task_sessions
            current_content = parent_chat.content.copy()
            current_content["metadata"] = metadata
            parent_chat.content = current_content
            flag_modified(parent_chat, "content")

            db.add(parent_chat)
            await db.commit()

            logger.info(f"🔄 Sub-task {task_to_retry['sequence']} reset for retry")

            return {
                "session_id": task_to_retry["session_id"],
                "chat_id": task_to_retry.get("chat_id"),
                "sequence": task_to_retry["sequence"],
                "title": task_to_retry["title"],
                "prompt": task_to_retry["prompt"],
                "parent_session_id": parent_session_id
            }

        except Exception as e:
            logger.error(f"❌ Failed to retry sub-task: {e}")
            return None
    
    async def get_breakdown_status(
        self,
        db: AsyncSession,
        parent_session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get current status of a breakdown.
        
        Args:
            db: Database session
            parent_session_id: The parent session ID
            
        Returns:
            Breakdown status dict or None if not found
        """
        try:
            # Get parent chat
            stmt = select(Chat).where(
                Chat.session_id == parent_session_id,
                Chat.role == "user"
            ).order_by(Chat.created_at.asc()).limit(1)
            
            result = await db.execute(stmt)
            parent_chat = result.scalar_one_or_none()
            
            if not parent_chat:
                return None
            
            # Get breakdown metadata
            metadata = parent_chat.content.get("metadata", {})
            if not metadata.get("is_breakdown_parent"):
                return None
            
            return {
                "parent_session_id": parent_session_id,
                "total_sub_tasks": metadata.get("total_sub_tasks", 0),
                "completed_sub_tasks": metadata.get("completed_sub_tasks", 0),
                "current_sub_task": metadata.get("current_sub_task", 0),
                "sub_task_sessions": metadata.get("sub_task_sessions", []),
                "reasoning": metadata.get("breakdown_analysis", {}).get("reasoning", "")
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get breakdown status: {e}")
            return None
    
    async def get_breakdown_group(
        self,
        db: AsyncSession,
        session_id: str,
        sub_project_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get all sessions in a breakdown group (parent + children).
        
        Args:
            db: Database session
            session_id: Any session ID in the group
            sub_project_id: The sub-project ID
            
        Returns:
            Dict with parent and child sessions
        """
        try:
            # First, find the parent session ID
            stmt = select(Chat).where(
                Chat.session_id == session_id,
                Chat.sub_project_id == sub_project_id
            ).limit(1)
            
            result = await db.execute(stmt)
            any_chat = result.scalar_one_or_none()
            
            if not any_chat:
                return None
            
            parent_session_id = any_chat.parent_session_id or session_id
            
            # Get parent session messages
            stmt = select(Chat).where(
                Chat.session_id == parent_session_id,
                Chat.sub_project_id == sub_project_id
            ).order_by(Chat.created_at.asc())
            
            result = await db.execute(stmt)
            parent_messages = list(result.scalars().all())
            
            # Get child sessions (where parent_session_id = parent_session_id but session_id != parent_session_id)
            stmt = select(Chat.session_id).distinct().where(
                Chat.parent_session_id == parent_session_id,
                Chat.session_id != parent_session_id,
                Chat.sub_project_id == sub_project_id
            )
            
            result = await db.execute(stmt)
            child_session_ids = [row[0] for row in result.all()]
            
            # Get messages for each child session
            child_sessions = []
            for child_session_id in child_session_ids:
                stmt = select(Chat).where(
                    Chat.session_id == child_session_id,
                    Chat.sub_project_id == sub_project_id
                ).order_by(Chat.created_at.asc())
                
                result = await db.execute(stmt)
                messages = list(result.scalars().all())
                child_sessions.append({
                    "session_id": child_session_id,
                    "messages": messages
                })
            
            return {
                "parent_session_id": parent_session_id,
                "parent_messages": parent_messages,
                "child_sessions": child_sessions
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get breakdown group: {e}")
            return None


# Global service instance
task_orchestration_service = TaskOrchestrationService()

