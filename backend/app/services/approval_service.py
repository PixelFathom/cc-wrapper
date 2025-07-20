from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from sqlmodel import col
import aiohttp
import asyncio
import logging

from app.models.approval_request import ApprovalRequest, MCPApprovalStatus
from app.models.sub_project import SubProject
from app.models.task import Task
from app.models.project import Project
import json

logger = logging.getLogger(__name__)


class ApprovalService:
    """Service for handling approval requests from MCP servers"""
    
    def __init__(self):
        self.redis_client = None
    
    def set_redis_client(self, redis_client):
        """Set Redis client for real-time updates"""
        self.redis_client = redis_client
    
    async def create_approval_request(
        self,
        db: AsyncSession,
        request_data: Dict[str, Any],
        sub_project_id: UUID
    ) -> ApprovalRequest:
        """Create a new approval request"""
        try:
            approval = ApprovalRequest(
                request_id=request_data["request_id"],
                tool_name=request_data["tool_name"],
                tool_input=request_data["tool_input"],
                display_text=request_data.get("display_text", f"Use tool: {request_data['tool_name']}"),
                callback_url=request_data["callback_url"],
                sub_project_id=sub_project_id,
                session_id=request_data.get("session_id")
            )
            
            db.add(approval)
            await db.commit()
            await db.refresh(approval)
            
            logger.info(f"Created approval request {approval.request_id} for tool {approval.tool_name}")
            
            # Publish to Redis for real-time updates
            if self.redis_client:
                await self._publish_approval_update(approval, "created")
            
            return approval
            
        except Exception as e:
            logger.error(f"Error creating approval request: {e}")
            await db.rollback()
            raise
    
    async def get_pending_approvals(
        self,
        db: AsyncSession,
        sub_project_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get pending approval requests"""
        try:
            query = select(
                ApprovalRequest,
                SubProject,
                Task,
                Project
            ).join(
                SubProject, ApprovalRequest.sub_project_id == SubProject.id
            ).join(
                Task, SubProject.task_id == Task.id
            ).join(
                Project, Task.project_id == Project.id
            ).where(
                ApprovalRequest.status == MCPApprovalStatus.pending
            )
            
            if sub_project_id:
                query = query.where(ApprovalRequest.sub_project_id == sub_project_id)
            
            query = query.order_by(desc(ApprovalRequest.received_at)).limit(limit)
            
            result = await db.execute(query)
            rows = result.all()
            
            approvals = []
            for approval, sub_project, task, project in rows:
                approvals.append({
                    "id": str(approval.id),
                    "request_id": approval.request_id,
                    "tool_name": approval.tool_name,
                    "tool_input": approval.tool_input,
                    "display_text": approval.display_text,
                    "status": approval.status,
                    "received_at": approval.received_at.isoformat(),
                    "sub_project": {
                        "id": str(sub_project.id),
                        "name": sub_project.name
                    },
                    "task": {
                        "id": str(task.id),
                        "name": task.name
                    },
                    "project": {
                        "id": str(project.id),
                        "name": project.name
                    }
                })
            
            return approvals
            
        except Exception as e:
            logger.error(f"Error getting pending approvals: {e}")
            raise
    
    async def process_approval_decision(
        self,
        db: AsyncSession,
        approval_id: UUID,
        decision: str,
        reason: Optional[str] = None
    ) -> ApprovalRequest:
        """Process an approval decision"""
        try:
            # Get the approval request
            approval = await db.get(ApprovalRequest, approval_id)
            if not approval:
                raise ValueError(f"Approval request {approval_id} not found")
            
            if approval.status != MCPApprovalStatus.pending:
                raise ValueError(f"Approval request {approval_id} is not pending")
            
            # Update status
            approval.status = MCPApprovalStatus.approved if decision == "allow" else MCPApprovalStatus.denied
            approval.decision_reason = reason
            approval.decided_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(approval)
            
            # Send callback to MCP server
            await self._send_callback(approval, decision, reason)
            
            # Publish to Redis for real-time updates
            if self.redis_client:
                await self._publish_approval_update(approval, "decided")
            
            logger.info(f"Processed approval decision for {approval.request_id}: {decision}")
            
            return approval
            
        except Exception as e:
            logger.error(f"Error processing approval decision: {e}")
            await db.rollback()
            raise
    
    async def _send_callback(
        self,
        approval: ApprovalRequest,
        decision: str,
        reason: Optional[str] = None
    ):
        """Send approval decision callback to MCP server"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "request_id": approval.request_id,
                    "decision": decision,
                    "reason": reason or "",
                    "timestamp": datetime.utcnow().isoformat()
                }
                logger.info(f"payload {payload}")
                logger.info(f"approval.callback_url {approval.callback_url}")
                # Send to original callback URL
                async with session.post(
                    approval.callback_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    logger.info(f"resp {resp}")
                    if resp.status >= 400:
                        logger.error(f"Callback failed with status {resp.status}")
                    else:
                        logger.info(f"Callback sent successfully to {approval.callback_url}")
                
                # Also send to port 8083 with the required format
                await self.send_approval_to_external_service(
                    approval_id=approval.id,
                    decision=decision,  # "allow" or "deny"
                    reason=reason,
                    request_id=approval.request_id,  # Include the original request_id
                    approval=approval
                )
                        
        except Exception as e:
            logger.error(f"Error sending callback: {e}")
            # Don't raise - we've already updated the database
    
    @staticmethod
    async def send_approval_to_external_service(
        approval_id: UUID,
        decision: str,
        reason: Optional[str] = None,
        request_id: Optional[str] = None,
        approval: Optional[ApprovalRequest] = None
    ):
        """Send approval decision to external service on port 8083"""
        try:
            decision_payload = {
                "decision": decision,
                "reason": reason or "Decision made through approval system"
            }
            
            # Add request_id if provided (for MCP approvals)
            if request_id:
                decision_payload["request_id"] = request_id
            if approval:
                callback_url = approval.callback_url
            else:
                callback_url = "http://host.docker.internal:8083/approval-callback"
            logger.info(f"callback_url {callback_url}")
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    callback_url,
                    json=decision_payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        logger.info(f"✅ Approval decision sent to port 8083 | approval_id={approval_id} | decision={decision}")
                    else:
                        logger.error(f"❌ Failed to send approval decision to port 8083 | status={resp.status}")
                        
        except Exception as e:
            logger.error(f"❌ Error sending approval decision to port 8083: {str(e)}")
            # Don't fail the callback if 8083 is down
    
    async def _publish_approval_update(
        self,
        approval: ApprovalRequest,
        action: str
    ):
        """Publish approval update to Redis"""
        try:
            channel = f"approvals:{approval.sub_project_id}"
            message = {
                "type": "approval_update",
                "action": action,
                "approval": {
                    "id": str(approval.id),
                    "request_id": approval.request_id,
                    "tool_name": approval.tool_name,
                    "display_text": approval.display_text,
                    "status": approval.status,
                    "received_at": approval.received_at.isoformat()
                }
            }
            
            await self.redis_client.publish(channel, json.dumps(message))
            
        except Exception as e:
            logger.error(f"Error publishing approval update: {e}")
    
    async def check_timeout_approvals(self, db: AsyncSession, timeout_minutes: int = 5):
        """Check for timed out approval requests"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
            
            query = select(ApprovalRequest).where(
                and_(
                    ApprovalRequest.status == MCPApprovalStatus.pending,
                    ApprovalRequest.received_at < cutoff_time
                )
            )
            
            result = await db.execute(query)
            approvals = result.scalars().all()
            
            for approval in approvals:
                approval.status = MCPApprovalStatus.timeout
                approval.decided_at = datetime.utcnow()
                approval.decision_reason = f"Timed out after {timeout_minutes} minutes"
                
                # Send denial callback
                await self._send_callback(approval, "deny", approval.decision_reason)
                
                if self.redis_client:
                    await self._publish_approval_update(approval, "timeout")
            
            if approvals:
                await db.commit()
                logger.info(f"Marked {len(approvals)} approvals as timed out")
                
        except Exception as e:
            logger.error(f"Error checking timeout approvals: {e}")
            await db.rollback()


# Create service instance
approval_service = ApprovalService()