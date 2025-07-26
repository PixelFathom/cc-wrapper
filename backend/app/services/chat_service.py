import httpx
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime
import time
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy import text

from app.core.settings import get_settings
from app.models import Chat, Task, Project, ChatHook
from app.models.chat import CONTINUATION_STATUS_NONE, CONTINUATION_STATUS_NEEDED, CONTINUATION_STATUS_IN_PROGRESS, CONTINUATION_STATUS_COMPLETED
from app.services.openai_service import openai_service, ConversationMessage

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self):
        self.settings = get_settings()
        self.org_name = self.settings.org_name
        self.webhook_base_url = self.settings.webhook_base_url
        self.query_url = self.settings.query_url
        self.redis_client = None
        
    def set_redis_client(self, redis_client):
        """Set Redis client for real-time updates"""
        self.redis_client = redis_client
        
    async def send_query(
        self, 
        db: AsyncSession, 
        chat_id: UUID, 
        prompt: str, 
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a query to the remote service"""
        start_time = time.time()
        
        print(
            f"🔵 send_query called | "
            f"chat_id={str(chat_id)[:8]}... | "
            f"session_id={session_id} | "
            f"prompt_length={len(prompt)}"
        )
        logger.info(
            f"🔵 send_query called | "
            f"chat_id={str(chat_id)[:8]}... | "
            f"session_id={session_id} | "
            f"prompt_length={len(prompt)}"
        )
        
        try:
            # Get chat and related task/project info
            chat = await db.get(Chat, chat_id)
            if not chat:
                raise ValueError("Chat not found")
            
            # Get sub_project first
            from app.models import SubProject
            sub_project = await db.get(SubProject, chat.sub_project_id)
            if not sub_project:
                raise ValueError("SubProject not found")
            
            # Get task and project for context
            task = await db.get(Task, sub_project.task_id)
            if not task:
                raise ValueError("Task not found")
            
            project = await db.get(Project, task.project_id)
            if not project:
                raise ValueError("Project not found")
            
            # Generate webhook URL
            webhook_url = f"{self.webhook_base_url}/api/webhooks/chat/{chat_id}"
            project_path = f"{project.name}/{task.name}-{task.id}"
            
            # Prepare request payload
            payload = {
                "prompt": prompt,
                "webhook_url": webhook_url,
                "organization_name": self.org_name,
                "project_path": project_path,
                "conversation_id": str(chat_id)
            }
            
            # Only include session_id if it's provided (for subsequent messages)
            if session_id:
                payload["session_id"] = session_id
                logger.info(f"📌 Including session_id in payload: {session_id}")
            else:
                logger.info("📌 No session_id provided, first message in conversation")
            
            # Log the complete payload
            logger.info(
                f"📤 Sending to remote service | "
                f"endpoint={self.query_url} | "
                f"payload_keys={list(payload.keys())} | "
                f"has_session_id={'session_id' in payload}"
            )
            
            # Log the request initiation with key details
            logger.info(
                f"🚀 Chat query initiated | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"project={project.name} | "
                f"task={task.name} | "
                f"endpoint={self.query_url} | "
                f"webhook={webhook_url}"
            )
            
            # Make request to remote service
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.query_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                elapsed_time = round(time.time() - start_time, 2)
                
                if response.status_code != 200:
                    logger.error(
                        f"❌ Chat query failed | "
                        f"chat_id={str(chat_id)[:8]}... | "
                        f"status={response.status_code} | "
                        f"endpoint={self.query_url} | "
                        f"duration={elapsed_time}s"
                    )
                    raise Exception(f"Query request failed: {response.status_code}")
                
                result = response.json()
                
                logger.info(
                    f"✅ Chat query successful | "
                    f"chat_id={str(chat_id)[:8]}... | "
                    f"status={response.status_code} | "
                    f"response_session_id={result.get('session_id')} | "
                    f"response_keys={list(result.keys())} | "
                    f"duration={elapsed_time}s"
                )
                
                # Store the initial query info
                await self._store_initial_hook(db, chat_id, payload, result)
                
                return result
                
        except Exception as e:
            elapsed_time = round(time.time() - start_time, 2)
            logger.error(
                f"💥 Chat query error | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"error={str(e)[:100]}... | "
                f"duration={elapsed_time}s"
            )
            raise
    
    async def _store_initial_hook(
        self, 
        db: AsyncSession, 
        chat_id: UUID, 
        payload: Dict[str, Any], 
        result: Dict[str, Any]
    ):
        """Store initial hook for the query"""
        hook = ChatHook(
            chat_id=chat_id,
            session_id=result.get("session_id", payload.get("session_id", str(chat_id))),
            hook_type="query_initiated",
            status="processing",
            data={
                "query_payload": payload,
                "response": result,
                "task_id": result.get("task_id")
            },
            message="Query sent to remote service"
        )
        
        db.add(hook)
        await db.commit()
        await db.refresh(hook)
    
    async def process_webhook(
        self, 
        db: AsyncSession, 
        chat_id: UUID, 
        webhook_data: Dict[str, Any]
    ):
        """Process incoming webhook from remote service"""
        logger.info(
            f"🟣 process_webhook called | "
            f"chat_id={str(chat_id)[:8]}... | "
            f"webhook_keys={list(webhook_data.keys())} | "
            f"webhook_session_id={webhook_data.get('session_id', 'None')}"
        )
        
        try:
            # Get the original chat to find the correct session_id and sub_project_id
            chat = await db.get(Chat, chat_id)
            if not chat:
                raise ValueError(f"Chat {chat_id} not found")
            
            logger.info(
                f"📋 Found chat | "
                f"chat.session_id={chat.session_id} | "
                f"chat.sub_project_id={str(chat.sub_project_id)[:8]}... | "
                f"chat.role={chat.role}"
            )
            
            # Use the original session_id from the chat, not from webhook
            original_session_id = chat.session_id
            webhook_session_id = webhook_data.get("session_id", str(chat_id))
            webhook_type = webhook_data.get("type", "processing")
            status = webhook_data.get("status", "received")
            
            # Log webhook processing with key details
            logger.info(
                f"📥 Webhook received | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"type={webhook_type} | "
                f"status={status} | "
                f"original_session_id={original_session_id} | "
                f"webhook_session_id={webhook_session_id} | "
                f"session_ids_match={original_session_id == webhook_session_id}"
            )
            
            # Extract fields based on new webhook format
            message_type = webhook_data.get("message_type")
            content_type = webhook_data.get("content_type")
            tool_name = webhook_data.get("tool_name")
            tool_input = webhook_data.get("tool_input")
            result = webhook_data.get("result", "")
            
            # Determine step name based on webhook data
            step_name = webhook_data.get("step_name")
            if not step_name:
                if content_type == "tool_use":
                    step_name = f"Using tool: {tool_name}"
                elif content_type == "tool_result":
                    step_name = f"Tool result: {tool_name}" if tool_name else "Tool result"
                elif content_type == "text":
                    step_name = "Assistant response"
                elif status == "user_message":
                    step_name = "Received user message"
                elif status == "processing":
                    step_name = "Processing request"
                elif status == "completed":
                    step_name = "Completed response"
                elif webhook_type == "thinking":
                    step_name = webhook_data.get("content", "Thinking...")
                else:
                    step_name = status.replace("_", " ").title()
            
            # Extract message from various possible locations
            message = webhook_data.get("message", "")
            if not message and result:
                # Use result as message for display
                message = str(result)[:500]  # Truncate long results
            print(f"Message: {message}")
            # Create hook entry with webhook session_id for tracking
            hook = ChatHook(
                chat_id=chat_id,
                session_id=webhook_session_id,
                conversation_id=webhook_data.get("conversation_id"),
                hook_type=webhook_type,
                status=status,
                data=webhook_data,
                message=message,
                message_type=message_type,
                content_type=content_type,
                tool_name=tool_name,
                tool_input=tool_input,
                is_complete=webhook_data.get("is_complete", status == "completed"),
                step_name=step_name,
                step_index=webhook_data.get("step_index"),
                total_steps=webhook_data.get("total_steps")
            )
            
            db.add(hook)
            
            # If this is a completed or failed message with result/error, update or create assistant chat
            # Check both old format and new ResultMessage format
            is_completion = (
                webhook_data.get("status") in ["completed", "failed"] or
                (webhook_data.get("message_type") == "ResultMessage" and webhook_data.get("content_type") == "result")
            )
            
            # Initialize next_session_id
            next_session_id = None
            
            if is_completion:
                result_text = webhook_data.get("result", "")
                error_text = webhook_data.get("error", "")
                
                # Handle None values
                result_text = result_text if result_text is not None else ""
                error_text = error_text if error_text is not None else ""
                
                print(f"🔍 Processing completion webhook | status={webhook_data.get('status')} | message_type={webhook_data.get('message_type')} | result_length={len(result_text)} | error_length={len(error_text)}")
                
                # Extract the new session_id from completed status webhook
                # Note: We'll store this after the assistant message is created/updated
                
                # Log completion status
                if webhook_data.get("status") == "completed" or webhook_data.get("message_type") == "ResultMessage":
                    logger.info(
                        f"🎉 Chat completed | "
                        f"chat_id={str(chat_id)[:8]}... | "
                        f"response_length={len(result_text) if result_text else 0} chars | "
                        f"message_type={webhook_data.get('message_type')} | "
                        f"next_session_id={next_session_id}"
                    )
                else:
                    logger.error(
                        f"💀 Chat failed | "
                        f"chat_id={str(chat_id)[:8]}... | "
                        f"error={error_text[:100]}..."
                    )
                
                # Determine the response text
                if result_text:
                    response_text = result_text
                elif error_text:
                    response_text = f"Error: {error_text}"
                else:
                    response_text = "I apologize, but I encountered an issue processing your request."
                
                print(f"🔍 Looking for assistant message | sub_project_id={str(chat.sub_project_id)[:8]}... | session_id={original_session_id}")
                
                # First, let's see all assistant messages in this session
                all_stmt = select(Chat).where(
                    Chat.sub_project_id == chat.sub_project_id,
                    Chat.session_id == original_session_id,
                    Chat.role == "assistant"
                ).order_by(Chat.created_at.desc())
                
                all_result = await db.execute(all_stmt)
                all_assistants = all_result.scalars().all()
                print(f"🔍 Found {len(all_assistants)} assistant messages in session")
                for asst in all_assistants:
                    print(f"   - ID: {str(asst.id)[:8]}... | Text: {asst.content.get('text', '')[:50]}...")
                
                # Find the existing assistant message using task_id
                task_id = webhook_data.get("task_id")
                existing_assistant = None
                
                if task_id:
                    # Look for assistant message with this task_id in metadata
                    stmt = select(Chat).where(
                        Chat.sub_project_id == chat.sub_project_id,
                        Chat.session_id == original_session_id,
                        Chat.role == "assistant",
                        Chat.content.op('->')('metadata').op('->>')('task_id') == task_id
                    ).order_by(Chat.created_at.desc()).limit(1)
                    
                    result = await db.execute(stmt)
                    existing_assistant = result.scalar_one_or_none()
                
                # If not found by task_id, try to find by initial_response flag
                if not existing_assistant:
                    stmt = select(Chat).where(
                        Chat.sub_project_id == chat.sub_project_id,
                        Chat.session_id == original_session_id,
                        Chat.role == "assistant",
                        Chat.content.op('->')('metadata').op('->>')('initial_response') == 'true'
                    ).order_by(Chat.created_at.desc()).limit(1)
                    
                    result = await db.execute(stmt)
                    existing_assistant = result.scalar_one_or_none()
                
                print(f"🔍 Found existing assistant message: {existing_assistant is not None} | assistant_id={str(existing_assistant.id)[:8] if existing_assistant else 'None'}...")
                
                if existing_assistant:
                    # Update existing message
                    print(f"✏️ Updating existing assistant message {str(existing_assistant.id)[:8]}...")
                    print(f"   Current text: {existing_assistant.content.get('text', '')[:50]}...")
                    print(f"   New text: {response_text[:50]}...")
                    
                    # Preserve the original metadata and update with new values
                    current_content = existing_assistant.content.copy()
                    current_metadata = current_content.get("metadata", {})
                    current_metadata.update({
                        "task_id": webhook_data.get("task_id"),
                        "conversation_id": webhook_data.get("conversation_id"),
                        "webhook_session_id": webhook_session_id,
                        "status": webhook_data.get("status")
                    })
                    
                    # If we have a new session_id from ResultMessage, update the assistant message session_id too
                    if next_session_id:
                        logger.info(
                            f"🔄 ASSISTANT SESSION UPDATE | "
                            f"assistant_id={str(existing_assistant.id)[:8]}... | "
                            f"old_session_id={existing_assistant.session_id} | "
                            f"new_session_id={next_session_id}"
                        )
                        existing_assistant.session_id = next_session_id
                    
                    # Create new content dict and force SQLAlchemy to detect the change
                    from sqlalchemy.orm.attributes import flag_modified
                    new_content = {
                        "text": response_text,
                        "metadata": current_metadata
                    }
                    existing_assistant.content = new_content
                    flag_modified(existing_assistant, "content")
                    
                    db.add(existing_assistant)
                    
                    logger.info(
                        f"📝 Updated assistant message | "
                        f"webhook_session_id={webhook_session_id} | "
                        f"status={webhook_data.get('status')}"
                    )
                else:
                    # Before creating new, check if there's already an assistant message with same text
                    stmt = select(Chat).where(
                        Chat.sub_project_id == chat.sub_project_id,
                        Chat.session_id == original_session_id,
                        Chat.role == "assistant",
                        Chat.content.op('->>')('text') == response_text
                    ).order_by(Chat.created_at.desc()).limit(1)
                    
                    result = await db.execute(stmt)
                    duplicate_check = result.scalar_one_or_none()
                    
                    if duplicate_check:
                        print(f"⚠️ Found existing assistant message with same text, updating it instead")
                        existing_assistant = duplicate_check
                        # Update its metadata
                        current_metadata = existing_assistant.content.get("metadata", {})
                        current_metadata.update({
                            "task_id": webhook_data.get("task_id"),
                            "conversation_id": webhook_data.get("conversation_id"),
                            "webhook_session_id": webhook_session_id,
                            "status": webhook_data.get("status")
                        })
                        
                        # If we have a new session_id from ResultMessage, update the assistant message session_id too
                        if next_session_id:
                            logger.info(f"🔄 Updating duplicate assistant message session_id from {existing_assistant.session_id} to {next_session_id}")
                            existing_assistant.session_id = next_session_id
                        
                        existing_assistant.content = {
                            "text": response_text,
                            "metadata": current_metadata
                        }
                        db.add(existing_assistant)
                    else:
                        # Create new assistant message only if we really need to
                        # Use the new session_id if available, otherwise use original
                        session_id_for_assistant = next_session_id if next_session_id else original_session_id
                        print(f"➕ Creating new assistant message for session {session_id_for_assistant}")
                        print(f"   Task ID: {task_id}")
                        print(f"   Response text: {response_text[:50]}...")
                        assistant_chat = Chat(
                            sub_project_id=chat.sub_project_id,
                            session_id=session_id_for_assistant,
                            role="assistant",
                            content={
                                "text": response_text,
                                "metadata": {
                                    "task_id": webhook_data.get("task_id"),
                                    "conversation_id": webhook_data.get("conversation_id"),
                                    "webhook_session_id": webhook_session_id,
                                    "status": webhook_data.get("status")
                                }
                            }
                        )
                        db.add(assistant_chat)
            
            await db.commit()
            await db.refresh(hook)
            
            # Special handling for completed status webhook to ensure webhook_session_id is stored
            # This webhook comes after the ResultMessage webhook and contains the session_id
            if (webhook_data.get("status") == "completed" and 
                webhook_session_id and
                webhook_session_id != original_session_id):
                
                logger.info(
                    f"📌 Processing completed webhook with session_id only | "
                    f"webhook_session_id={webhook_session_id}"
                )
                
                # Find the most recent assistant message to update with the webhook_session_id
                stmt = select(Chat).where(
                    Chat.sub_project_id == chat.sub_project_id,
                    Chat.session_id == original_session_id,
                    Chat.role == "assistant"
                ).order_by(Chat.created_at.desc()).limit(1)
                
                result = await db.execute(stmt)
                latest_assistant = result.scalar_one_or_none()
                
                if latest_assistant:
                    logger.info(
                        f"✅ Updating assistant message with webhook_session_id | "
                        f"assistant_id={str(latest_assistant.id)[:8]}... | "
                        f"webhook_session_id={webhook_session_id}"
                    )
                    
                    # Update the metadata with webhook_session_id
                    current_content = latest_assistant.content.copy()
                    current_metadata = current_content.get("metadata", {})
                    current_metadata["webhook_session_id"] = webhook_session_id
                    current_metadata["status"] = "completed"
                    
                    # Create new content dict to ensure SQLAlchemy detects the change
                    new_content = {
                        "text": current_content.get("text", ""),
                        "metadata": current_metadata
                    }
                    
                    # Force update by using flag_modified
                    from sqlalchemy.orm.attributes import flag_modified
                    latest_assistant.content = new_content
                    flag_modified(latest_assistant, "content")
                    
                    db.add(latest_assistant)
                    await db.commit()
                    await db.refresh(latest_assistant)
                    
                    # Verify the update
                    logger.info(
                        f"✅ Successfully stored webhook_session_id in assistant message | "
                        f"verified_webhook_session_id={latest_assistant.content.get('metadata', {}).get('webhook_session_id')}"
                    )
            # Check if the last message in this conversation was a bot (assistant) message
            last_message_stmt = (
                select(Chat)
                .where(
                    Chat.sub_project_id == chat.sub_project_id,
                )
                .order_by(Chat.created_at.desc())
                .limit(1)
            )
            last_message_result = await db.execute(last_message_stmt)
            last_message = last_message_result.scalar_one_or_none()
            check = True
            if not last_message or last_message.role == "auto":
                check = False
            if (is_completion and 
                    not webhook_data.get("is_error") and 
                    webhook_data.get("status") == "completed" and 
                    webhook_data.get("result") and check):
                # Find the assistant message that was just created/updated
                task_id = webhook_data.get("task_id")
                assistant_chat = None
                
                if task_id:
                    # Look for assistant message with this task_id
                    stmt = select(Chat).where(
                        Chat.sub_project_id == chat.sub_project_id,
                        Chat.role == "assistant",
                        Chat.content.op('->')('metadata').op('->>')('task_id') == task_id
                    ).order_by(Chat.created_at.desc()).limit(1)
                    
                    result = await db.execute(stmt)
                    assistant_chat = result.scalar_one_or_none()
                
                if assistant_chat:
                    # Evaluate the conversation for auto-continuation
                    evaluation = await self.evaluate_conversation_for_continuation(
                        db, assistant_chat.id, assistant_chat.session_id
                    )
                    
                    if evaluation and evaluation.get("needs_continuation"):
                        # Create auto-continuation message
                        auto_message = await self.create_auto_continuation(
                            db,
                            assistant_chat.sub_project_id,
                            assistant_chat.session_id,
                            evaluation["continuation_prompt"],
                            assistant_chat.id
                        )
                        
                        # Send the auto-generated message to the service
                        logger.info(f"🤖 Sending auto-continuation to service | webhook_session_id={webhook_session_id}")
                        await self.send_query(
                            db,
                            auto_message.id,
                            evaluation["continuation_prompt"],
                            webhook_session_id  # Use the webhook session ID for continuity
                        )
                else:
                    logger.warning(f"⚠️ Could not find assistant message for auto-continuation evaluation")
            
            # Publish to Redis for real-time updates
            if self.redis_client:
                import json
                await self.redis_client.publish(
                    f"chat:{original_session_id}",
                    json.dumps({
                        "type": "webhook",
                        "data": webhook_data,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                )
            
        except Exception as e:
            logger.error(
                f"💥 Webhook processing error | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"error={str(e)[:100]}..."
            )
            raise
    
    async def get_chat_hooks(
        self, 
        db: AsyncSession, 
        chat_id: UUID,
        session_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get chat hooks for a specific chat and session"""
        try:
            query = select(ChatHook).where(ChatHook.chat_id == chat_id)
            
            if session_id:
                query = query.where(ChatHook.session_id == session_id)
            
            query = query.order_by(ChatHook.received_at.desc()).limit(limit)
            
            result = await db.execute(query)
            hooks = result.scalars().all()
            
            logger.debug(
                f"📋 Retrieved chat hooks | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"count={len(hooks)} | "
                f"session_id={session_id or 'all'}"
            )
            
            return [
                {
                    "id": str(hook.id),
                    "hook_type": hook.hook_type,
                    "status": hook.status,
                    "message": hook.message,
                    "data": hook.data,
                    "is_complete": hook.is_complete,
                    "received_at": hook.received_at.isoformat(),
                    "step_name": hook.step_name,
                    "step_index": hook.step_index,
                    "total_steps": hook.total_steps,
                    "message_type": hook.message_type,
                    "content_type": hook.content_type,
                    "tool_name": hook.tool_name,
                    "tool_input": hook.tool_input,
                    "conversation_id": hook.conversation_id
                }
                for hook in hooks
            ]
            
        except Exception as e:
            logger.error(
                f"💥 Error retrieving chat hooks | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"error={str(e)[:100]}..."
            )
            raise
    
    async def evaluate_conversation_for_continuation(
        self,
        db: AsyncSession,
        chat_id: UUID,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Evaluate if a conversation needs auto-continuation"""
        try:
            # Get the chat to find sub_project_id
            chat = await db.get(Chat, chat_id)
            if not chat:
                logger.error(f"Chat not found: {chat_id}")
                return None
            
            # Get the last few messages in the conversation
            stmt = select(Chat).where(
                Chat.sub_project_id == chat.sub_project_id,
                Chat.session_id == session_id,
                Chat.role.in_(["user", "assistant", "auto"])
            ).order_by(Chat.created_at.asc())
            
            result = await db.execute(stmt)
            messages = result.scalars().all()
            
            if not messages:
                return None
            
            # Get continuation count for tracking
            continuation_count = sum(1 for msg in messages if msg.role == "auto")
            
            # Always process, but log if we're at high continuation count
            if continuation_count >= 5:
                logger.warning(f"High continuation count ({continuation_count}) for session {session_id}, but continuing anyway")
            
            # Convert to format expected by OpenAI service
            conversation_messages = [
                ConversationMessage(
                    role="user" if msg.role in ["user", "auto"] else msg.role,
                    content=msg.content.get("text", "")
                )
                for msg in messages
                if msg.content.get("text")
            ]
            
            # Evaluate using GPT-4 mini
            evaluation = await openai_service.evaluate_conversation_completeness(
                conversation_messages
            )
            
            logger.info(
                f"🤖 Conversation evaluation | "
                f"session_id={session_id} | "
                f"needs_continuation={evaluation.needs_continuation} | "
                f"confidence={evaluation.confidence} | "
                f"reasoning={evaluation.reasoning}"
            )
            
            # Always return evaluation result without confidence threshold
            if evaluation.needs_continuation:
                # Update the last assistant message to indicate continuation needed
                last_message = messages[-1]
                if last_message.role == "assistant":
                    last_message.continuation_status = CONTINUATION_STATUS_NEEDED
                    db.add(last_message)
                    await db.commit()
                
                return {
                    "needs_continuation": True,
                    "continuation_prompt": evaluation.continuation_prompt or "Please continue with the previous response.",
                    "reasoning": evaluation.reasoning,
                    "continuation_count": continuation_count + 1
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error evaluating conversation: {str(e)}")
            return None
    
    async def create_auto_continuation(
        self,
        db: AsyncSession,
        sub_project_id: UUID,
        session_id: str,
        continuation_prompt: str,
        parent_message_id: Optional[UUID] = None
    ) -> Chat:
        """Create an auto-generated continuation message"""
        try:
            # Create the auto-generated message
            auto_message = Chat(
                sub_project_id=sub_project_id,
                session_id=session_id,
                role="auto",  # Mark as auto-generated
                content={
                    "text": continuation_prompt,
                    "metadata": {
                        "auto_generated": True,
                        "generation_reason": "conversation_incomplete"
                    }
                },
                continuation_status=CONTINUATION_STATUS_IN_PROGRESS,
                parent_message_id=parent_message_id
            )
            
            db.add(auto_message)
            await db.commit()
            await db.refresh(auto_message)
            
            logger.info(
                f"🤖 Created auto-continuation message | "
                f"id={str(auto_message.id)[:8]}... | "
                f"session_id={session_id} | "
                f"prompt={continuation_prompt[:50]}..."
            )
            
            return auto_message
            
        except Exception as e:
            logger.error(f"Error creating auto-continuation: {str(e)}")
            raise


# Create service instance
chat_service = ChatService()