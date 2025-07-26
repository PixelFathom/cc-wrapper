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
    import logging
    logger = logging.getLogger(__name__)
    
    print(
        f"🟢 /query endpoint called | "
        f"request.session_id={request.session_id} | "
        f"request.cwd={request.cwd} | "
        f"prompt_length={len(request.prompt)}"
    )
    logger.info(
        f"🟢 /query endpoint called | "
        f"request.session_id={request.session_id} | "
        f"request.cwd={request.cwd} | "
        f"prompt_length={len(request.prompt)}"
    )
    logger.info(f"📊 SESSION TRACKING | Initial request.session_id={request.session_id}")
    
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
        # For new user-initiated messages, we should NOT reuse session IDs from previous messages
        # This was causing all messages to attach to the same conversation
        # Only auto-continuation should reuse session IDs
        session_id_to_use = request.session_id
        
        logger.info(
            f"🔄 Using request session_id for user message | "
            f"session_id={session_id_to_use} | "
            f"is_first_message={not request.session_id}"
        )
        
        result = await chat_service.send_query(
            session, 
            chat.id, 
            request.prompt, 
            session_id_to_use,  # Use webhook session_id if available
            request.bypass_mode
        )
        
        # Get the session_id and task_id from the remote service response
        response_session_id = result.get("session_id")
        task_id = result.get("task_id")
        
        if not response_session_id:
            # If remote service didn't return session_id, use the one from request or generate new
            response_session_id = request.session_id or temp_session_id
        
        logger.info(
            f"🔄 SESSION ID FLOW | "
            f"request={request.session_id} → "
            f"response={response_session_id} | "
            f"task_id={task_id}"
        )
        
        # Update the user chat with the correct session_id if it's different
        if chat.session_id != response_session_id:
            logger.info(f"📝 Updating chat session_id from {chat.session_id} to {response_session_id}")
            chat.session_id = response_session_id
            session.add(chat)
            await session.commit()
        
        # Create assistant response chat record with same session_id and task_id
        assistant_chat = Chat(
            sub_project_id=sub_project_id,
            session_id=response_session_id,
            role="assistant",
            content={
                "text": result.get("assistant_response", "Processing your request..."),
                "metadata": {
                    "task_id": task_id,
                    "initial_response": True
                }
            }
        )
        session.add(assistant_chat)
        await session.commit()
        await session.refresh(assistant_chat)
        
        response_data = {
            "session_id": response_session_id,
            "assistant_response": result.get("assistant_response", "Processing your request..."),
            "chat_id": str(chat.id),
            "assistant_chat_id": str(assistant_chat.id)
        }
        
        # Include task_id if available
        if task_id:
            response_data["task_id"] = task_id
            
        return QueryResponse(**response_data)
    except Exception as e:
        # Log the error and raise it - no fallback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Remote chat service failed: {e}")
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
    
    # Validate repo_url is a PixelFathom SSH URL
    if repo_url:
        import re
        pattern = r'^git@github\.com:PixelFathom/[a-zA-Z0-9_-]+\.git$'
        if not re.match(pattern, repo_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid repository URL. Only PixelFathom GitHub SSH URLs are allowed (e.g., git@github.com:PixelFathom/repo-name.git)"
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
    """Get all chat messages for a specific session only"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Get messages with this exact session_id only
        result = await session.execute(
            select(Chat)
            .where(Chat.session_id == session_id)
            .order_by(Chat.created_at)
        )
        chats = list(result.scalars().all())
        
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
    """Get all chat sessions for a sub-project"""
    try:
        # Get unique session IDs for this sub-project
        result = await session.execute(
            select(Chat.session_id)
            .where(Chat.sub_project_id == sub_project_id)
            .distinct()
            .order_by(Chat.session_id)
        )
        session_ids = [row[0] for row in result.all() if row[0]]
        
        # Get first and last message for each session
        sessions = []
        for session_id in session_ids:
            result = await session.execute(
                select(Chat)
                .where(Chat.session_id == session_id)
                .order_by(Chat.created_at)
            )
            chats = result.scalars().all()
            
            if chats:
                sessions.append({
                    "session_id": session_id,
                    "message_count": len(chats),
                    "first_message": chats[0].content.get("text", "")[:100] + "..." if len(chats[0].content.get("text", "")) > 100 else chats[0].content.get("text", ""),
                    "last_message_at": chats[-1].created_at.isoformat(),
                    "created_at": chats[0].created_at.isoformat()
                })
        
        # Sort sessions by created_at in descending order (newest first)
        sessions.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {
            "sub_project_id": str(sub_project_id),
            "sessions": sessions
        }
    except Exception as e:
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
            auto_webhook_session_id  # Use webhook session ID for remote service
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

