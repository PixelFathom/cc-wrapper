import httpx
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime, timezone
import time
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy import text

from app.core.settings import get_settings
from app.models import TestCase, Task, Project, TestCaseHook

logger = logging.getLogger(__name__)


class TestCaseService:
    def __init__(self):
        self.settings = get_settings()
        self.org_name = self.settings.org_name
        self.webhook_base_url = self.settings.webhook_base_url
        self.query_url = self.settings.query_url
        self.redis_client = None
        
    def set_redis_client(self, redis_client):
        """Set Redis client for real-time updates"""
        self.redis_client = redis_client
        
    async def execute_test_case(
        self, 
        db: AsyncSession, 
        test_case_id: UUID
    ) -> Dict[str, Any]:
        """Execute a test case by sending it to the remote service"""
        try:
            # Get test case and related task/project info
            test_case = await db.get(TestCase, test_case_id)
            if not test_case:
                raise ValueError("Test case not found")
            
            # Get task and project for context
            task = await db.get(Task, test_case.task_id)
            if not task:
                raise ValueError("Task not found")
            
            project = await db.get(Project, task.project_id)
            if not project:
                raise ValueError("Project not found")
            
            # Generate webhook URL (using webhooks endpoint pattern like chat)
            webhook_url = f"{self.webhook_base_url}/api/webhooks/test-case/{test_case_id}"
            project_path = f"{project.name}/{task.name}-{task.id}"
            
            # Include deployment guide context if available
            deployment_context = ""
            if task.deployment_guide:
                deployment_context = f"""

**DEPLOYMENT & TESTING CONTEXT:**
{task.deployment_guide}

"""

            # Prepare execution query
            execution_query = f"""
Execute the following test case and verify if it passes:

**Test Case:** {test_case.title}

**Description:** {test_case.description or 'No description provided'}

**Test Steps:**
{test_case.test_steps}

**Expected Result:**
{test_case.expected_result}

{deployment_context}Please execute this test case and provide:
1. Whether the test PASSED or FAILED
2. The actual result obtained
3. Any fixes needed if the test failed

If the test fails, please implement the necessary fixes to make it pass.
"""
            
            # Prepare request payload
            payload = {
                "prompt": execution_query,
                "webhook_url": webhook_url,
                "organization_name": self.org_name,
                "project_path": project_path,
                "options": {
                    "permission_mode": "bypassPermissions"
                }
            }
            
            # Make request to remote service
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.query_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    raise Exception(f"Query request failed: {response.status_code}")
                
                result = response.json()
                
                # Store the initial query info
                await self._store_initial_hook(db, test_case_id, payload, result)
                
                return result
                
        except Exception as e:
            logger.error(f"Error executing test case {test_case_id}: {str(e)}")
            raise
    
    async def _store_initial_hook(
        self, 
        db: AsyncSession, 
        test_case_id: UUID, 
        payload: Dict[str, Any], 
        result: Dict[str, Any]
    ):
        """Store initial hook for the test case execution"""
        hook = TestCaseHook(
            test_case_id=test_case_id,
            session_id=result.get("session_id", str(test_case_id)),
            hook_type="execution_initiated",
            status="processing",
            data={
                "execution_payload": payload,
                "response": result,
                "task_id": result.get("task_id")
            },
            message="Test case execution sent to remote service"
        )
        
        db.add(hook)
        await db.commit()
        await db.refresh(hook)
    
    async def process_webhook(
        self, 
        db: AsyncSession, 
        test_case_id: UUID, 
        webhook_data: Dict[str, Any]
    ):
        """Process incoming webhook from remote service"""        
        try:
            logger.info(f"🎯 Processing test case webhook for {test_case_id} - webhook_data: {webhook_data}")
            # Get the original test case
            test_case = await db.get(TestCase, test_case_id)
            if not test_case:
                raise ValueError(f"Test case {test_case_id} not found")
            
            webhook_session_id = webhook_data.get("session_id", str(test_case_id))
            webhook_type = webhook_data.get("type", "processing")
            status = webhook_data.get("status", "received")
            
            # Extract fields based on webhook format
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
                    step_name = "Processing test case"
                elif status == "user_message":
                    step_name = "Received test case"
                elif status == "processing":
                    step_name = "Executing test case"
                elif status == "completed":
                    step_name = "Test case execution completed"
                elif webhook_type == "thinking":
                    step_name = webhook_data.get("content", "Analyzing test case...")
                else:
                    step_name = status.replace("_", " ").title()
            
            # Extract message from various possible locations
            message = webhook_data.get("message", "")
            if not message and result:
                # Use result as message for display
                message = str(result)[:500]  # Truncate long results
            
            # Create hook entry
            hook = TestCaseHook(
                test_case_id=test_case_id,
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
            
            logger.info(f"📝 Created test case hook: {hook.hook_type}/{hook.status} - {hook.step_name}")
            db.add(hook)
            
            # Check if this is a completion message
            is_completion = (
                webhook_data.get("status") in ["completed", "failed"] or
                webhook_data.get("type") == "result"
            )
            
            logger.info(f"Test case hook processing: completion={is_completion}")
            
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
                    response_text = "Test case execution completed but no result was provided."
                
                # Update test case with final result
                test_case.execution_result = response_text
                
                # Parse result to determine if test passed or failed
                content = response_text.upper()
                if "PASSED" in content or "PASS" in content:
                    test_case.status = "passed"
                elif "FAILED" in content or "FAIL" in content or error_text:
                    test_case.status = "failed"
                else:
                    # Default to failed if status is unclear
                    test_case.status = "failed"
                
                db.add(test_case)
            
            await db.commit()
            await db.refresh(hook)
            
            # Publish to Redis for real-time updates
            if self.redis_client:
                import json
                await self.redis_client.publish(
                    f"test_case:{test_case_id}",
                    json.dumps({
                        "type": "webhook",
                        "data": webhook_data,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                )
            
        except Exception as e:
            logger.error(
                f"💥 Test case webhook processing error | "
                f"test_case_id={str(test_case_id)[:8]}... | "
                f"error={str(e)[:100]}..."
            )
            raise
    
    async def get_test_case_hooks(
        self, 
        db: AsyncSession, 
        test_case_id: UUID,
        session_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get hooks for a specific test case"""
        try:
            query = select(TestCaseHook).where(TestCaseHook.test_case_id == test_case_id)
            
            if session_id:
                query = query.where(TestCaseHook.session_id == session_id)
            
            query = query.order_by(TestCaseHook.received_at.asc()).limit(limit)
            
            result = await db.execute(query)
            hooks = result.scalars().all()
            
            logger.debug(
                f"📋 Retrieved test case hooks | "
                f"test_case_id={str(test_case_id)[:8]}... | "
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
                f"💥 Error retrieving test case hooks | "
                f"test_case_id={str(test_case_id)[:8]}... | "
                f"error={str(e)[:100]}..."
            )
            raise


# Create service instance
test_case_service = TestCaseService()