from sqlmodel.ext.asyncio.session import AsyncSession
import redis.asyncio as redis
import json
import httpx
from uuid import UUID
from datetime import datetime
import asyncio
from typing import Optional

from app.models import Chat, Approval
from app.models.chat import ChatRole
from app.models.approval import ApprovalStatus


class ChatService:
    def __init__(self, session: AsyncSession, redis_client: redis.Redis):
        self.session = session
        self.redis_client = redis_client
    
    async def process_query(
        self,
        sub_project_id: UUID,
        session_id: str,
        prompt: str,
        webhook_url: Optional[str] = None
    ):
        # Store user message
        user_chat = Chat(
            sub_project_id=sub_project_id,
            session_id=session_id,
            role=ChatRole.USER,
            content={"text": prompt}
        )
        self.session.add(user_chat)
        await self.session.commit()
        
        # Store session context in Redis
        await self.redis_client.setex(
            f"session:{session_id}",
            3600,  # 1 hour TTL
            json.dumps({
                "sub_project_id": str(sub_project_id),
                "prompt": prompt,
                "webhook_url": webhook_url
            })
        )
        
        # Simulate LLM processing (stub)
        await self._simulate_llm_processing(sub_project_id, session_id, prompt, webhook_url)
    
    async def _simulate_llm_processing(
        self,
        sub_project_id: UUID,
        session_id: str,
        prompt: str,
        webhook_url: Optional[str] = None
    ):
        # Simulate some processing delay
        await asyncio.sleep(1)
        
        # Publish hook events
        hooks = [
            {"type": "thinking", "content": "Analyzing your request..."},
            {"type": "execution", "content": "Running analysis..."},
            {"type": "result", "content": f"Processed: {prompt}"}
        ]
        
        for hook in hooks:
            await self._publish_hook(session_id, hook, webhook_url)
            await asyncio.sleep(0.5)
        
        # Store assistant response
        assistant_chat = Chat(
            sub_project_id=sub_project_id,
            session_id=session_id,
            role=ChatRole.ASSISTANT,
            content={
                "text": f"I've processed your request: {prompt}",
                "hooks": hooks
            }
        )
        self.session.add(assistant_chat)
        
        # Simulate approval request (if certain conditions met)
        if "approve" in prompt.lower():
            approval = Approval(
                sub_project_id=sub_project_id,
                prompt="Do you want to proceed with this action?",
                status=ApprovalStatus.PENDING
            )
            self.session.add(approval)
            await self.session.commit()
            
            # Notify about pending approval
            await self._publish_hook(
                session_id,
                {"type": "approval_required", "approval_id": str(approval.id)},
                webhook_url
            )
        else:
            await self.session.commit()
    
    async def _publish_hook(
        self,
        session_id: str,
        hook_data: dict,
        webhook_url: Optional[str] = None
    ):
        message = json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            **hook_data
        })
        
        # Publish to Redis for SSE
        await self.redis_client.publish(f"chat:{session_id}", message)
        
        # Send to webhook if provided
        if webhook_url:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(webhook_url, json=hook_data, timeout=5.0)
            except Exception as e:
                print(f"Webhook error: {e}")