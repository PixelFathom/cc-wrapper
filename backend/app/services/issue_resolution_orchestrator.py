"""
Issue Resolution Orchestrator Service

Manages the four-stage workflow for GitHub issue resolution:
1. Deployment - Environment setup using init_project
2. Planning - Analysis and plan creation
3. Implementation - Executing the approved plan
4. Testing - Generating and running tests
"""

from typing import Optional, Dict, Any
from datetime import datetime
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import String
from uuid import UUID
import logging
import json
import httpx

from app.models.issue_resolution import IssueResolution
from app.models.task import Task
from app.models.chat import Chat
from app.models.sub_project import SubProject
from app.models.project import Project
from app.models.github_issue import GitHubIssue
from app.models.user import User
from app.services.chat_service import ChatService
from app.services.test_generation_service import TestGenerationService
from app.services.test_case_service import TestCaseService
from app.services.github_auth_service import GitHubAuthService
from app.core.prompts.issue_resolution_prompts import (
    PLANNING_PROMPT_TEMPLATE,
    IMPLEMENTATION_PROMPT_TEMPLATE,
    TESTING_SUMMARY_PROMPT
)
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class IssueResolutionOrchestrator:
    """Orchestrates the four-stage issue resolution workflow"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_service = ChatService()
        self.test_generation_service = TestGenerationService()
        self.test_case_service = TestCaseService()

    async def get_resolution_with_relations(self, resolution_id: UUID) -> IssueResolution:
        """Get issue resolution with all necessary relations"""
        statement = select(IssueResolution).where(IssueResolution.id == resolution_id)
        result = await self.db.execute(statement)
        resolution = result.scalar_one_or_none()
        if not resolution:
            raise ValueError(f"IssueResolution {resolution_id} not found")
        return resolution

    async def transition_to_stage(
        self,
        resolution_id: UUID,
        new_stage: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> IssueResolution:
        """Transition resolution to a new stage"""
        resolution = await self.get_resolution_with_relations(resolution_id)

        # Validate stage transition
        valid_transitions = {
            "deployment": ["planning"],
            "planning": ["implementation"],
            "implementation": ["testing"],
            "testing": ["completed"]
        }

        if resolution.current_stage not in valid_transitions:
            raise ValueError(f"Cannot transition from stage {resolution.current_stage}")

        if new_stage not in valid_transitions.get(resolution.current_stage, []):
            raise ValueError(f"Cannot transition from {resolution.current_stage} to {new_stage}")

        # Update stage
        old_stage = resolution.current_stage
        resolution.current_stage = new_stage

        # Set stage timestamps
        if new_stage == "planning":
            resolution.planning_started_at = datetime.utcnow()
        elif new_stage == "implementation":
            resolution.implementation_started_at = datetime.utcnow()
        elif new_stage == "testing":
            resolution.testing_started_at = datetime.utcnow()

        # Update resolution state for backward compatibility
        state_mapping = {
            "deployment": "initializing",
            "planning": "analyzing",
            "implementation": "implementing",
            "testing": "testing",
            "completed": "ready_for_pr"
        }
        resolution.resolution_state = state_mapping.get(new_stage, resolution.resolution_state)

        self.db.add(resolution)
        await self.db.commit()

        logger.info(f"Transitioned issue resolution {resolution_id} from {old_stage} to {new_stage}")
        return resolution

    async def trigger_planning_stage(self, resolution_id: UUID) -> Dict[str, Any]:
        """
        Stage 2: Send planning query after deployment completes
        Uses interactive permission mode to allow manual review
        """
        resolution = await self.get_resolution_with_relations(resolution_id)

        # Get related entities
        task = await self.db.get(Task, resolution.task_id)
        if not task:
            raise ValueError(f"Task {resolution.task_id} not found")

        # GitHub issue is optional - we have all the info we need in resolution model
        github_issue = None
        if resolution.github_issue_id:
            github_issue = await self.db.get(GitHubIssue, resolution.github_issue_id)

        # Prepare planning context
        repo_context = task.context_data or {}
        logger.info(f"Repo context: {repo_context}")
        logger.info(f"Issue title: {resolution.issue_title}")
        logger.info(f"Issue body: {resolution.issue_body}")
        logger.info(f"Issue number: {resolution.issue_number}")
        logger.info(f"Issue labels: {resolution.issue_labels}")
        # Create planning prompt
        planning_prompt = PLANNING_PROMPT_TEMPLATE.format(
            issue_title=resolution.issue_title,
            issue_body=resolution.issue_body or "",
            issue_number=resolution.issue_number,
            repo_context=json.dumps(repo_context, indent=2) if repo_context else "No repository context available",
            issue_labels=", ".join(resolution.issue_labels or [])
        )
        logger.info(f"Planning prompt: {planning_prompt}")

        # Get or create SubProject for this task
        from app.models.sub_project import SubProject
        stmt = select(SubProject).where(SubProject.task_id == task.id)
        result = await self.db.execute(stmt)
        sub_project = result.scalar_one_or_none()

        if not sub_project:
            sub_project = SubProject(task_id=task.id)
            self.db.add(sub_project)
            await self.db.flush()


        # Create planning chat session with correct format
        chat = Chat(
            sub_project_id=sub_project.id,
            role="user",
            content={
                "text": planning_prompt,
                "metadata": {
                    "stage": "planning",
                    "issue_resolution_id": str(resolution.id),
                    "issue_number": resolution.issue_number
                }
            }
        )
        self.db.add(chat)
        await self.db.commit()
        await self.db.refresh(chat)

        # Send planning query with interactive permission mode
        response = await self.chat_service.send_query(
            db=self.db,
            chat_id=chat.id,
            prompt=planning_prompt,
            permission_mode="plan",
        )

        # Update resolution with planning session info
        resolution.planning_session_id = response.get("session_id")
        resolution.planning_chat_id = chat.id
        resolution.current_stage = "planning"
        resolution.planning_started_at = datetime.utcnow()

        self.db.add(resolution)
        await self.db.commit()

        logger.info(f"Started planning stage for issue resolution {resolution_id}")
        return {
            "stage": "planning",
            "session_id": response.get("session_id"),
            "chat_id": chat.id,
            "task_id": response.get("task_id")
        }

    async def approve_plan_and_start_implementation(
        self,
        resolution_id: UUID,
        user_id: UUID,
        session_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Approve the planning stage and trigger implementation
        Uses bypass mode for automatic tool execution

        Args:
            resolution_id: UUID of the issue resolution
            user_id: UUID of the user approving the plan
            notes: Optional notes from the approver
        """
        resolution = await self.get_resolution_with_relations(resolution_id)

        # Validate current stage
        if resolution.current_stage != "planning":
            raise ValueError(f"Cannot approve plan in stage {resolution.current_stage}")

        # Mark planning as approved
        resolution.planning_approved = True
        resolution.planning_approval_by = user_id
        resolution.planning_approval_at = datetime.utcnow()
        resolution.planning_complete = True
        resolution.planning_completed_at = datetime.utcnow()

        # Get task and planning chat
        task = await self.db.get(Task, resolution.task_id)
        if not task:
            raise ValueError(f"Task {resolution.task_id} not found")

        # Get or create SubProject for this task
        from app.models.sub_project import SubProject
        stmt = select(SubProject).where(SubProject.task_id == task.id)
        result = await self.db.execute(stmt)
        sub_project = result.scalar_one_or_none()

        if not sub_project:
            sub_project = SubProject(task_id=task.id)
            self.db.add(sub_project)
            await self.db.flush()

        # Get the planning chat to extract the plan
        planning_chat = None
        if resolution.planning_chat_id:
            planning_chat = await self.db.get(Chat, resolution.planning_chat_id)

        # Get the assistant's planning response
        plan_details = "Plan approved - proceeding with implementation"
        if planning_chat:
            # Find assistant response in the same sub_project
            statement = select(Chat).where(
                Chat.sub_project_id == sub_project.id,
                Chat.role == "assistant",
                Chat.session_id == resolution.planning_session_id
            ).order_by(Chat.created_at.desc())
            result = await self.db.execute(statement)
            assistant_chat = result.scalar_one_or_none()
            if assistant_chat and assistant_chat.content:
                plan_details = assistant_chat.content.get("text", plan_details)

        # Store plan in solution_approach as JSON
        solution_data = {
            "plan": plan_details,
            "approved_by": str(user_id),
            "approved_at": datetime.utcnow().isoformat()
        }
        if notes:
            solution_data["approval_notes"] = notes

        resolution.solution_approach = json.dumps(solution_data)

        # Create implementation prompt
        implementation_prompt = IMPLEMENTATION_PROMPT_TEMPLATE.format(
            plan=plan_details,
            issue_title=resolution.issue_title,
            issue_body=resolution.issue_body or "",
            issue_number=resolution.issue_number,
            resolution_branch=resolution.resolution_branch or f"fix-issue-{resolution.issue_number}"
        )

        # Create implementation chat with correct format
        chat = Chat(
            sub_project_id=sub_project.id,
            session_id=session_id,
            role="user",
            content={
                "text": implementation_prompt,
                "metadata": {
                    "stage": "implementation",
                    "issue_resolution_id": str(resolution.id),
                    "issue_number": resolution.issue_number,
                    "plan_approved": True
                }
            }
        )
        self.db.add(chat)
        await self.db.commit()
        await self.db.refresh(chat)

        # Send implementation query with bypass permissions
        response = await self.chat_service.send_query(
            db=self.db,
            chat_id=chat.id,
            prompt=implementation_prompt,
            session_id=session_id,
            bypass_mode=True,  # Auto-approve all tools for implementation
            permission_mode="bypassPermissions",
            agent_name="issue_resolution_implementer"
        )

        # Update resolution
        resolution.implementation_session_id = response.get("session_id")
        resolution.implementation_chat_id = chat.id
        resolution.current_stage = "implementation"
        resolution.implementation_started_at = datetime.utcnow()
        resolution.resolution_state = "implementing"

        self.db.add(resolution)
        await self.db.commit()

        logger.info(f"Approved plan and started implementation for issue resolution {resolution_id}")
        return {
            "stage": "implementation",
            "session_id": response.get("session_id"),
            "chat_id": chat.id,
            "task_id": response.get("task_id")
        }

    async def complete_implementation_and_start_testing(
        self,
        resolution_id: UUID
    ) -> Dict[str, Any]:
        """
        Mark implementation as complete and trigger testing stage
        Automatically generates and runs tests
        """
        resolution = await self.get_resolution_with_relations(resolution_id)

        # Validate current stage
        if resolution.current_stage != "implementation":
            raise ValueError(f"Cannot start testing in stage {resolution.current_stage}")

        # Mark implementation as complete
        resolution.implementation_complete = True
        resolution.implementation_completed_at = datetime.utcnow()

        # Transition to testing stage
        resolution.current_stage = "testing"
        resolution.testing_started_at = datetime.utcnow()
        resolution.resolution_state = "testing"

        self.db.add(resolution)
        await self.db.commit()

        # Generate tests from implementation session
        test_result = await self.test_generation_service.generate_test_cases_from_session(
            db=self.db,
            session_id=resolution.implementation_session_id,
            max_test_cases=5,
            focus_areas=["issue_fix", "regression", "edge_cases"]
        )
        test_cases = test_result.get('test_cases', [])

        resolution.test_cases_generated = len(test_cases)

        # Execute each test case
        passed_count = 0
        failed_count = 0
        test_results = []

        for test_case in test_cases:
            try:
                result = await self.test_case_service.execute_test_case(
                    db=self.db,
                    test_case_id=test_case.id
                )

                if test_case.status == "passed":
                    passed_count += 1
                else:
                    failed_count += 1

                test_results.append({
                    "id": str(test_case.id),
                    "title": test_case.title,
                    "status": test_case.status,
                    "execution_result": test_case.execution_result
                })
            except Exception as e:
                logger.error(f"Error executing test case {test_case.id}: {str(e)}")
                failed_count += 1
                test_results.append({
                    "id": str(test_case.id),
                    "title": test_case.title,
                    "status": "failed",
                    "error": str(e)
                })

        # Update resolution with test results
        resolution.test_cases_passed = passed_count
        resolution.testing_completed_at = datetime.utcnow()
        resolution.testing_complete = True

        # Store test results in files_changed (repurposed for test data)
        resolution.files_changed = test_results

        # Determine final state
        if passed_count == len(test_cases):
            resolution.resolution_state = "ready_for_pr"
            logger.info(f"All tests passed for issue resolution {resolution_id}")
        else:
            resolution.resolution_state = "testing_failed"
            resolution.error_message = f"{failed_count} tests failed out of {len(test_cases)}"
            logger.warning(f"{failed_count} tests failed for issue resolution {resolution_id}")

        self.db.add(resolution)
        await self.db.commit()

        return {
            "stage": "testing",
            "tests_generated": len(test_cases),
            "tests_passed": passed_count,
            "tests_failed": failed_count,
            "test_results": test_results,
            "ready_for_pr": passed_count == len(test_cases)
        }

    async def mark_deployment_complete(self, resolution_id: UUID) -> IssueResolution:
        """Mark deployment stage as complete and transition to planning"""
        resolution = await self.get_resolution_with_relations(resolution_id)

        if resolution.current_stage != "deployment":
            raise ValueError(f"Cannot complete deployment in stage {resolution.current_stage}")

        resolution.deployment_complete = True
        resolution.deployment_completed_at = datetime.utcnow()

        self.db.add(resolution)
        await self.db.commit()

        # Automatically trigger planning stage
        await self.trigger_planning_stage(resolution_id)

        return resolution

    async def retry_stage(self, resolution_id: UUID) -> Dict[str, Any]:
        """Retry the current stage if it failed"""
        resolution = await self.get_resolution_with_relations(resolution_id)

        resolution.retry_count += 1

        if resolution.current_stage == "planning":
            result = await self.trigger_planning_stage(resolution_id)
        elif resolution.current_stage == "implementation":
            # Re-trigger implementation with existing plan
            if not resolution.planning_approved:
                raise ValueError("Cannot retry implementation without approved plan")

            # Get the approver
            approver_id = resolution.planning_approval_by
            if not approver_id:
                # Use task creator as fallback
                task = await self.db.get(Task, resolution.task_id)
                approver_id = task.created_by

            result = await self.approve_plan_and_start_implementation(resolution_id, approver_id, session_id)
        elif resolution.current_stage == "testing":
            result = await self.complete_implementation_and_start_testing(resolution_id)
        else:
            raise ValueError(f"Cannot retry stage {resolution.current_stage}")

        self.db.add(resolution)
        await self.db.commit()

        return result

    async def get_stage_status(self, resolution_id: UUID) -> Dict[str, Any]:
        """Get detailed status of the current stage"""
        resolution = await self.get_resolution_with_relations(resolution_id)

        status = {
            "current_stage": resolution.current_stage,
            "resolution_state": resolution.resolution_state,
            "stages": {
                "deployment": {
                    "complete": resolution.deployment_complete,
                    "started_at": resolution.deployment_started_at.isoformat() if resolution.deployment_started_at else None,
                    "completed_at": resolution.deployment_completed_at.isoformat() if resolution.deployment_completed_at else None
                },
                "planning": {
                    "complete": resolution.planning_complete,
                    "approved": resolution.planning_approved,
                    "session_id": resolution.planning_session_id,
                    "chat_id": str(resolution.planning_chat_id) if resolution.planning_chat_id else None,
                    "started_at": resolution.planning_started_at.isoformat() if resolution.planning_started_at else None,
                    "completed_at": resolution.planning_completed_at.isoformat() if resolution.planning_completed_at else None,
                    "approved_by": str(resolution.planning_approval_by) if resolution.planning_approval_by else None,
                    "approved_at": resolution.planning_approval_at.isoformat() if resolution.planning_approval_at else None
                },
                "implementation": {
                    "complete": resolution.implementation_complete,
                    "session_id": resolution.implementation_session_id,
                    "chat_id": str(resolution.implementation_chat_id) if resolution.implementation_chat_id else None,
                    "started_at": resolution.implementation_started_at.isoformat() if resolution.implementation_started_at else None,
                    "completed_at": resolution.implementation_completed_at.isoformat() if resolution.implementation_completed_at else None
                },
                "testing": {
                    "complete": resolution.testing_complete,
                    "tests_generated": resolution.test_cases_generated,
                    "tests_passed": resolution.test_cases_passed,
                    "started_at": resolution.testing_started_at.isoformat() if resolution.testing_started_at else None,
                    "completed_at": resolution.testing_completed_at.isoformat() if resolution.testing_completed_at else None
                }
            },
            "can_transition": self._can_transition(resolution),
            "next_action": self._get_next_action(resolution),
            "retry_count": resolution.retry_count,
            "error_message": resolution.error_message
        }

        return status

    def _can_transition(self, resolution: IssueResolution) -> bool:
        """Check if resolution can transition to next stage"""
        if resolution.current_stage == "deployment":
            return resolution.deployment_complete
        elif resolution.current_stage == "planning":
            return resolution.planning_approved
        elif resolution.current_stage == "implementation":
            return resolution.implementation_complete
        elif resolution.current_stage == "testing":
            return resolution.testing_complete
        return False

    def _get_next_action(self, resolution: IssueResolution) -> str:
        """Get the next required action for the resolution"""
        if resolution.current_stage == "deployment":
            if resolution.deployment_complete:
                return "Start planning stage"
            return "Waiting for deployment to complete"
        elif resolution.current_stage == "planning":
            if resolution.planning_approved:
                return "Implementation in progress"
            elif resolution.planning_complete:
                return "Approve plan to start implementation"
            return "Planning in progress"
        elif resolution.current_stage == "implementation":
            if resolution.implementation_complete:
                return "Start testing"
            return "Implementation in progress"
        elif resolution.current_stage == "testing":
            if resolution.testing_complete:
                if resolution.test_cases_passed == resolution.test_cases_generated:
                    return "Ready to create pull request"
                else:
                    return "Fix failing tests and retry"
            return "Testing in progress"
        return "Unknown"


    async def start_deployment_stage(self, resolution_id: UUID) -> Dict[str, Any]:
        """
        Start the deployment stage of the workflow.
        Initializes the deployment environment with the issue-specific branch.
        """
        resolution = await self.get_resolution_with_relations(resolution_id)
        settings = get_settings()

        # Get related entities
        task = await self.db.get(Task, resolution.task_id)
        if not task:
            raise ValueError(f"Task {resolution.task_id} not found")

        project = await self.db.get(Project, resolution.project_id)
        if not project:
            raise ValueError(f"Project {resolution.project_id} not found")

        # Mark deployment as started
        resolution.deployment_started_at = datetime.utcnow()
        resolution.resolution_state = "initializing"
        task.deployment_status = "initializing"

        self.db.add(resolution)
        self.db.add(task)
        await self.db.commit()

        try:
            # Get user's GitHub token
            github_auth_service = GitHubAuthService(self.db)
            user_token = await github_auth_service.get_user_token(project.user_id)

            github_token = None
            if user_token:
                if isinstance(user_token, str):
                    github_token = user_token
                elif hasattr(user_token, 'access_token'):
                    github_token = user_token.access_token

            # Build GitHub URL with auth token
            github_repo_url = project.repo_url
            logger.info(f"github_repo_url: {github_repo_url}")
            if github_token and github_repo_url:
                if github_repo_url.startswith("https://github.com/"):
                    github_repo_url = github_repo_url.replace(
                        "https://github.com/",
                        f"https://{github_token}@github.com/"
                    )

            # Build project path as project_name/task_id
            project_path = f"{project.name}/{task.id}"

            # Webhook URL points to deployment webhook
            webhook_url = f"{settings.webhook_base_url}/api/webhooks/deployment/{task.id}"

            # Prepare init payload with issue branch
            init_payload = {
                "organization_name": settings.org_name,
                "project_name": project_path,
                "github_repo_url": github_repo_url,
                "webhook_url": webhook_url,
                "branch": resolution.resolution_branch,  # Use issue branch instead of default
            }
            logger.info(f"Init payload: {init_payload}")
            logger.info(f"Init URL: {settings.init_project_url}")

            # Add MCP servers if configured
            if task.mcp_servers:
                init_payload["mcp_servers"] = task.mcp_servers

            # Call init_project on external service
            async with httpx.AsyncClient() as client:
                init_response = await client.post(
                    settings.init_project_url,
                    json=init_payload,
                    timeout=60.0
                )
                init_response.raise_for_status()
                init_data = init_response.json()

                deployment_task_id = init_data.get("task_id")

                # Update task with deployment info
                task.deployment_status = "initializing"
                task.deployment_started_at = datetime.utcnow()
                task.deployment_request_id = deployment_task_id

                self.db.add(task)
                await self.db.commit()

                logger.info(f"Successfully initiated deployment for resolution {resolution_id}")
                return {
                    "stage": "deployment",
                    "status": "started",
                    "message": "Deployment stage initiated",
                    "deployment_task_id": deployment_task_id
                }

        except Exception as e:
            # Log error and update resolution
            logger.error(f"Failed to initialize issue environment: {e}")

            resolution.error_message = f"Failed to initialize: {str(e)}"
            resolution.resolution_state = "failed"
            task.deployment_status = "failed"

            self.db.add(resolution)
            self.db.add(task)
            await self.db.commit()

            raise ValueError(f"Failed to initialize deployment: {str(e)}")

    async def retry_current_stage(self, resolution_id: UUID) -> Dict[str, Any]:
        """Retry the current stage."""
        resolution = await self.get_resolution_with_relations(resolution_id)

        # Increment retry count
        resolution.retry_count += 1
        resolution.error_message = None

        # Reset the current stage flags
        if resolution.current_stage == "deployment":
            resolution.deployment_complete = False
            resolution.deployment_started_at = datetime.utcnow()
        elif resolution.current_stage == "planning":
            resolution.planning_complete = False
            resolution.planning_started_at = datetime.utcnow()
        elif resolution.current_stage == "implementation":
            resolution.implementation_complete = False
            resolution.implementation_started_at = datetime.utcnow()
        elif resolution.current_stage == "testing":
            resolution.testing_complete = False
            resolution.testing_started_at = datetime.utcnow()

        self.db.add(resolution)
        await self.db.commit()

        # Re-trigger the current stage
        if resolution.current_stage == "deployment":
            return await self.start_deployment_stage(resolution_id)
        elif resolution.current_stage == "planning":
            return await self.trigger_planning_stage(resolution_id)
        elif resolution.current_stage == "implementation":
            return {"message": "Implementation stage retry not yet implemented"}
        elif resolution.current_stage == "testing":
            return {"message": "Testing stage retry not yet implemented"}

        return {"message": "Stage retried"}
