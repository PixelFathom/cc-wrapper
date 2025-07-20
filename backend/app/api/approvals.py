from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import redis.asyncio as redis
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import json

from app.deps import get_session, get_redis_client
from app.models import Approval, SubProject
from app.schemas import ApprovalRead, ApprovalResult
from app.models.approval import ApprovalStatus
from app.services.cwd import parse_cwd

router = APIRouter()


@router.get("/approvals/pending")
async def get_pending_approvals(
    cwd: Optional[str] = Query(None),
    sub_project_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_session)
):
    """Get all pending approvals - both regular and MCP approvals"""
    from app.services.approval_service import approval_service
    from app.models.approval_request import ApprovalRequest, MCPApprovalStatus
    
    all_approvals = []
    
    # Get regular approvals
    query = select(Approval).where(Approval.status == ApprovalStatus.PENDING)
    
    # Apply filters only if provided
    if sub_project_id:
        query = query.where(Approval.sub_project_id == sub_project_id)
    elif cwd:
        final_sub_project_id = await parse_cwd(cwd, session)
        if final_sub_project_id:
            query = query.where(Approval.sub_project_id == final_sub_project_id)
    
    result = await session.execute(query)
    regular_approvals = result.scalars().all()
    
    # Convert regular approvals to common format
    for approval in regular_approvals:
        all_approvals.append({
            "id": str(approval.id),
            "type": "regular",
            "action_type": approval.action_type,
            "details": approval.details,
            "status": approval.status,
            "created_at": approval.created_at.isoformat(),
            "sub_project_id": str(approval.sub_project_id) if approval.sub_project_id else None,
            "cwd": approval.cwd
        })
    
    # Get MCP approval requests
    mcp_query = select(ApprovalRequest).where(ApprovalRequest.status == MCPApprovalStatus.pending)
    
    # Apply filters only if provided
    if sub_project_id:
        mcp_query = mcp_query.where(ApprovalRequest.sub_project_id == sub_project_id)
    
    mcp_result = await session.execute(mcp_query)
    mcp_approvals = mcp_result.scalars().all()
    
    # Convert MCP approvals to common format
    for mcp_approval in mcp_approvals:
        all_approvals.append({
            "id": str(mcp_approval.id),
            "type": "mcp",
            "request_id": mcp_approval.request_id,
            "tool_name": mcp_approval.tool_name,
            "tool_input": mcp_approval.tool_input,
            "display_text": mcp_approval.display_text,
            "status": mcp_approval.status,
            "created_at": mcp_approval.received_at.isoformat(),
            "sub_project_id": str(mcp_approval.sub_project_id) if mcp_approval.sub_project_id else None
        })
    
    return all_approvals


@router.post("/approvals/result")
async def submit_approval_result(
    result: ApprovalResult,
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Unified endpoint to handle both regular and MCP approval decisions"""
    from app.services.approval_service import approval_service
    from app.models.approval_request import ApprovalRequest
    
    # First try to find as regular approval
    approval = await session.get(Approval, result.approval_id)
    if approval:
        # Handle regular approval
        if approval.status != ApprovalStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approval already processed"
            )
        
        approval.status = ApprovalStatus.APPROVED if result.decision == "approved" else ApprovalStatus.REJECTED
        approval.response = result.comment
        approval.responded_at = datetime.utcnow()
        
        session.add(approval)
        await session.commit()
        
        # Send the decision to port 8083
        await approval_service.send_approval_to_external_service(
            approval_id=approval.id,
            decision="allow" if result.decision == "approved" else "deny",
            reason=result.comment
        )
        
        # Publish approval event
        await redis_client.publish(
            f"approval:{approval.sub_project_id}",
            json.dumps({
                "approval_id": str(approval.id),
                "status": approval.status,
                "response": approval.response
            })
        )
        
        return {"message": "Approval result submitted successfully", "type": "regular"}
    
    # Try to find as MCP approval
    mcp_approval = await session.get(ApprovalRequest, result.approval_id)
    if mcp_approval:
        # Handle MCP approval using the approval service
        approval_service.set_redis_client(redis_client)
        
        decision = "allow" if result.decision == "approved" else "deny"
        await approval_service.process_approval_decision(
            session,
            result.approval_id,
            decision,
            result.comment
        )
        
        return {"message": "MCP approval result submitted successfully", "type": "mcp"}
    
    # Not found in either table
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Approval not found"
    )