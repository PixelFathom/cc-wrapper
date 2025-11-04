import httpx
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime, timezone
import time
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy import text

from app.core.settings import get_settings
from app.core.auto_continuation_config import get_auto_continuation_config
from app.models import Chat, Task, Project, ChatHook
from app.models.chat import CONTINUATION_STATUS_NONE, CONTINUATION_STATUS_NEEDED, CONTINUATION_STATUS_IN_PROGRESS, CONTINUATION_STATUS_COMPLETED

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
        session_id: Optional[str] = None,
        bypass_mode: Optional[bool] = None,
        permission_mode: Optional[str] = None,
        agent_name: Optional[str] = None,
        include_task_id: Optional[bool] = True
    ) -> Dict[str, Any]:
        """Send a query to the remote service"""
        start_time = time.time()
        
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
            
            project_path = f"{project.name}/{task.name}-{task.id}" if include_task_id else f"{project.name}/{task.name}"

            # Determine permission mode
            # Priority: permission_mode parameter > bypass_mode (for backward compatibility) > default to "interactive"
            if permission_mode:
                final_permission_mode = permission_mode
            elif bypass_mode is True:
                final_permission_mode = "bypassPermissions"
            elif bypass_mode is False:
                final_permission_mode = "interactive"
            else:
                final_permission_mode = "interactive"

            # Prepare request payload
            payload = {
                "prompt": prompt,
                "webhook_url": webhook_url,
                "organization_name": self.org_name,
                "project_path": project_path,
                "options": {
                    "permission_mode": final_permission_mode
                }
            }
            # Only include session_id if it's provided (for subsequent messages)
            if session_id:
                payload["session_id"] = session_id
            # Only include agent_name if it's provided
            if agent_name:
                payload["agent_name"] = agent_name

            print(f"payload: {payload}")
            
            # Make request to remote service
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.query_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    raise Exception(f"Query request failed: {response.status_code}")
                
                result = response.json()
                
                # Store the initial query info
                await self._store_initial_hook(db, chat_id, payload, result)
                
                return result
                
        except Exception as e:
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
        try:
            # Get the original chat to find the correct session_id and sub_project_id
            chat = await db.get(Chat, chat_id)
            if not chat:
                raise ValueError(f"Chat {chat_id} not found")
            
            # Use the original session_id from the chat, not from webhook
            original_session_id = chat.session_id
            webhook_session_id = chat.session_id
            webhook_type = webhook_data.get("type", "processing")
            status = webhook_data.get("status", "received")
            
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
                webhook_data.get("status") in ["completed", "failed"]
            )
            logger.info(f"is_completion: {is_completion}")
            
            # Initialize next_session_id
            next_session_id = None
            
            # Extract session_id from ResultMessage if available
            if webhook_data.get("session_id"):
                next_session_id = webhook_data.get("session_id")
            
            if is_completion:
                result_text = webhook_data.get("result", "")
                error_text = webhook_data.get("error", "")
                
                # Handle None values
                result_text = result_text if result_text is not None else ""
                error_text = error_text if error_text is not None else ""
                
                # Determine the response text
                if result_text:
                    response_text = result_text
                elif error_text:
                    response_text = f"Error: {error_text}"
                else:
                    response_text = "I apologize, but I encountered an issue processing your request."
                
                # Find the existing assistant message using task_id
                task_id = webhook_data.get("task_id")
                existing_assistant = None
                
                # Look for assistant message with this task_id in metadata
                stmt = select(Chat).where(
                    Chat.sub_project_id == chat.sub_project_id,
                    Chat.session_id == original_session_id,
                    Chat.role == "assistant",
                ).order_by(Chat.created_at.desc()).limit(1)
                
                result = await db.execute(stmt)
                existing_assistant = result.scalar_one_or_none()

                if existing_assistant:
                    # Update existing message                    
                    # Preserve the original metadata and update with new values
                    current_content = existing_assistant.content.copy()
                    current_metadata = current_content.get("metadata", {})
                    current_metadata.update({
                        "task_id": webhook_data.get("task_id"),
                        "conversation_id": webhook_data.get("conversation_id"),
                        "webhook_session_id": webhook_session_id,
                        "status": "completed"  # Always set to completed when updating with final content
                    })
                    
                    # CRITICAL FIX: NEVER update the session_id to maintain UI continuity
                    # Store the webhook session ID in metadata instead
                    if next_session_id:
                        current_metadata["next_session_id"] = next_session_id
                    # Create new content dict and force SQLAlchemy to detect the change
                    from sqlalchemy.orm.attributes import flag_modified
                    new_content = {
                        "text": response_text,
                        "metadata": current_metadata
                    }
                    existing_assistant.content = new_content
                    flag_modified(existing_assistant, "content")
                    
                    db.add(existing_assistant)
                    
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
                        existing_assistant = duplicate_check
                        # Update its metadata
                        current_metadata = existing_assistant.content.get("metadata", {})
                        current_metadata.update({
                            "task_id": webhook_data.get("task_id"),
                            "conversation_id": webhook_data.get("conversation_id"),
                            "webhook_session_id": webhook_session_id,
                            "status": "completed"  # Always set to completed when updating with final content
                        })
                        
                        # CRITICAL FIX: NEVER update the session_id to maintain UI continuity
                        # Store the webhook session ID in metadata instead
                        if next_session_id:
                            current_metadata["next_session_id"] = next_session_id
                        
                        existing_assistant.content = {
                            "text": response_text,
                            "metadata": current_metadata
                        }
                        db.add(existing_assistant)
                    else:
                        # Use original session_id for continuation responses to maintain UI continuity
                        session_id_for_assistant = original_session_id
                        
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
                                    "status": "completed",  # Always set to completed for new assistant messages with final content
                                    "next_session_id": next_session_id  # Store for future reference
                                }
                            }
                        )
                        db.add(assistant_chat)
            
            await db.commit()
            await db.refresh(hook)
            
            # Special handling for completed status webhook to ensure webhook_session_id is stored
            # Publish to Redis for real-time updates
            if self.redis_client:
                import json
                await self.redis_client.publish(
                    f"chat:{original_session_id}",
                    json.dumps({
                        "type": "webhook",
                        "data": webhook_data,
                        "timestamp": datetime.now(timezone.utc).isoformat()
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
        """Evaluate if a conversation needs auto-continuation using simple heuristics"""
        try:
            # Get the chat to find sub_project_id
            chat = await db.get(Chat, chat_id)
            if not chat:
                logger.error(f"Chat not found: {chat_id}")
                return None
            
            # Get all messages in the conversation for this sub_project
            # This ensures we get the full context regardless of session_id changes
            stmt = select(Chat).where(
                Chat.sub_project_id == chat.sub_project_id,
                Chat.role.in_(["user", "assistant", "auto"])
            ).order_by(Chat.created_at.asc())
            
            result = await db.execute(stmt)
            messages = result.scalars().all()
            
            if not messages:
                return None
            
            # Get continuation count for tracking
            continuation_count = sum(1 for msg in messages if msg.role == "auto")
            
            # Limit continuation attempts (increased from 3 to 5)
            if continuation_count >= 5:
                logger.warning(f"Max continuation count reached ({continuation_count}) for session {session_id}")
                return None
            
            # Get the last assistant message
            last_assistant_message = None
            for msg in reversed(messages):
                if msg.role == "assistant":
                    last_assistant_message = msg
                    break
            
            if not last_assistant_message:
                return None
            
            # Simple heuristic-based evaluation
            content = last_assistant_message.content.get("text", "") if last_assistant_message.content else ""
            needs_continuation = self._evaluate_message_completeness(content)
            
            # Enhanced logging for debugging
            content_preview = content[:200] + "..." if len(content) > 200 else content
            logger.info(
                f"🤖 Conversation evaluation (heuristic) | "
                f"session_id={session_id} | "
                f"needs_continuation={needs_continuation} | "
                f"message_length={len(content)} | "
                f"continuation_count={continuation_count} | "
                f"content_preview='{content_preview}'"
            )
            
            if needs_continuation:
                # Update the last assistant message to indicate continuation needed
                last_assistant_message.continuation_status = CONTINUATION_STATUS_NEEDED
                db.add(last_assistant_message)
                await db.commit()
                
                return {
                    "needs_continuation": True,
                    "continuation_prompt": "Please continue with the previous response.",
                    "reasoning": "Message appears incomplete based on heuristic analysis",
                    "continuation_count": continuation_count + 1
                }
            
            # Check for fallback conditions - short messages might need continuation too
            if len(content) < 100 and continuation_count == 0:
                logger.info(f"🔄 Considering fallback continuation for short message: {len(content)} chars")
                # For very short responses, allow one continuation attempt
                last_assistant_message.continuation_status = CONTINUATION_STATUS_NEEDED
                db.add(last_assistant_message)
                await db.commit()
                
                return {
                    "needs_continuation": True,
                    "continuation_prompt": "Could you provide more details or expand on your response?",
                    "reasoning": "Short response that might benefit from expansion",
                    "continuation_count": continuation_count + 1
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error evaluating conversation: {str(e)}")
            return None
    
    def _evaluate_message_completeness(self, content: str) -> bool:
        """Enhanced heuristic to determine if a message appears incomplete"""
        if not content or len(content.strip()) < 10:
            return False
        
        original_content = content.strip()
        content_lower = original_content.lower()
        
        # Strong indicators for continuation (explicit requests)
        explicit_continuation_phrases = [
            "would you like me to continue",
            "should i continue", 
            "let me continue",
            "i'll continue",
            "shall i proceed",
            "would you like more",
            "let me know if you want me to continue",
            "would you like me to explain more",
            "do you want me to continue",
            "more on this",
            "continue with",
            "let me know if you need",
            "would you like me to",
            "should i provide more",
            "need more details",
            "want me to continue"
        ]
        
        for phrase in explicit_continuation_phrases:
            if phrase in content_lower:
                return True
        
        # Check for incomplete code blocks
        if original_content.count("```") % 2 == 1:  # Unclosed code blocks
            return True
            
        # Check for incomplete sentences or structures
        incomplete_endings = [
            "...", "..", "and", "or", ",", "but", "however", "also", 
            "additionally", "furthermore", "moreover", "therefore", 
            "thus", "hence", "consequently", "meanwhile", "then",
            "next", "so", "yet", "still", "now", "here", "there"
        ]
        
        for ending in incomplete_endings:
            if content_lower.endswith(ending):
                return True
        
        # Check for common incomplete patterns
        incomplete_patterns = [
            "to be continued",
            "more details",
            "additional information", 
            "next steps",
            "let me know",
            "please let me know",
            "feel free to ask",
            "if you need",
            "would you like",
            "in the next",
            "coming up",
            "i'll show you",
            "let's continue",
            "moving forward",
            "going forward"
        ]
        
        for pattern in incomplete_patterns:
            if pattern in content_lower:
                return True
        
        # Check for lists or enumerations that might be incomplete
        lines = original_content.split('\n')
        if len(lines) > 1:
            last_line = lines[-1].strip()
            # Check if it ends with a numbered/bulleted list item
            if last_line and (
                last_line[-1].isdigit() or 
                last_line.endswith('.') or 
                last_line.startswith('•') or 
                last_line.startswith('-') or
                last_line.startswith('*')
            ):
                return True
        
        # Check for incomplete code or technical explanations
        technical_incomplete_indicators = [
            "here's how",
            "here's what",
            "let me show",
            "for example",
            "such as",
            "including",
            "like this",
            "as follows",
            "you can also",
            "another way",
            "alternatively"
        ]
        
        for indicator in technical_incomplete_indicators:
            if indicator in content_lower and len(original_content) < 300:
                return True
        
        return False
    
    async def create_auto_continuation(
        self,
        db: AsyncSession,
        sub_project_id: UUID,
        session_id: str,
        continuation_prompt: str,
        parent_message_id: Optional[UUID] = None,
        ui_session_id: Optional[str] = None
    ) -> Chat:
        """Create an auto-generated continuation message"""
        try:
            # Determine the UI session_id to use
            final_ui_session_id = ui_session_id  # Use explicitly passed UI session ID if available
            
            if not final_ui_session_id and parent_message_id:
                # Get the parent message to find the UI session_id
                parent_chat = await db.get(Chat, parent_message_id)
                if parent_chat:
                    # Find the original UI session by looking for the first user message
                    stmt = select(Chat).where(
                        Chat.sub_project_id == parent_chat.sub_project_id,
                        Chat.role == "user"
                    ).order_by(Chat.created_at.asc()).limit(1)
                    
                    result = await db.execute(stmt)
                    first_user_chat = result.scalar_one_or_none()
                    
                    if first_user_chat:
                        final_ui_session_id = first_user_chat.session_id
                        logger.info(
                            f"🔍 Found original UI session from first user message | "
                            f"original_ui_session_id={final_ui_session_id} | "
                            f"parent_session_id={parent_chat.session_id} | "
                            f"webhook_session_id={session_id}"
                        )
                    else:
                        # Fallback to parent's session_id if no user message found
                        final_ui_session_id = parent_chat.session_id
                        logger.info(
                            f"🔍 Using parent session_id as UI session | "
                            f"parent_session_id={parent_chat.session_id} | "
                            f"webhook_session_id={session_id}"
                        )
            
            # If still no UI session_id, use the provided session_id
            if not final_ui_session_id:
                final_ui_session_id = session_id
                logger.info(
                    f"⚠️ No UI session found, using provided session_id | "
                    f"session_id={session_id}"
                )
            
            # Create the auto-generated message with UI session_id
            auto_message = Chat(
                sub_project_id=sub_project_id,
                session_id=final_ui_session_id,  # Always use UI session_id for continuity
                role="auto",  # Mark as auto-generated
                content={
                    "text": continuation_prompt,
                    "metadata": {
                        "auto_generated": True,
                        "generation_reason": "conversation_incomplete",
                        "webhook_session_id": session_id  # Store webhook session_id for remote service
                    }
                },
                continuation_status=CONTINUATION_STATUS_IN_PROGRESS,
                parent_message_id=parent_message_id
            )
            
            db.add(auto_message)
            await db.commit()
            await db.refresh(auto_message)
            
            # Add debug information to metadata for troubleshooting
            auto_message.content["metadata"]["debug_info"] = {
                "ui_session_id_source": "explicit" if ui_session_id else ("first_user_msg" if final_ui_session_id != session_id else "fallback"),
                "original_session_id": session_id,
                "final_ui_session_id": final_ui_session_id,
                "parent_message_id": str(parent_message_id) if parent_message_id else None
            }
            
            logger.info(
                f"🤖 Created auto-continuation message | "
                f"id={str(auto_message.id)[:8]}... | "
                f"ui_session_id={final_ui_session_id} | "
                f"webhook_session_id={session_id} | "
                f"ui_source={'explicit' if ui_session_id else 'derived'} | "
                f"prompt={continuation_prompt[:50]}..."
            )
            
            return auto_message
            
        except Exception as e:
            logger.error(f"Error creating auto-continuation: {str(e)}")
            raise


# Create service instance
chat_service = ChatService()