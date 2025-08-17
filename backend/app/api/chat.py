from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import redis.asyncio as redis
from typing import Optional, List, Dict, Any
import json
import asyncio
import logging
from uuid import uuid4, UUID

from app.deps import get_session, get_redis_client
from app.models import Chat, SubProject, Project, Task, ChatHook
from app.schemas import QueryRequest, QueryResponse
from app.services.cwd import parse_cwd
from app.services.chat_service import chat_service

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def handle_query(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    # Don't generate session_id here - wait for remote service response
    temp_session_id = request.session_id or str(uuid4())  # Temporary ID for tracking
    # First try to parse existing cwd
    sub_project_id = await parse_cwd(request.cwd, session)
    
    # If not found, create the project/task/subproject structure
    if not sub_project_id:
        parts = request.cwd.split("/")
        if len(parts) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cwd format. Expected: project_name/task_name/sub_project_name"
            )
        
        project_name = parts[0]
        task_name = parts[1]
        
        # Find or create project (get the most recent one if multiple exist)
        result = await session.execute(
            select(Project)
            .where(Project.name == project_name)
            .order_by(Project.created_at.desc())
            .limit(1)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_name}' not found"
            )
        
        # Find or create task
        result = await session.execute(
            select(Task)
            .where(Task.project_id == project.id)
            .where(Task.name == task_name)
        )
        task = result.scalar_one_or_none()
        
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task '{task_name}' not found in project '{project_name}'"
            )
        
        # Find existing sub_project or create new one
        result = await session.execute(
            select(SubProject)
            .where(SubProject.task_id == task.id)
            .order_by(SubProject.created_at.desc())
            .limit(1)
        )
        sub_project = result.scalar_one_or_none()
        
        if not sub_project:
            # Only create new sub_project if none exists
            sub_project = SubProject(task_id=task.id)
            session.add(sub_project)
            await session.commit()
            await session.refresh(sub_project)
            logger.info(f"📁 Created new sub_project: {str(sub_project.id)[:8]}... for task: {task_name}")
        else:
            logger.info(f"📂 Using existing sub_project: {str(sub_project.id)[:8]}... for task: {task_name}")
        
        sub_project_id = sub_project.id
    
    # Create chat record - will update session_id later
    chat = Chat(
        sub_project_id=sub_project_id,
        session_id=temp_session_id,  # Use temp ID for now
        role="user",
        content={"text": request.prompt}
    )
    session.add(chat)
    await session.commit()
    await session.refresh(chat)
    
    # Use the new chat service with remote integration
    try:
        # CONVERSATION CONTINUITY FIX: Maintain stable UI session ID throughout entire conversation
        # Core principle: UI session ID never changes, webhook session IDs are tracked in metadata
        ui_session_id = request.session_id  # This will remain constant for the conversation
        webhook_session_id_to_use = None
        
        if ui_session_id:            
            stmt = select(Chat).where(
                Chat.session_id == ui_session_id,
                Chat.role == "assistant"
            ).order_by(Chat.created_at.desc()).limit(1)
            
            result = await session.execute(stmt)
            last_assistant = result.scalar_one_or_none()            
            if last_assistant and last_assistant.content.get("metadata"):
                metadata = last_assistant.content["metadata"]
                # Priority: next_session_id (from completed conversation) > webhook_session_id
                webhook_session_id_to_use = metadata.get("next_session_id")
        print(f"webhook_session_id_to_use: {webhook_session_id_to_use}")
        # Use webhook session ID for remote service, UI session ID for database
        result = await chat_service.send_query(
            session, 
            chat.id, 
            request.prompt, 
            webhook_session_id_to_use,  # Use webhook session_id for remote service
            request.bypass_mode,
            request.agent_name
        )
        
        # Get the session_id and task_id from the remote service response
        response_session_id = result.get("session_id")
        task_id = result.get("task_id")
        
        if not response_session_id:
            # If remote service didn't return session_id, use the UI session or generate new
            response_session_id = ui_session_id or temp_session_id
    
        final_ui_session_id = ui_session_id or response_session_id
        
        # Update user chat record to use the stable UI session ID
        if chat.session_id != final_ui_session_id:

            chat.session_id = final_ui_session_id
            session.add(chat)
            await session.commit()
        
        # Create assistant response chat record with stable UI session_id for continuity
        assistant_chat = Chat(
            sub_project_id=sub_project_id,
            session_id=final_ui_session_id,  # Use stable UI session_id for conversation continuity
            role="assistant",
            content={
                "text": result.get("assistant_response", "Processing your request..."),
                "metadata": {
                    "task_id": task_id,
                    "initial_response": True,
                    "webhook_session_id": response_session_id  # Store webhook session_id for future reference
                }
            }
        )
        session.add(assistant_chat)
        await session.commit()
        await session.refresh(assistant_chat)
        
        response_data = {
            "session_id": final_ui_session_id,  # Return stable UI session_id for frontend continuity
            "assistant_response": result.get("assistant_response", "Processing your request..."),
            "chat_id": str(chat.id),
            "assistant_chat_id": str(assistant_chat.id)
        }
        
        # CRITICAL VALIDATION: Ensure we NEVER return a different session_id for continuing conversations
        if ui_session_id and response_data["session_id"] != ui_session_id:

            # Force correction to maintain continuity
            response_data["session_id"] = ui_session_id
        
        # Include task_id if available
        if task_id:
            response_data["task_id"] = task_id
            
        return QueryResponse(**response_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Chat service temporarily unavailable: {str(e)}"
        )


