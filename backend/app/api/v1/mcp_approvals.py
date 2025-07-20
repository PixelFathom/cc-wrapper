from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.deps import get_session, get_redis_client
from app.services.approval_service import approval_service
import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class ApprovalRequestPayload(BaseModel):
    request_id: str
    timestamp: str
    tool_name: str
    tool_input: Dict[str, Any]
    callback_url: str
    display_text: str


class ApprovalDecision(BaseModel):
    decision: str  # "allow" or "deny"
    reason: Optional[str] = None


@router.post("/approval-request")
async def receive_approval_request(
    payload: ApprovalRequestPayload,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    logger.info(f"Received approval request: {payload}")
    """Receive approval request from MCP server"""
    try:
        # Get the most recent sub_project from recent chats
        from sqlmodel import select, desc
        from app.models import Chat
        
        stmt = select(Chat).order_by(desc(Chat.created_at)).limit(1)
        result = await session.execute(stmt)
        recent_chat = result.scalar_one_or_none()
        
        if recent_chat and recent_chat.sub_project_id:
            sub_project_id = recent_chat.sub_project_id
            logger.info(f"Using most recent sub_project {sub_project_id} for approval")
        else:
            logger.error("No active sub_project found for approval request")
            return {"status": "error", "message": "No active sub_project found"}
        
        # Set Redis client for real-time updates
        approval_service.set_redis_client(redis_client)
        
        # Create approval request
        request_data = payload.model_dump()
        approval = await approval_service.create_approval_request(
            session, 
            request_data,
            sub_project_id
        )
        
        logger.info(f"Created approval request {approval.request_id} for sub_project {sub_project_id}")
        
        return {
            "status": "received",
            "request_id": payload.request_id,
            "approval_id": str(approval.id)
        }
    
    except Exception as e:
        logger.error(f"Error processing approval request: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/approvals/pending")
async def get_pending_approvals(
    sub_project_id: Optional[UUID] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session)
):
    """Get pending approval requests"""
    try:
        approvals = await approval_service.get_pending_approvals(
            session,
            sub_project_id,
            limit
        )
        return {"approvals": approvals}
    
    except Exception as e:
        logger.error(f"Error getting pending approvals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: UUID,
    decision: ApprovalDecision,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Make a decision on an approval request"""
    try:
        # Set Redis client for real-time updates
        approval_service.set_redis_client(redis_client)
        
        approval = await approval_service.process_approval_decision(
            session,
            approval_id,
            decision.decision,
            decision.reason
        )
        
        return {
            "status": "decided",
            "approval_id": str(approval.id),
            "decision": decision.decision
        }
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing approval decision: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/approvals/history")
async def get_approval_history(
    sub_project_id: Optional[UUID] = None,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    """Get approval request history"""
    # TODO: Implement history endpoint
    return {"history": []}