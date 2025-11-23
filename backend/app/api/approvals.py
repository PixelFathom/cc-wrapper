from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import redis.asyncio as redis
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import json

from app.deps import get_session, get_redis_client, get_current_user
from app.models import Approval, SubProject, User
from app.schemas import ApprovalRead, ApprovalResult
from app.models.approval import ApprovalStatus
from app.services.cwd import parse_cwd

router = APIRouter()


@router.get("/approvals/pending")
async def get_pending_approvals(
    cwd: Optional[str] = Query(None),
    sub_project_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get all pending approvals - both regular and MCP approvals (filtered by user)"""
    from app.services.approval_service import approval_service
    from app.models.approval_request import ApprovalRequest, MCPApprovalStatus
    from app.models import Task, Project

    all_approvals = []

    # Get user's projects to filter approvals
    user_projects_query = select(Project.id).where(Project.user_id == current_user.id)
    user_projects_result = await session.execute(user_projects_query)
    user_project_ids = [row[0] for row in user_projects_result.all()]

    if not user_project_ids:
        return []  # User has no projects, so no approvals

    # Get tasks belonging to user's projects
    user_tasks_query = select(Task.id).where(Task.project_id.in_(user_project_ids))
    user_tasks_result = await session.execute(user_tasks_query)
    user_task_ids = [row[0] for row in user_tasks_result.all()]

    if not user_task_ids:
        return []  # User has no tasks, so no approvals

    # Get sub_projects belonging to user's tasks
    user_sub_projects_query = select(SubProject.id).where(SubProject.task_id.in_(user_task_ids))
    user_sub_projects_result = await session.execute(user_sub_projects_query)
    user_sub_project_ids = [row[0] for row in user_sub_projects_result.all()]

    if not user_sub_project_ids:
        return []  # User has no sub-projects, so no approvals

    # Get regular approvals (filtered by user's sub-projects)
    query = select(Approval).where(
        Approval.status == ApprovalStatus.PENDING,
        Approval.sub_project_id.in_(user_sub_project_ids)
    )

    # Apply additional filters if provided
    if sub_project_id:
        # Verify user owns this sub_project
        if sub_project_id not in user_sub_project_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this sub-project"
            )
        query = query.where(Approval.sub_project_id == sub_project_id)
    elif cwd:
        final_sub_project_id = await parse_cwd(cwd, session)
        if final_sub_project_id:
            # Verify user owns this sub_project
            if final_sub_project_id not in user_sub_project_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to access this sub-project"
                )
            query = query.where(Approval.sub_project_id == final_sub_project_id)

    result = await session.execute(query)
    regular_approvals = result.scalars().all()

    # Convert regular approvals to common format
    for approval in regular_approvals:
        all_approvals.append({
            "id": str(approval.id),
            "type": "regular",
            "prompt": approval.prompt,
            "status": approval.status,
            "response": approval.response,
            "responded_at": approval.responded_at.isoformat() if approval.responded_at else None,
            "created_at": approval.created_at.isoformat(),
            "sub_project_id": str(approval.sub_project_id) if approval.sub_project_id else None
        })
    
    # Get MCP approval requests (filtered by user's sub-projects)
    mcp_query = select(ApprovalRequest).where(
        ApprovalRequest.status == MCPApprovalStatus.pending,
        ApprovalRequest.sub_project_id.in_(user_sub_project_ids)
    )

    # Apply additional filters if provided
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Unified endpoint to handle both regular and MCP approval decisions"""
    from app.services.approval_service import approval_service
    from app.models.approval_request import ApprovalRequest
    
    # First try to find as regular approval
    approval = await session.get(Approval, result.approval_id)
    if approval:
        # Authorization: verify user owns the approval through sub_project -> task -> project
        from app.models import Task
        sub_project = await session.get(SubProject, approval.sub_project_id)
        if sub_project:
            task = await session.get(Task, sub_project.task_id)
            if task:
                from app.models import Project
                project = await session.get(Project, task.project_id)
                if not project or project.user_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You don't have permission to respond to this approval"
                    )

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
        # Authorization: verify user owns the MCP approval through sub_project -> task -> project
        from app.models import Task
        sub_project = await session.get(SubProject, mcp_approval.sub_project_id)
        if sub_project:
            task = await session.get(Task, sub_project.task_id)
            if task:
                from app.models import Project
                project = await session.get(Project, task.project_id)
                if not project or project.user_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You don't have permission to respond to this approval"
                    )

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