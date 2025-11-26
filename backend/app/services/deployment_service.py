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
import asyncio
import os

logger = logging.getLogger(__name__)


class DeploymentService:
    def __init__(self):
        settings = get_settings()
        self.org_name = settings.org_name  # Constant org name
        self.init_project_url = settings.init_project_url  # Remote service URL
        self.webhook_base_url = settings.webhook_base_url
    
    async def _generate_unique_port(self, db: AsyncSession, task_id: UUID) -> int:
        """Generate a unique port number (9001-65535) for a task"""
        max_attempts = 100
        for _ in range(max_attempts):
            port = random.randint(9001, 65535)
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
            
            # Trigger DNS, Nginx, and SSL steps asynchronously as soon as init_project request is sent
            if request_id:
                # Trigger hosting steps asynchronously (fire and forget)
                # Don't await to avoid blocking the response
                asyncio.create_task(self._trigger_hosting_steps(db, task_id))
            
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
        
        status_value = webhook_data.get("status") or "received"
        status_upper = status_value.upper()

        # Create hook record with phase
        hook = DeploymentHook(
            task_id=task.id,
            session_id=webhook_data.get("session_id") or webhook_data.get("task_id") or webhook_data.get("request_id") or str(task.id),
            hook_type=hook_type,
            phase=phase,  # Set phase: initialization or deployment
            status=status_value,
            data=structured_data,
            message=message,
            is_complete=webhook_data.get("complete", False) or status_upper == "COMPLETED"
        )
        db.add(hook)

        # Update task status based on webhook
        status = status_upper
        task_type = webhook_data.get("task", "")  # e.g., "INIT_PROJECT"

        if status == "COMPLETED":
            task.deployment_completed = True
            task.deployment_completed_at = datetime.utcnow()
            task.deployment_status = "completed"

            # For issue resolution tasks, handle based on phase
            if task.task_type == "issue_resolution":
                # Import here to avoid circular dependency
                from app.models.issue_resolution import IssueResolution
                from app.models.project import Project

                # Get issue resolution record
                stmt = select(IssueResolution).where(IssueResolution.task_id == task.id)
                result = await db.execute(stmt)
                resolution = result.scalar_one_or_none()

                if resolution:
                    # If initialization completed, trigger planning stage
                    if task_type == "INIT_PROJECT" and phase == "initialization":
                        # Get project
                        project = await db.get(Project, task.project_id)

                        if project:
                            # Import and trigger query
                            from app.api.issue_resolution import trigger_issue_resolution_query

                            # Trigger in background (fire and forget)
                            # Pass IDs instead of objects to avoid session conflicts
                            import asyncio
                            asyncio.create_task(trigger_issue_resolution_query(task.id, resolution.id, project.id))

                    # If deployment phase completed and current stage is "deploy", mark deploy stage complete
                    elif phase == "deployment" and resolution.current_stage == "deploy":
                        from app.services.issue_resolution_orchestrator import IssueResolutionOrchestrator

                        # Mark deploy stage complete
                        orchestrator = IssueResolutionOrchestrator(db)
                        await orchestrator.mark_deploy_complete(resolution.id)

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
        
    async def _is_production_environment(self) -> bool:
        """Check if running in production environment (docker-compose production)"""
        settings = get_settings()
        # Check environment variable or settings
        env_mode = os.getenv("ENVIRONMENT", settings.environment)
        return env_mode.lower() == "production"
    
    async def _setup_dns_step(self, db: AsyncSession, task_id: UUID, subdomain: str) -> None:
        """Setup DNS A record and create deployment hook"""
        try:
            from app.services.hostinger_service import hostinger_dns_service
            from app.core.settings import get_settings
            
            settings = get_settings()
            fqdn = f"{subdomain}.{settings.hostinger_domain}"
            
            # Create hook for DNS step initiation
            hook = DeploymentHook(
                task_id=task_id,
                session_id=str(task_id),
                hook_type="dns_setup",
                phase="deployment",
                status="processing",
                data={"step": "dns", "subdomain": subdomain, "fqdn": fqdn},
                message="Setting up DNS A record..."
            )
            db.add(hook)
            await db.commit()
            
            # Add DNS A record
            await hostinger_dns_service.add_a_record(subdomain, ip=settings.server_ip)
            
            # Update hook with success
            hook.status = "completed"
            hook.message = f"DNS A record added: {fqdn} -> {settings.server_ip}"
            hook.is_complete = True
            await db.commit()
            
            logger.info(f"DNS setup completed for task {task_id}: {fqdn}")
        except Exception as e:
            logger.error(f"Failed to setup DNS for task {task_id}: {e}")
            # Update hook with failure
            hook.status = "failed"
            hook.message = f"DNS setup failed: {str(e)}"
            await db.commit()
    
    async def _setup_nginx_step(self, db: AsyncSession, task_id: UUID, fqdn: str, upstream_port: int) -> None:
        """Setup Nginx reverse proxy and create deployment hook"""
        try:
            from app.core.settings import get_settings
            import httpx
            
            settings = get_settings()
            host_clean = fqdn.replace("https://", "").replace("http://", "").strip()
            
            # Create hook for Nginx step initiation
            hook = DeploymentHook(
                task_id=task_id,
                session_id=str(task_id),
                hook_type="nginx_setup",
                phase="deployment",
                status="processing",
                data={"step": "nginx", "fqdn": fqdn, "upstream_port": upstream_port},
                message="Configuring Nginx reverse proxy..."
            )
            db.add(hook)
            await db.commit()
            
            # Configure Nginx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.nginx_api_url}/create-config",
                    json={"port": upstream_port, "host_name": host_clean},
                    timeout=60.0
                )
                response.raise_for_status()
            
            # Update hook with success
            hook.status = "completed"
            hook.message = f"Nginx configured for {fqdn} -> localhost:{upstream_port}"
            hook.is_complete = True
            await db.commit()
            
            logger.info(f"Nginx setup completed for task {task_id}: {fqdn}")
        except Exception as e:
            logger.error(f"Failed to setup Nginx for task {task_id}: {e}")
            # Update hook with failure
            hook.status = "failed"
            hook.message = f"Nginx setup failed: {str(e)}"
            await db.commit()
    
    async def _setup_ssl_step(self, db: AsyncSession, task_id: UUID, fqdn: str) -> None:
        """Setup SSL certificate and create deployment hook"""
        try:
            from app.core.settings import get_settings
            import httpx
            
            settings = get_settings()
            host_clean = fqdn.replace("https://", "").replace("http://", "").strip()
            
            # Create hook for SSL step initiation
            hook = DeploymentHook(
                task_id=task_id,
                session_id=str(task_id),
                hook_type="ssl_setup",
                phase="deployment",
                status="processing",
                data={"step": "ssl", "fqdn": fqdn},
                message="Setting up SSL certificate..."
            )
            db.add(hook)
            await db.commit()
            
            # Setup SSL
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.nginx_api_url}/add-ssl",
                    json={"host_name": host_clean, "email": "admin@example.com"},
                    timeout=120.0
                )
                response.raise_for_status()
            
            # Update hook with success
            hook.status = "completed"
            hook.message = f"SSL certificate obtained for {fqdn}"
            hook.is_complete = True
            await db.commit()
            
            logger.info(f"SSL setup completed for task {task_id}: {fqdn}")
        except Exception as e:
            logger.error(f"Failed to setup SSL for task {task_id}: {e}")
            # Update hook with failure
            hook.status = "failed"
            hook.message = f"SSL setup failed: {str(e)}"
            await db.commit()
    
    async def _trigger_hosting_steps(self, db: AsyncSession, task_id: UUID) -> None:
        """Trigger DNS, Nginx, and SSL setup steps asynchronously after init_project succeeds"""
        # Check if we're in production environment
        is_production = await self._is_production_environment()
        if not is_production:
            logger.info(f"Skipping hosting steps for task {task_id} (not in production environment)")
            return
        
        try:
            # Create a new database session for async operations
            from app.deps import async_session_maker
            from app.core.settings import get_settings
            
            settings = get_settings()
            
            async with async_session_maker() as async_db:
                # Get task to retrieve deployment port and generate subdomain
                task = await async_db.get(Task, task_id)
                if not task:
                    logger.error(f"Task {task_id} not found for hosting setup")
                    return
                
                if not task.deployment_port:
                    logger.error(f"Task {task_id} does not have a deployment port assigned")
                    return
                
                from app.services.hostinger_service import hostinger_dns_service
                
                # Generate unique subdomain
                prefix = task.name[:10].lower().replace(" ", "-").replace("_", "-") if task.name else "site"
                prefix = ''.join(c for c in prefix if c.isalnum() or c == '-')
                subdomain = await hostinger_dns_service.get_unique_subdomain(prefix=prefix)
                fqdn = f"{subdomain}.{settings.hostinger_domain}"
                
                # Update task with hosting info
                task.hosting_subdomain = subdomain
                task.hosting_fqdn = fqdn
                await async_db.commit()
                
                # Trigger steps sequentially (in order) - each will create its own session
                # Step 1: Setup DNS
                await self._setup_dns_step_async(task_id, subdomain)
                # Wait a bit for DNS to propagate before nginx/ssl
                await asyncio.sleep(2)
                
                # Step 2: Setup Nginx (after DNS completes)
                await self._setup_nginx_step_async(task_id, fqdn, task.deployment_port)
                
                # Step 3: Setup SSL (after Nginx completes)
                await self._setup_ssl_step_async(task_id, fqdn)
                
                logger.info(f"Completed hosting steps for task {task_id}: DNS, Nginx, SSL")
        except Exception as e:
            logger.error(f"Failed to trigger hosting steps for task {task_id}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _setup_dns_step_async(self, task_id: UUID, subdomain: str) -> None:
        """Setup DNS A record with its own database session"""
        from app.deps import async_session_maker
        async with async_session_maker() as db:
            await self._setup_dns_step(db, task_id, subdomain)
    
    async def _setup_nginx_step_async(self, task_id: UUID, fqdn: str, upstream_port: int) -> None:
        """Setup Nginx with its own database session"""
        from app.deps import async_session_maker
        async with async_session_maker() as db:
            await self._setup_nginx_step(db, task_id, fqdn, upstream_port)
    
    async def _setup_ssl_step_async(self, task_id: UUID, fqdn: str) -> None:
        """Setup SSL with its own database session"""
        from app.deps import async_session_maker
        async with async_session_maker() as db:
            await self._setup_ssl_step(db, task_id, fqdn)
        
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
