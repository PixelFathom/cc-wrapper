import httpx
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from app.models import Task, DeploymentHook, Project
from app.core.settings import get_settings
from app.core.redis import get_redis
from app.core.rate_limiter import assert_within_rate_limit, RateLimitExceeded
from datetime import datetime
import logging
import random

logger = logging.getLogger(__name__)


class DeploymentService:
    def __init__(self):
        settings = get_settings()
        self.org_name = settings.org_name  # Constant org name
        self.init_project_url = settings.init_project_url  # Remote service URL
        self.webhook_base_url = settings.webhook_base_url
    
    async def _generate_unique_port(self, db: AsyncSession, task_id: UUID) -> int:
        """Generate a unique 5-digit port number (10000-99999) for a task"""
        max_attempts = 100
        for _ in range(max_attempts):
            port = random.randint(10000, 99999)
            # Check if port is already assigned to another task
            stmt = select(Task).where(
                Task.deployment_port == port,
                Task.id != task_id
            )
            result = await db.execute(stmt)
            existing_task = result.scalar_one_or_none()
            if not existing_task:
                return port
        raise ValueError("Failed to generate unique port number after multiple attempts")
        
    async def initialize_project(self, db: AsyncSession, task_id: UUID, github_token: Optional[str] = None) -> Optional[str]:
        """Initialize a project deployment for a task"""
        # Get task with project and user
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError("Task not found")

        await db.refresh(task, ["project"])
        await db.refresh(task.project, ["user"])

        if not task.project or not task.project.user_id:
            raise ValueError("Task project or project user not found")

        # Generate and assign unique port number if not already assigned
        if not task.deployment_port:
            task.deployment_port = await self._generate_unique_port(db, task_id)
            logger.info(f"Assigned port {task.deployment_port} to task {task_id}")

        redis_client = await get_redis()
        await assert_within_rate_limit(
            redis_client,
            user_id=task.project.user_id,
        )

        # Get GitHub token if not provided
        if not github_token and task.project.user_id:
            from app.services.github_auth_service import GitHubAuthService
            auth_service = GitHubAuthService(db)
            github_token = await auth_service.get_user_token(task.project.user_id)

        # Build GitHub URL with auth token embedded
        github_repo_url = task.project.repo_url
        if github_token and task.project.repo_url:
            # Convert https://github.com/owner/repo.git to https://TOKEN@github.com/owner/repo.git
            if github_repo_url.startswith("https://github.com/"):
                github_repo_url = github_repo_url.replace("https://github.com/", f"https://{github_token}@github.com/")
            if github_repo_url.startswith("git@github.com:"):
                github_repo_url = github_repo_url.replace("git@github.com:", f"https://{github_token}@github.com/")

        # Build CWD path as project_name/task.id
        cwd = f"{task.project.name}/{task.id}"
        # Webhook URL for initialization phase
        webhook_url = f"{self.webhook_base_url}/api/webhooks/deployment/{task.id}/initialization"

        # Prepare init project request
        payload = {
            "organization_name": self.org_name,
            "project_name": cwd,
            "github_repo_url": github_repo_url,
            "webhook_url": webhook_url,
            "generate_claude_md": False,
            "branch": f"task/{task.name}",
        }
        
        # Add MCP servers if configured
        if task.mcp_servers:
            payload["mcp_servers"] = task.mcp_servers
        
        try:
            # Update task status
            task.deployment_status = "initializing"
            task.deployment_started_at = datetime.utcnow()
            
            logger.info(f"Calling init project URL: {self.init_project_url}")
            logger.info(f"Payload: {payload}")
            
            # Call remote service
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.init_project_url,
                    json=payload,
                    timeout=30.0
                )
                logger.info(f"Response status: {response.status_code}")
                logger.info(f"Response text: {response.text}")
                
                response.raise_for_status()
                
                data = response.json()
                request_id = data.get("task_id")  # Changed from "request_id" to "task_id"
                
                logger.info(f"Got task_id from response: {request_id}")
                
                if request_id:
                    task.deployment_request_id = request_id
                    
                    # Create initial hook record
                    hook = DeploymentHook(
                        task_id=task.id,
                        session_id=request_id,
                        hook_type="init_project",
                        phase="initialization",
                        status="initiated",
                        data=payload,
                        message="Project initialization started"
                    )
                    db.add(hook)
                    logger.info(f"Created hook record for task {task.id}")
                    
            await db.commit()
            return request_id
            
        except RateLimitExceeded:
            raise
        except httpx.HTTPError as e:
            logger.error(f"Failed to initialize project: {e}")
            task.deployment_status = "failed"
            await db.commit()
            raise
            
    async def process_webhook(self, db: AsyncSession, task_id: UUID, webhook_data: Dict[str, Any], phase: str = "deployment") -> None:
        """Process incoming webhook for deployment status"""
        task = await db.get(Task, task_id)
        if not task:
            raise ValueError("Task not found")
            
        # Determine the webhook type and create appropriate message
        hook_type = webhook_data.get("type", "status")
        message = ""
        
        # Handle different webhook types
        if hook_type == "query" and webhook_data.get("message_type"):
            message_type = webhook_data.get("message_type")
            content = webhook_data.get("result", "")
            
            if message_type == "AssistantMessage":
                if webhook_data.get("content_type") == "tool_use":
                    tool_name = webhook_data.get("tool_name", "Unknown")
                    message = f"🔧 Using tool: {tool_name}"
                else:
                    message = f"💭 {content[:200]}..." if len(content) > 200 else f"💭 {content}"
            elif message_type == "UserMessage":
                if webhook_data.get("content_type") == "tool_result":
                    message = "✅ Tool execution completed"
                else:
                    message = f"📝 {content[:100]}..." if len(content) > 100 else f"📝 {content}"
            elif message_type == "SystemMessage":
                message = f"⚙️ System: {webhook_data.get('subtype', 'message')}"
            elif message_type == "ResultMessage":
                message = f"📊 Result: {webhook_data.get('subtype', 'completed')}"
        else:
            # Standard deployment status messages
            message = webhook_data.get("completion_message", "")
            if not message and webhook_data.get("step_name"):
                message = f"Executing {webhook_data.get('step_name')}"
        
        # Extract and structure webhook data
        structured_data = {
            "step_name": webhook_data.get("step_name", webhook_data.get("type", "deployment")),
            "tool_name": webhook_data.get("tool_name"),
            "tool_input": webhook_data.get("tool_input"),
            "message_type": webhook_data.get("message_type"),
            "content_type": webhook_data.get("content_type"),
            "result": webhook_data.get("result"),
            "error": webhook_data.get("error"),
            "metadata": webhook_data.get("metadata", webhook_data.get("data", {})),
            "timestamp": webhook_data.get("timestamp"),
            "usage": webhook_data.get("usage"),
            "duration_ms": webhook_data.get("duration_ms"),
            "total_cost_usd": webhook_data.get("total_cost_usd")
        }
        
        # Create hook record with phase
        hook = DeploymentHook(
            task_id=task.id,
            session_id=webhook_data.get("session_id") or webhook_data.get("task_id") or webhook_data.get("request_id") or str(task.id),
            hook_type=hook_type,
            phase=phase,  # Set phase: initialization or deployment
            status=webhook_data.get("status", "received"),
            data=structured_data,
            message=message,
            is_complete=webhook_data.get("complete", False) or webhook_data.get("status") == "COMPLETED"
        )
        db.add(hook)
        
        # Update task status based on webhook
        status = webhook_data.get("status", "").upper()
        task_type = webhook_data.get("task", "")  # e.g., "INIT_PROJECT"

        if status == "COMPLETED":
            task.deployment_completed = True
            task.deployment_completed_at = datetime.utcnow()
            task.deployment_status = "completed"

            # For issue resolution tasks, trigger query after init completes
            if task_type == "INIT_PROJECT" and task.task_type == "issue_resolution":
                # Import here to avoid circular dependency
                from app.models.issue_resolution import IssueResolution
                from app.models.project import Project

                # Get issue resolution record
                stmt = select(IssueResolution).where(IssueResolution.task_id == task.id)
                result = await db.execute(stmt)
                resolution = result.scalar_one_or_none()
                
                if resolution:
                    # Get project
                    project = await db.get(Project, task.project_id)

                    if project:
                        # Import and trigger query
                        from app.api.issue_resolution import trigger_issue_resolution_query

                        # Trigger in background (fire and forget)
                        # Pass IDs instead of objects to avoid session conflicts
                        import asyncio
                        asyncio.create_task(trigger_issue_resolution_query(task.id, resolution.id, project.id))

        elif status == "failed":
            task.deployment_status = "failed"
            # Reset deployment_completed flags to allow retry
            task.deployment_completed = False
            task.deployment_completed_at = None
        elif status == "DEPLOYING":
            task.deployment_status = "deploying"
        elif status == "PROCESSING":
            task.deployment_status = "deploying"

        await db.commit()
        
    async def get_deployment_hooks(self, db: AsyncSession, task_id: UUID, limit: int = 20) -> list[DeploymentHook]:
        """Get deployment hooks for a task"""
        from sqlalchemy import select
        
        # Get task to check if deployment is completed
        task = await db.get(Task, task_id)
        
        stmt = (
            select(DeploymentHook)
            .where(DeploymentHook.task_id == task_id)
            .order_by(DeploymentHook.received_at.asc())  # Chronological order
        )
        
        # If deployment is completed, get all hooks; otherwise limit
        if task and task.deployment_completed:
            result = await db.execute(stmt)
        else:
            result = await db.execute(stmt.limit(limit))
            
        return result.scalars().all()


deployment_service = DeploymentService()