@router.post("/chats/{chat_id}/query")
async def send_chat_query(
    chat_id: UUID,
    request: dict,
    session: AsyncSession = Depends(get_session)
):
    """Send a query for a specific chat with remote service integration"""
    prompt = request.get("prompt")
    session_id = request.get("session_id")
    
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt is required"
        )
    
    try:
        result = await chat_service.send_query(session, chat_id, prompt, session_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to send query: {str(e)}"
        )


@router.get("/chats/{chat_id}/hooks")
async def get_chat_hooks(
    chat_id: UUID,
    session_id: Optional[str] = None,
    limit: int = 500,
    session: AsyncSession = Depends(get_session)
):
    """Get chat processing hooks"""
    try:
        hooks = await chat_service.get_chat_hooks(session, chat_id, session_id, limit)
        return {
            "chat_id": chat_id,
            "session_id": session_id,
            "hooks": hooks
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chat hooks: {str(e)}"
        )


@router.get("/messages/{message_id}/hooks")
async def get_message_hooks(
    message_id: UUID,
    limit: int = 500,
    session: AsyncSession = Depends(get_session)
):
    """Get hooks for a specific message (assistant or user)"""
    try:
        # First get the message
        message = await session.get(Chat, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # If it's an assistant message, get task_id from metadata
        if message.role == "assistant":
            task_id = message.content.get("metadata", {}).get("task_id")
            
            if task_id:
                # Get all hooks with this task_id
                result = await session.execute(
                    select(ChatHook)
                    .where(ChatHook.data.op('->>')('task_id') == task_id)
                    .order_by(ChatHook.received_at)
                    .limit(limit)
                )
                hooks_models = result.scalars().all()
                
                # Convert to response format
                hooks = [
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
                    for hook in hooks_models
                ]
            else:
                # Fallback: find the corresponding user message
                result = await session.execute(
                    select(Chat)
                    .where(Chat.sub_project_id == message.sub_project_id)
                    .where(Chat.session_id == message.session_id)
                    .where(Chat.role == "user")
                    .where(Chat.created_at < message.created_at)
                    .order_by(Chat.created_at.desc())
                    .limit(1)
                )
                user_message = result.scalar_one_or_none()
                
                if user_message:
                    hooks = await chat_service.get_chat_hooks(session, user_message.id, message.session_id, limit)
                else:
                    hooks = []
        else:
            # If it's a user message, get hooks directly
            hooks = await chat_service.get_chat_hooks(session, message_id, message.session_id, limit)
        
        return {
            "message_id": str(message_id),
            "session_id": message.session_id,
            "hooks": hooks
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get message hooks: {str(e)}"
        )


@router.post("/init_project")
async def init_project(
    request: dict,
    session: AsyncSession = Depends(get_session)
):
    org_name = request.get("org_name")
    cwd = request.get("cwd")
    repo_url = request.get("repo_url")
    webhook_url = request.get("webhook_url")
    
    # Validate repo_url is a GitHub SSH URL
    if repo_url:
        import re
        pattern = r'^git@github\.com:[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+\.git$'
        if not re.match(pattern, repo_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid repository URL. Only GitHub SSH URLs are allowed (e.g., git@github.com:username/repo-name.git)"
            )
    
    parts = cwd.split("/")
    if len(parts) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cwd format"
        )
    
    project_name = parts[0]
    task_name = parts[1] if len(parts) > 1 else "default"
    
    result = await session.execute(
        select(Project)
        .where(Project.name == project_name)
        .order_by(Project.created_at.desc())
        .limit(1)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        project = Project(name=project_name, repo_url=repo_url)
        session.add(project)
        await session.commit()
        await session.refresh(project)
    
    result = await session.execute(
        select(Task)
        .where(Task.project_id == project.id)
        .where(Task.name == task_name)
    )
    task = result.scalar_one_or_none()
    
    if not task:
        task = Task(name=task_name, project_id=project.id)
        session.add(task)
        await session.commit()
        await session.refresh(task)
    
    sub_project = SubProject(task_id=task.id)
    session.add(sub_project)
    await session.commit()
    await session.refresh(sub_project)
    
    return {
        "project_id": str(project.id),
        "task_id": str(task.id),
        "sub_project_id": str(sub_project.id)
    }


@router.get("/chats/session/{session_id}")
async def get_session_chats(
    session_id: str,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    """Get all chat messages for a conversation thread - FIXED for conversation continuity"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # CRITICAL FIX: Only return messages that belong to the specific session
        # The original code was causing conversation mixing by including all sub_project messages
        
        logger.info(f"🔍 Getting session chats for session_id: {session_id}")
        
        # Get messages that belong strictly to this session_id
        result = await session.execute(
            select(Chat)
            .where(Chat.session_id == session_id)
            .order_by(Chat.created_at)
        )
        chats = list(result.scalars().all())
                
        # SECURITY CHECK: Verify all messages belong to the same sub_project
        if chats:
            sub_project_ids = set(chat.sub_project_id for chat in chats)
            if len(sub_project_ids) > 1:
                logger.warning(f"⚠️ Session {session_id} spans multiple sub_projects: {sub_project_ids}")
                # Filter to the most common sub_project_id to prevent leakage
                from collections import Counter
                most_common_sub_project = Counter(chat.sub_project_id for chat in chats).most_common(1)[0][0]
                chats = [chat for chat in chats if chat.sub_project_id == most_common_sub_project]
                logger.info(f"🔧 Filtered to {len(chats)} messages from primary sub_project")
        
        # For auto-continuation support, we can look for linked messages through metadata
        # But ONLY if they have explicit references in metadata (next_session_id, etc.)
        if chats:
            # Check if any assistant message has continuation metadata
            for chat in chats:
                if chat.role == 'assistant':
                    metadata = chat.content.get('metadata', {})
                    next_session_id = metadata.get('next_session_id')
                    
                    # If there's a next_session_id, include those messages too
                    if next_session_id and next_session_id != session_id:
                        logger.info(f"🔗 Following continuation chain: {session_id} -> {next_session_id}")
                        
                        # Get continuation messages
                        continuation_result = await session.execute(
                            select(Chat)
                            .where(Chat.session_id == next_session_id)
                            .where(Chat.sub_project_id == chat.sub_project_id)  # Same sub_project only
                            .order_by(Chat.created_at)
                        )
                        continuation_chats = list(continuation_result.scalars().all())
                        
                        # Add continuation messages to the conversation
                        chats.extend(continuation_chats)
                        logger.info(f"➕ Added {len(continuation_chats)} continuation messages")
                        
                        # Re-sort by creation time
                        chats.sort(key=lambda x: x.created_at)
        
        # Apply limit if needed
        if limit and len(chats) > limit:
            chats = chats[-limit:]  # Get the most recent messages
        
        logger.info(f"📊 SESSION CHATS | session_id={session_id} | found={len(chats)} messages")
        
        response_data = {
            "session_id": session_id,
            "messages": [
                {
                    "id": str(chat.id),
                    "role": chat.role,
                    "content": chat.content,
                    "created_at": chat.created_at.isoformat(),
                    "sub_project_id": str(chat.sub_project_id),
                    "session_id": chat.session_id,
                    "continuation_status": getattr(chat, 'continuation_status', None),
                    "parent_message_id": str(chat.parent_message_id) if chat.parent_message_id else None
                }
                for chat in chats
            ]
        }
        
        return Response(
            content=json.dumps(response_data),
            media_type="application/json",
            headers={
                "Cache-Control": "no-cache, must-revalidate",
                "Pragma": "no-cache"
            }
        )
    except Exception as e:
        logger.error(f"❌ Failed to get session chats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get session chats: {str(e)}"
        )


@router.get("/sub-projects/{sub_project_id}/sessions")
async def get_sub_project_sessions(
    sub_project_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get all conversation sessions for a sub-project - FIXED for conversation continuity"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # CRITICAL FIX: Group by actual session_id instead of time-based heuristics
        # This prevents different conversations from being grouped together
        
        logger.info(f"🔍 Getting sessions for sub_project: {str(sub_project_id)[:8]}...")
        
        # Get all unique session_ids for this sub_project
        result = await session.execute(
            select(Chat.session_id, Chat.created_at)
            .where(Chat.sub_project_id == sub_project_id)
            .distinct(Chat.session_id)
            .order_by(Chat.session_id, Chat.created_at)
        )
        unique_sessions = result.all()
        
        if not unique_sessions:
            logger.info("📭 No sessions found")
            return {"sessions": []}
        
        logger.info(f"📊 Found {len(unique_sessions)} unique sessions")
        
        # Get session details
        sessions = []
        for session_id, _ in unique_sessions:
            # Get all messages for this session
            result = await session.execute(
                select(Chat)
                .where(Chat.sub_project_id == sub_project_id)
                .where(Chat.session_id == session_id)
                .order_by(Chat.created_at)
            )
            session_chats = list(result.scalars().all())
            
            if session_chats:
                # Find the first user message for the session summary
                first_user_message = None
                for chat in session_chats:
                    if chat.role in ["user", "auto"] and chat.content.get("text"):
                        first_user_message = chat
                        break
                
                first_message_text = ""
                if first_user_message:
                    text = first_user_message.content.get("text", "")
                    first_message_text = text[:100] + "..." if len(text) > 100 else text
                
                sessions.append({
                    "session_id": session_id,
                    "message_count": len(session_chats),
                    "first_message": first_message_text,
                    "last_message_at": session_chats[-1].created_at.isoformat(),
                    "created_at": session_chats[0].created_at.isoformat()
                })
        
        # Sort sessions by created_at in descending order (newest first)
        sessions.sort(key=lambda x: x["created_at"], reverse=True)
        
        logger.info(f"✅ Returning {len(sessions)} properly separated sessions")
        
        return {
            "sub_project_id": str(sub_project_id),
            "sessions": sessions
        }
    except Exception as e:
        logger.error(f"❌ Failed to get sessions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get sessions: {str(e)}"
        )


@router.get("/stream/{session_id}")
async def stream_session(
    session_id: str,
    redis_client: redis.Redis = Depends(get_redis_client)
):
    async def event_generator():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"chat:{session_id}")
        
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True)
                if message and message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
                await asyncio.sleep(0.1)
        finally:
            await pubsub.unsubscribe(f"chat:{session_id}")
            await pubsub.close()
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@router.post("/chats/{chat_id}/continue")
async def continue_chat(
    chat_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Manually trigger continuation for a chat message"""
    logger = logging.getLogger(__name__)
    
    try:
        # Get the chat message
        chat = await session.get(Chat, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        if chat.role != "assistant":
            raise HTTPException(
                status_code=400, 
                detail="Can only continue from assistant messages"
            )
        
        # Import continuation constants
        from app.models.chat import CONTINUATION_STATUS_IN_PROGRESS, CONTINUATION_STATUS_NEEDED, CONTINUATION_STATUS_COMPLETED
        
        # Check if continuation is already in progress
        if chat.continuation_status == CONTINUATION_STATUS_IN_PROGRESS:
            return {
                "needs_continuation": False,
                "reason": "Continuation already in progress"
            }
        
        # Get the session_id to use for continuation
        # Priority: next_session_id (from ResultMessage) > webhook_session_id > current session_id
        metadata = chat.content.get("metadata", {})
        next_session_id = metadata.get("next_session_id")
        webhook_session_id = metadata.get("webhook_session_id")
        session_id_to_use = next_session_id or webhook_session_id or chat.session_id
        
        logger.info(
            f"🔄 Manual continuation requested | "
            f"chat_id={str(chat_id)[:8]}... | "
            f"session_id={session_id_to_use} | "
            f"webhook_session_id={webhook_session_id}"
        )
        
        # Evaluate if continuation is needed
        evaluation = await chat_service.evaluate_conversation_for_continuation(
            session, chat_id, session_id_to_use
        )
        
        if not evaluation or not evaluation.get("needs_continuation"):
            # Update continuation status to completed
            chat.continuation_status = CONTINUATION_STATUS_COMPLETED
            session.add(chat)
            await session.commit()
            
            return {
                "needs_continuation": False,
                "reason": "Conversation appears complete"
            }
        
        # Update the chat to indicate continuation is needed
        chat.continuation_status = CONTINUATION_STATUS_NEEDED
        session.add(chat)
        await session.commit()
        
        # Create auto-continuation message
        # Pass webhook session ID but the function will use UI session ID
        auto_message = await chat_service.create_auto_continuation(
            session,
            chat.sub_project_id,
            session_id_to_use,  # This will be stored in metadata
            evaluation["continuation_prompt"],
            chat_id,
            ui_session_id=chat.session_id  # Explicitly pass the UI session ID from the assistant message
        )
        
        # Send the continuation query
        # Use the webhook session ID from the auto message's metadata
        auto_webhook_session_id = auto_message.content.get("metadata", {}).get("webhook_session_id", session_id_to_use)
        await chat_service.send_query(
            session,
            auto_message.id,
            evaluation["continuation_prompt"],
            auto_webhook_session_id,  # Use webhook session ID for remote service
            None,  # bypass_mode
            None   # agent_name - don't use agent for auto-continuations
        )
        
        return {
            "needs_continuation": True,
            "auto_message_id": str(auto_message.id),
            "continuation_prompt": evaluation["continuation_prompt"],
            "reasoning": evaluation.get("reasoning")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to continue chat: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to continue chat: {str(e)}"
        )


@router.post("/chats/toggle-auto-continuation")
async def toggle_auto_continuation(
    request: dict,
    session: AsyncSession = Depends(get_session)
):
    """Toggle auto-continuation for a session"""
    logger = logging.getLogger(__name__)
    
    session_id = request.get("session_id")
    enabled = request.get("enabled", True)
    
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required"
        )
    
    try:
        # Update all chats in the session with auto-continuation preference
        # Store in metadata for persistence
        stmt = select(Chat).where(
            Chat.session_id == session_id,
            Chat.role == "assistant"
        )
        
        result = await session.execute(stmt)
        chats = result.scalars().all()
        
        updated_count = 0
        for chat in chats:
            content = chat.content.copy()
            metadata = content.get("metadata", {})
            metadata["auto_continuation_enabled"] = enabled
            content["metadata"] = metadata
            
            # Force SQLAlchemy to detect the change
            from sqlalchemy.orm.attributes import flag_modified
            chat.content = content
            flag_modified(chat, "content")
            session.add(chat)
            updated_count += 1
        
        await session.commit()
        
        logger.info(
            f"🔧 Auto-continuation toggled | "
            f"session_id={session_id} | "
            f"enabled={enabled} | "
            f"updated_count={updated_count}"
        )
        
        return {
            "session_id": session_id,
            "auto_continuation_enabled": enabled,
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Failed to toggle auto-continuation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle auto-continuation: {str(e)}"
        )


@router.post("/chats/toggle-bypass-mode")
async def toggle_bypass_mode(
    request: dict,
    session: AsyncSession = Depends(get_session)
):
    """Toggle bypass mode for a session"""
    logger = logging.getLogger(__name__)
    
    session_id = request.get("session_id")
    enabled = request.get("enabled", True)
    
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required"
        )
    
    try:
        # Update all chats in the session with bypass mode preference
        # Store in metadata for persistence
        stmt = select(Chat).where(
            Chat.session_id == session_id,
            Chat.role == "assistant"
        )
        
        result = await session.execute(stmt)
        chats = result.scalars().all()
        
        updated_count = 0
        for chat in chats:
            content = chat.content.copy()
            metadata = content.get("metadata", {})
            metadata["bypass_mode_enabled"] = enabled
            content["metadata"] = metadata
            
            # Force SQLAlchemy to detect the change
            from sqlalchemy.orm.attributes import flag_modified
            chat.content = content
            flag_modified(chat, "content")
            session.add(chat)
            updated_count += 1
        
        await session.commit()
        
        logger.info(
            f"🔧 Bypass mode toggled | "
            f"session_id={session_id} | "
            f"enabled={enabled} | "
            f"updated_count={updated_count}"
        )
        
        return {
            "session_id": session_id,
            "bypass_mode_enabled": enabled,
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Failed to toggle bypass mode: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle bypass mode: {str(e)}"
        )

