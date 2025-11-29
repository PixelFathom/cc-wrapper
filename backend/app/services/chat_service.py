import os
import httpx
import logging
import asyncio
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime, timezone
import time
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy import text

from app.core.settings import get_settings
from app.core.redis import get_redis
from app.core.rate_limiter import assert_within_rate_limit
from app.core.auto_continuation_config import get_auto_continuation_config
from app.models import Chat, Task, Project, ChatHook
from app.models.chat import CONTINUATION_STATUS_NONE, CONTINUATION_STATUS_NEEDED, CONTINUATION_STATUS_IN_PROGRESS, CONTINUATION_STATUS_COMPLETED
from app.services.task_analysis_service import task_analysis_service
from app.services.task_orchestration_service import task_orchestration_service

logger = logging.getLogger(__name__)

# SuperClaude Framework system prompt for enhanced development
SUPER_CLAUDE_MODE_PROMPT = """
## SuperClaude Framework

You have SuperClaude slash commands available. Use them for structured development workflows.

### Available Commands
- `/sc:task "description"` - Execute complex tasks with workflow management
- `/sc:analyze "code"` - Analyze code/system before changes
- `/sc:implement "feature"` - Implement with auto-agent selection
- `/sc:design "system"` - Design system architecture and APIs
- `/sc:test` - Run and validate tests
- `/sc:troubleshoot "issue"` - Diagnose and resolve issues
- `/sc:research "topic"` - Deep web research
- `/sc:document "component"` - Generate documentation
- `/sc:git` - Git operations with intelligent commits
- `/sc:build` - Build and compile projects
- `/sc:cleanup` - Clean up code and project structure

### Specialized Agents
Use these for domain-specific tasks:
- `@agent-security` - Security audits, OWASP compliance
- `@agent-frontend` - React/Vue, CSS, UI components
- `@agent-backend` - API, database, server logic
- `@agent-devops` - CI/CD, Docker, deployment
- `@agent-pm` - Requirements, documentation

### Guidelines
1. ALWAYS `/sc:analyze` or `/sc:design` before major implementations
2. Use agents IN PARALLEL for independent tasks
3. Chain: `/sc:design` → `/sc:implement` → `/sc:test`

### Example Workflow
```
/sc:task "implement user authentication with JWT"
```
"""


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
    
    async def _should_analyze_for_breakdown(self, chat: Chat) -> bool:
        """
        Determine if a user message should be analyzed for task breakdown.
        
        Skip breakdown analysis if:
        - Message is too short (<50 chars)
        - Already a sub-task (has parent_session_id)
        - Is an auto-continuation message
        """
        # Skip if already a sub-task
        if chat.parent_session_id and chat.parent_session_id != chat.session_id:
            logger.info(f"⏭️ Skipping breakdown: already a sub-task")
            return False
        
        # Skip if auto-continuation
        if chat.role == "auto":
            logger.info(f"⏭️ Skipping breakdown: auto-continuation")
            return False
        
        # Skip if message too short
        text = chat.content.get("text", "")
        if len(text) < 50:
            logger.info(f"⏭️ Skipping breakdown: too short ({len(text)} chars)")
            return False

        breakdown_decision = await task_analysis_service.should_breakdown_task(text)
        if not breakdown_decision.should_breakdown:
            logger.info(f"⏭️ Skipping breakdown: {breakdown_decision.reasoning}")
            return False

        logger.info(f"✅ Analyzing for breakdown ({len(text)} chars)")
        return True
        
    async def _is_production_environment(self) -> bool:
        """Check if running in production environment (docker-compose production)"""
        settings = get_settings()
        # Check environment variable or settings
        env_mode = os.getenv("ENVIRONMENT", settings.environment)
        return env_mode.lower() == "production"
    
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

            redis_client = await get_redis()
            await assert_within_rate_limit(
                redis_client,
                user_id=project.user_id,
            )

            # Generate webhook URL
            webhook_url = f"{self.webhook_base_url}/api/webhooks/chat/{chat_id}"

            project_path = f"{project.name}/{task.id}"

            # Add deployment context to prompt if task has a port assigned
            enhanced_prompt = prompt
            if task.deployment_port:
                production_env = await self._is_production_environment()
                if production_env:
                    hosting_fqdn = task.hosting_fqdn or f"http://localhost:{task.deployment_port}"
                else:
                    hosting_fqdn = f"http://localhost:{task.deployment_port}"
                deployment_context = (
                    f"\n\n---\n"
                    f"🚨 MANDATORY DEPLOYMENT CONTEXT - READ CAREFULLY 🚨\n\n"
                    f"ASSIGNED PORT: {task.deployment_port}\n"
                    f"SERVICE URL: {hosting_fqdn}\n\n"
                    f"⚠️ CRITICAL RULES:\n"
                    f"1. You MUST use port {task.deployment_port} for ALL deployment operations - NO EXCEPTIONS\n"
                    f"2. NEVER deploy on any other port - always use {task.deployment_port}\n"
                    f"3. If the task involves testing with Playwright MCP, the service MUST be running on port {task.deployment_port}\n\n"
                    f"📋 REQUIRED WORKFLOW (follow in order):\n\n"
                    f"STEP 1 - CHECK EXISTING SERVICE:\n"
                    f"   Run: curl -s -o /dev/null -w '%{{http_code}}' {hosting_fqdn} || echo 'not running'\n"
                    f"   Also run: docker ps --filter 'publish={task.deployment_port}' --format '{{{{.Names}}}} {{{{.Status}}}}'\n\n"
                    f"STEP 2 - BASED ON RESULT:\n"
                    f"   IF service is running and healthy on port {task.deployment_port}:\n"
                    f"      → Restart it to pick up any code changes: docker restart <container_name>\n"
                    f"      → Wait for it to be ready, then proceed to testing\n"
                    f"   IF service is NOT running on port {task.deployment_port}:\n"
                    f"      → For NEW PROJECT INITIALIZATION:\n"
                    f"        • You MUST use the `boilerplate-mcp` server to initialize the project\n"
                    f"        • DO NOT create projects manually\n"
                    f"        • When calling boilerplate generation, CRITICALLY ensure you pass:\n"
                    f"          - gateway_port={task.deployment_port} \n"
                    f"          - path should be the same as the project path as are initialised\n"
                    f"      → For EXISTING PROJECTS:\n"
                    f"        • ANALYZE the project structure first to determine what services exist\n"
                    f"        • If ONLY BACKEND exists:\n"
                    f"          → Expose backend directly on port {task.deployment_port}\n"
                    f"          → docker-compose.yaml: backend service with ports: '{task.deployment_port}:<backend_internal_port>'\n"
                    f"        • If ONLY FRONTEND exists:\n"
                    f"          → Expose frontend directly on port {task.deployment_port}\n"
                    f"          → docker-compose.yaml: frontend service with ports: '{task.deployment_port}:<frontend_internal_port>'\n"
                    f"        • If BOTH FRONTEND AND BACKEND exist:\n"
                    f"          → Create an NGINX service as the gateway on port {task.deployment_port}\n"
                    f"          → Frontend and backend should NOT expose ports externally\n"
                    f"          → NGINX configuration:\n"
                    f"            - Listen on port 80 inside container, map '{task.deployment_port}:80' in docker-compose\n"
                    f"            - Route '/' to frontend service (proxy_pass http://frontend:<frontend_port>)\n"
                    f"            - Route '/api' to backend service (proxy_pass http://backend:<backend_port>)\n"
                    f"          → Example nginx.conf:\n"
                    f"            server {{\n"
                    f"              listen 80;\n"
                    f"              location / {{\n"
                    f"                proxy_pass http://frontend:3000;\n"
                    f"                proxy_http_version 1.1;\n"
                    f"                proxy_set_header Upgrade $http_upgrade;\n"
                    f"                proxy_set_header Connection 'upgrade';\n"
                    f"                proxy_set_header Host $host;\n"
                    f"              }}\n"
                    f"              location /api {{\n"
                    f"                proxy_pass http://backend:8000;\n"
                    f"                proxy_set_header Host $host;\n"
                    f"                proxy_set_header X-Real-IP $remote_addr;\n"
                    f"              }}\n"
                    f"            }}\n"
                    f"          → docker-compose.yaml structure:\n"
                    f"            services:\n"
                    f"              nginx:\n"
                    f"                image: nginx:alpine\n"
                    f"                ports: ['{task.deployment_port}:80']\n"
                    f"                volumes: ['./nginx.conf:/etc/nginx/conf.d/default.conf']\n"
                    f"                depends_on: [frontend, backend]\n"
                    f"              frontend:\n"
                    f"                build: ./frontend\n"
                    f"                expose: ['3000']  # Internal only, no external port mapping\n"
                    f"              backend:\n"
                    f"                build: ./backend\n"
                    f"                expose: ['8000']  # Internal only, no external port mapping\n"
                    f"        • UPDATE .env FILE for Docker deployment:\n"
                    f"          → Check for existing .env or .env.example files in the project\n"
                    f"          → For frontend .env:\n"
                    f"            - If BOTH frontend and backend: set API_URL or NEXT_PUBLIC_API_URL to '/api' (relative path through nginx)\n"
                    f"            - If frontend-only: configure as needed for the app\n"
                    f"          → For backend .env:\n"
                    f"            - Set appropriate DATABASE_URL, REDIS_URL if needed\n"
                    f"            - Set CORS_ORIGINS to allow the frontend origin\n"
                    f"          → For docker-compose.yaml, pass env vars using:\n"
                    f"            - env_file: ['.env'] to load from file, OR\n"
                    f"            - environment: section for explicit values\n"
                    f"          → Example frontend environment for full-stack:\n"
                    f"            frontend:\n"
                    f"              environment:\n"
                    f"                - NEXT_PUBLIC_API_URL=/api\n"
                    f"          → Example backend environment:\n"
                    f"            backend:\n"
                    f"              env_file: ['./backend/.env']\n"
                    f"        • Use dev mode with volume mounts for hot reload where applicable\n"
                    f"        • Run: docker compose up -d --build\n"
                    f"        • Wait for all services to be healthy before testing\n\n"
                    f"STEP 3 - VERIFY BEFORE TESTING:\n"
                    f"   Always confirm service responds on {hosting_fqdn} before using Playwright MCP\n"
                    f"   Take snapshots and delete the snapshots after testing to verify the service is working as expected\n"
                    f"   Use: curl -I {hosting_fqdn}\n\n"
                    f"STEP 4 - PLAYWRIGHT MCP TESTING:\n"
                    f"   Navigate to: {hosting_fqdn}\n"
                    f"   DO NOT use any other URL or port for testing\n\n"
                    f"🚫 PROHIBITED ACTIONS:\n"
                    f"- DO NOT use `npm run dev`, `python manage.py runserver`, or similar on random ports\n"
                    f"- DO NOT create new deployments on different ports\n"
                    f"- DO NOT skip the port verification step before Playwright testing\n"
                    f"- DO NOT manually create new projects - ALWAYS use boilerplate-mcp server\n"
                    f"- DO NOT forget to pass deployment_port={task.deployment_port} to boilerplate generation\n"
                    f"- DO NOT expose frontend or backend ports directly when BOTH services exist - use NGINX as gateway\n"
                    f"- DO NOT map frontend or backend to port {task.deployment_port} when both exist - only NGINX should use that port\n"
                    f"- DO NOT skip creating nginx.conf when both frontend and backend are present\n"
                    f"- DO NOT use 'ports:' for frontend/backend in docker-compose when nginx is the gateway - use 'expose:' instead\n"
                    f"---\n"
                )
                enhanced_prompt = prompt + deployment_context

            prompt = enhanced_prompt
            prompt = prompt + f"\n\n{SUPER_CLAUDE_MODE_PROMPT}\n"
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
            
            # Make request to remote service with retry logic for 503 errors
            max_retries = 5
            base_delay = 1.0  # Start with 1 second
            
            for attempt in range(max_retries):
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.post(
                            self.query_url,
                            json=payload,
                            headers={"Content-Type": "application/json"}
                        )
                        
                        # If 503, retry with exponential backoff
                        if response.status_code == 503:
                            if attempt < max_retries - 1:
                                # Calculate exponential delay: 1s, 2s, 4s, 8s, 16s
                                delay = base_delay * (2 ** attempt)
                                logger.warning(
                                    f"⚠️ External API returned 503 (Service Unavailable) | "
                                    f"attempt={attempt + 1}/{max_retries} | "
                                    f"retrying in {delay}s | "
                                    f"chat_id={str(chat_id)[:8]}..."
                                )
                                await asyncio.sleep(delay)
                                continue
                            else:
                                # Last attempt failed with 503
                                logger.error(
                                    f"❌ External API returned 503 after {max_retries} attempts | "
                                    f"chat_id={str(chat_id)[:8]}..."
                                )
                                raise Exception(f"Query request failed after {max_retries} retries: 503 Service Unavailable")
                        
                        # For non-503 errors, fail immediately
                        if response.status_code != 200:
                            raise Exception(f"Query request failed: {response.status_code}")
                        
                        # Success - parse and return result
                        result = response.json()
                        
                        # Log successful retry if it was a retry
                        if attempt > 0:
                            logger.info(
                                f"✅ External API request succeeded after {attempt + 1} attempts | "
                                f"chat_id={str(chat_id)[:8]}..."
                            )
                        
                        # Store the initial query info
                        await self._store_initial_hook(db, chat_id, payload, result)
                        
                        return result
                        
                except httpx.HTTPStatusError as e:
                    # Handle httpx HTTPStatusError (includes 503)
                    if e.response.status_code == 503:
                        if attempt < max_retries - 1:
                            delay = base_delay * (2 ** attempt)
                            logger.warning(
                                f"⚠️ External API returned 503 (Service Unavailable) | "
                                f"attempt={attempt + 1}/{max_retries} | "
                                f"retrying in {delay}s | "
                                f"chat_id={str(chat_id)[:8]}..."
                            )
                            await asyncio.sleep(delay)
                            continue
                        else:
                            logger.error(
                                f"❌ External API returned 503 after {max_retries} attempts | "
                                f"chat_id={str(chat_id)[:8]}..."
                            )
                            raise Exception(f"Query request failed after {max_retries} retries: 503 Service Unavailable")
                    else:
                        # Non-503 HTTP error, fail immediately
                        raise Exception(f"Query request failed: {e.response.status_code}")
                except httpx.RequestError as e:
                    # Network/connection errors - don't retry these, fail immediately
                    logger.error(
                        f"❌ Network error during external API request | "
                        f"chat_id={str(chat_id)[:8]}... | "
                        f"error={str(e)[:100]}..."
                    )
                    raise Exception(f"Network error during query request: {str(e)}")
                
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
        auto_start_deploy = False

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
                elif webhook_type == "stage_transition":
                    step_name = f"Stage: {webhook_data.get('from_stage', 'unknown')} → {webhook_data.get('to_stage', 'unknown')}"
                else:
                    step_name = status.replace("_", " ").title()
            
            # Extract message from various possible locations
            message = webhook_data.get("message", "")

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

            # Check if this is a completed planning hook and update planning metadata
            if status == "completed" and webhook_type == "status":
                # Find if this chat is associated with a planning stage
                from app.models.issue_resolution import IssueResolution
                stmt = select(IssueResolution).where(
                    IssueResolution.planning_chat_id == chat_id
                )
                result_resolution = await db.execute(stmt)
                resolution = result_resolution.scalar_one_or_none()

                if resolution:
                    if resolution.planning_chat_id == chat_id:
                        resolution.planning_complete = True
                        resolution.planning_completed_at = datetime.utcnow()  # Use naive datetime for PostgreSQL
                        # Persist the final planning session_id if provided by the webhook
                        final_session_id = webhook_data.get("session_id")
                        if final_session_id:
                            resolution.planning_session_id = final_session_id
                        db.add(resolution)
                        logger.info(
                            f"✅ Marked planning complete | "
                            f"resolution_id={str(resolution.id)[:8]}... | "
                            f"chat_id={str(chat_id)[:8]}..."
                        )
                else:
                    stmt = select(IssueResolution).where(
                        IssueResolution.implementation_chat_id == chat_id
                    )
                    result_resolution = await db.execute(stmt)
                    resolution = result_resolution.scalar_one_or_none()

                    if resolution and resolution.implementation_chat_id == chat_id:
                        resolution.implementation_complete = True
                        resolution.implementation_completed_at = datetime.utcnow()
                        # Persist the final implementation session as well when available
                        final_impl_session_id = webhook_data.get("session_id")
                        if final_impl_session_id:
                            resolution.implementation_session_id = final_impl_session_id
                        if resolution.current_stage == "implementation" and not resolution.deploy_started_at:
                            auto_start_deploy = True
                        db.add(resolution)
                        logger.info(
                            f"✅ Marked implementation complete | "
                            f"resolution_id={str(resolution.id)[:8]}... | "
                            f"chat_id={str(chat_id)[:8]}..."
                        )

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

                    # CRITICAL: Inherit parent_session_id from user chat for sub-task tracking
                    if chat.parent_session_id and not existing_assistant.parent_session_id:
                        existing_assistant.parent_session_id = chat.parent_session_id

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

                        # CRITICAL: Inherit parent_session_id from user chat for sub-task tracking
                        if chat.parent_session_id and not existing_assistant.parent_session_id:
                            existing_assistant.parent_session_id = chat.parent_session_id

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
                            parent_session_id=chat.parent_session_id,  # CRITICAL: Inherit parent_session_id for sub-task tracking
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

            if auto_start_deploy and resolution:
                try:
                    from app.services.issue_resolution_orchestrator import IssueResolutionOrchestrator
                    orchestrator = IssueResolutionOrchestrator(db)
                    await orchestrator.trigger_deploy_stage(resolution.id)
                except Exception as auto_error:
                    logger.error(
                        f"🚨 Failed to auto-start deploy stage | "
                        f"resolution_id={str(resolution.id)[:8]}... | "
                        f"error={auto_error}"
                    )
            
            # TASK BREAKDOWN: Handle sub-task completion or failure
            if is_completion and status == "failed":
                # Handle sub-task failure
                error_text = webhook_data.get("error", "") or webhook_data.get("result", "") or "Task failed"
                await task_orchestration_service.handle_sub_task_failure(
                    db, chat, error_text
                )
                logger.info(f"❌ Sub-task marked as failed: {error_text[:100]}...")

            if is_completion and status == "completed":
                # Find the assistant chat to check if it's a sub-task
                stmt = select(Chat).where(
                    Chat.sub_project_id == chat.sub_project_id,
                    Chat.session_id == original_session_id,
                    Chat.role == "assistant"
                ).order_by(Chat.created_at.desc()).limit(1)

                result = await db.execute(stmt)
                assistant_chat = result.scalar_one_or_none()

                if assistant_chat:
                    # Check if next sub-task should be triggered
                    should_trigger_next = await task_orchestration_service.handle_sub_task_completion(
                        db, assistant_chat
                    )

                    if should_trigger_next:
                        # Get the next parallel group to execute
                        next_group = await task_orchestration_service.get_next_parallel_group(
                            db,
                            assistant_chat.parent_session_id,
                            chat.sub_project_id
                        )

                        if next_group is not None:
                            logger.info(f"🔄 Starting parallel group {next_group}")

                            # Start all tasks in the parallel group
                            parallel_tasks = await task_orchestration_service.start_parallel_group_tasks(
                                db,
                                assistant_chat.parent_session_id,
                                chat.sub_project_id,
                                next_group
                            )

                            # Send queries for all parallel tasks
                            for task_info in parallel_tasks:
                                sub_task_chat_id = task_info.get("chat_id")
                                if sub_task_chat_id:
                                    sub_task_chat = await db.get(Chat, UUID(sub_task_chat_id))
                                else:
                                    stmt = select(Chat).where(
                                        Chat.session_id == task_info["session_id"],
                                        Chat.role == "user"
                                    ).limit(1)
                                    result = await db.execute(stmt)
                                    sub_task_chat = result.scalar_one_or_none()

                                if not sub_task_chat:
                                    logger.error(f"❌ Pre-created sub-task chat not found for {task_info['session_id']}")
                                    continue

                                logger.info(
                                    f"📤 Sending parallel sub-task {task_info['sequence']}: "
                                    f"{task_info['title']} (group {next_group})"
                                )
                                try:
                                    await self.send_query(
                                        db,
                                        sub_task_chat.id,
                                        task_info["prompt"],
                                        session_id=None,
                                        bypass_mode=True,
                                        agent_name=None
                                    )
                                except Exception as send_error:
                                    logger.error(f"❌ Failed to send parallel sub-task query: {send_error}")

                            logger.info(f"✅ Started {len(parallel_tasks)} tasks in parallel group {next_group}")
                        else:
                            # Fallback to sequential execution for backward compatibility
                            next_task_info = await task_orchestration_service.start_next_sub_task(
                                db,
                                assistant_chat.parent_session_id,
                                chat.sub_project_id
                            )

                            if next_task_info:
                                sub_task_chat_id = next_task_info.get("chat_id")
                                if sub_task_chat_id:
                                    sub_task_chat = await db.get(Chat, UUID(sub_task_chat_id))
                                else:
                                    stmt = select(Chat).where(
                                        Chat.session_id == next_task_info["session_id"],
                                        Chat.role == "user"
                                    ).limit(1)
                                    result = await db.execute(stmt)
                                    sub_task_chat = result.scalar_one_or_none()

                                if sub_task_chat:
                                    logger.info(f"📤 Sending sub-task {next_task_info['sequence']}: {next_task_info['title']}")
                                    try:
                                        await self.send_query(
                                            db,
                                            sub_task_chat.id,
                                            next_task_info["prompt"],
                                            session_id=None,
                                            bypass_mode=True,
                                            agent_name=None
                                        )
                                    except Exception as send_error:
                                        logger.error(f"❌ Failed to send sub-task query: {send_error}")
            
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
    
    async def analyze_and_create_breakdown(
        self,
        db: AsyncSession,
        chat: Chat,
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze a user message for task breakdown using the external chat service in plan mode.

        Flow:
        1. Quick check if breakdown might be needed (using OpenAI)
        2. If yes, send planning query to external chat service
        3. Return "planning_in_progress" state
        4. When planning webhook completes, parse plan and create breakdowns (in process_webhook)

        Returns breakdown info if analysis recommends breakdown, None otherwise.
        """
        try:
            # Check if should analyze
            if not await self._should_analyze_for_breakdown(chat):
                logger.info(f"⏭️ Skipping breakdown analysis for chat {str(chat.id)[:8]}...")
                return None

            prompt = chat.content.get("text", "")
            logger.info(f"🔍 Starting plan mode analysis (chat_id={str(chat.id)[:8]}...)")

            # Generate planning prompt for external service
            planning_prompt = task_analysis_service.generate_planning_prompt(prompt, context)
            print(f"planning_prompt: {planning_prompt}")
            # Get project/task info for the external service
            from app.models import SubProject, Task as TaskModel, Project as ProjectModel
            sub_project = await db.get(SubProject, chat.sub_project_id)
            if not sub_project:
                logger.error(f"❌ SubProject not found for chat {str(chat.id)[:8]}...")
                return None

            task = await db.get(TaskModel, sub_project.task_id)
            project = await db.get(ProjectModel, task.project_id)
            # Create a planning webhook URL
            planning_webhook_url = f"{self.webhook_base_url}/api/webhooks/chat/{chat.id}/planning"
            # Prepare payload for planning query
            payload = {
                "prompt": planning_prompt,
                "webhook_url": planning_webhook_url,
                "organization_name": self.org_name,
                "project_path": f"{project.name}/{task.id}",
                "options": {
                    "permission_mode": "bypassPermissions"  # Planning runs without approvals
                },
            }

            # Mark chat as planning in progress
            from sqlalchemy.orm.attributes import flag_modified
            current_content = chat.content.copy()
            current_metadata = current_content.get("metadata", {})
            current_metadata["planning_in_progress"] = True
            current_metadata["planning_started_at"] = datetime.now(timezone.utc).isoformat()
            current_metadata["original_prompt"] = prompt
            current_metadata["context"] = context
            current_content["metadata"] = current_metadata
            chat.content = current_content
            flag_modified(chat, "content")
            chat.parent_session_id = chat.session_id  # Mark as parent
            db.add(chat)
            await db.commit()

            # Send planning query to external service
            logger.info(f"📤 Sending planning query to external service (chat_id={str(chat.id)[:8]}...)")

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.query_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code != 200:
                    logger.error(f"❌ Planning query failed: {response.status_code}")
                    # Reset planning state
                    current_metadata["planning_in_progress"] = False
                    current_metadata["planning_error"] = f"External service error: {response.status_code}"
                    chat.content = current_content
                    flag_modified(chat, "content")
                    db.add(chat)
                    await db.commit()
                    return None

                result = response.json()
                planning_task_id = result.get("task_id")
                planning_session_id = result.get("session_id")

                # Store planning task info
                current_metadata["planning_task_id"] = planning_task_id
                current_metadata["planning_session_id"] = planning_session_id
                chat.content = current_content
                flag_modified(chat, "content")
                db.add(chat)
                await db.commit()

                logger.info(
                    f"✅ Planning query sent | "
                    f"chat_id={str(chat.id)[:8]}... | "
                    f"planning_task_id={planning_task_id}"
                )

            # Return planning in progress state
            # The UI should show a "planning" indicator
            # When the planning webhook completes, it will parse the plan and create breakdowns
            return {
                "is_breakdown": True,
                "planning_in_progress": True,
                "planning_task_id": planning_task_id,
                "total_sub_tasks": 0,  # Will be determined when planning completes
                "reasoning": "Analyzing codebase and creating task breakdown plan...",
                "sub_tasks": []
            }

        except Exception as e:
            logger.error(f"❌ Planning analysis failed: {e}")
            # Fallback: treat as single task
            chat.parent_session_id = chat.session_id
            db.add(chat)
            await db.commit()
            return None

    async def process_planning_webhook(
        self,
        db: AsyncSession,
        chat_id: UUID,
        webhook_data: Dict[str, Any]
    ):
        """
        Process planning webhook from external service.

        When planning completes:
        1. Extract the plan text from the webhook
        2. Parse the plan into structured sub-tasks using OpenAI
        3. Create breakdown sessions
        4. Notify UI via Redis
        """
        try:
            chat = await db.get(Chat, chat_id)
            if not chat:
                logger.error(f"❌ Chat not found for planning webhook: {chat_id}")
                return

            status = webhook_data.get("status", "processing")
            is_completion = status in ["completed", "failed"]

            if not is_completion:
                # Store intermediate planning hooks for UI visibility
                hook = ChatHook(
                    chat_id=chat_id,
                    session_id=chat.session_id,
                    conversation_id=webhook_data.get("conversation_id"),
                    hook_type="planning",
                    status=status,
                    data=webhook_data,
                    message=webhook_data.get("message", "Planning in progress..."),
                    is_complete=False,
                    step_name=webhook_data.get("step_name", "Analyzing codebase...")
                )
                db.add(hook)
                await db.commit()
                return

            hook = ChatHook(
                chat_id=chat_id,
                session_id=chat.session_id,
                conversation_id=webhook_data.get("conversation_id"),
                hook_type="planning",
                status=status,
                data=webhook_data,
                message=webhook_data.get("message", "Planning finished"),
                is_complete=True,
                step_name="Planning completed"
            )
            db.add(hook)
            await db.commit()
            # Planning completed - extract the plan
            plan_text = webhook_data.get("result", "")
            error_text = webhook_data.get("error", "")

            if status == "failed" or not plan_text:
                logger.error(f"❌ Planning failed: {error_text or 'No plan returned'}")
                # Reset planning state and treat as single task
                from sqlalchemy.orm.attributes import flag_modified
                current_content = chat.content.copy()
                current_metadata = current_content.get("metadata", {})
                current_metadata["planning_in_progress"] = False
                current_metadata["planning_error"] = error_text or "Planning failed"
                chat.content = current_content
                flag_modified(chat, "content")
                db.add(chat)
                await db.commit()
                return

            logger.info(f"📋 Planning completed, parsing plan (chat_id={str(chat_id)[:8]}...)")

            # Get original prompt and context from chat metadata
            metadata = chat.content.get("metadata", {})
            original_prompt = metadata.get("original_prompt", "")
            context = metadata.get("context", {})

            # Parse the plan into structured sub-tasks using OpenAI
            analysis = await task_analysis_service.parse_plan_response(plan_text, original_prompt)

            if not analysis.should_breakdown:
                logger.info(f"📝 Plan parsing: No breakdown needed - {analysis.reasoning}")
                # Reset planning state
                from sqlalchemy.orm.attributes import flag_modified
                current_content = chat.content.copy()
                current_metadata = current_content.get("metadata", {})
                current_metadata["planning_in_progress"] = False
                current_metadata["planning_complete"] = True
                current_metadata["breakdown_needed"] = False
                current_metadata["plan_reasoning"] = analysis.reasoning
                chat.content = current_content
                flag_modified(chat, "content")
                db.add(chat)
                await db.commit()

                # Send the original query as a single task
                await self.send_query(
                    db,
                    chat.id,
                    original_prompt,
                    session_id=None,
                    bypass_mode=True
                )
                return

            # Create breakdown structure
            logger.info(f"✂️ Creating breakdown with {len(analysis.sub_tasks)} sub-tasks")

            breakdown_metadata = await task_orchestration_service.create_breakdown_sessions(
                db, chat, analysis, context
            )

            # Update chat with final breakdown info
            from sqlalchemy.orm.attributes import flag_modified
            current_content = chat.content.copy()
            current_metadata = current_content.get("metadata", {})
            current_metadata["planning_in_progress"] = False
            current_metadata["planning_complete"] = True
            current_metadata["breakdown_needed"] = True
            current_metadata["plan_text"] = plan_text[:2000]  # Store truncated plan for reference
            current_metadata.update(breakdown_metadata)
            chat.content = current_content
            flag_modified(chat, "content")
            db.add(chat)
            await db.commit()

            logger.info(
                f"✅ Breakdown created from plan | "
                f"chat_id={str(chat_id)[:8]}... | "
                f"sub_tasks={len(analysis.sub_tasks)} | "
                f"parallel_groups={len(analysis.parallel_groups or [])}"
            )

            # Automatically start the first parallel group after breakdown creation
            first_group = await task_orchestration_service.get_next_parallel_group(
                db,
                chat.session_id,
                chat.sub_project_id
            )

            if first_group is not None:
                logger.info(f"🚀 Auto-starting first parallel group {first_group}")

                # Start all tasks in the first parallel group
                parallel_tasks = await task_orchestration_service.start_parallel_group_tasks(
                    db,
                    chat.session_id,
                    chat.sub_project_id,
                    first_group
                )

                # Send queries for all parallel tasks
                for task_info in parallel_tasks:
                    sub_task_chat_id = task_info.get("chat_id")
                    if sub_task_chat_id:
                        sub_task_chat = await db.get(Chat, UUID(sub_task_chat_id))
                    else:
                        stmt = select(Chat).where(
                            Chat.session_id == task_info["session_id"],
                            Chat.role == "user"
                        ).limit(1)
                        result = await db.execute(stmt)
                        sub_task_chat = result.scalar_one_or_none()

                    if not sub_task_chat:
                        logger.error(f"❌ Sub-task chat not found for {task_info['session_id']}")
                        continue

                    logger.info(
                        f"📤 Sending parallel sub-task {task_info['sequence']}: "
                        f"{task_info['title']} (group {first_group})"
                    )
                    try:
                        await self.send_query(
                            db,
                            sub_task_chat.id,
                            task_info["prompt"],
                            session_id=None,
                            bypass_mode=True,
                            agent_name=None
                        )
                    except Exception as send_error:
                        logger.error(f"❌ Failed to send parallel sub-task query: {send_error}")

                logger.info(f"✅ Auto-started {len(parallel_tasks)} tasks in parallel group {first_group}")

        except Exception as e:
            logger.error(f"❌ Planning webhook processing failed: {e}")
            raise


# Create service instance
chat_service = ChatService()
