"""
GitHub issue resolution workflow endpoints.
Manages the complete lifecycle of resolving GitHub issues through tasks.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Header
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import List, Optional, Tuple
from uuid import UUID, uuid4
from datetime import datetime
import httpx
import json
import re

from app.deps import get_session, get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.github_repository import GitHubRepository
from app.models.github_issue import GitHubIssue
from app.models.task import Task
from app.models.issue_resolution import IssueResolution
from app.models import Chat, SubProject
from app.services.github_auth_service import GitHubAuthService
from app.services.github_api_service import GitHubAPIService
from app.services.chat_service import chat_service
from app.services.issue_resolution_orchestrator import IssueResolutionOrchestrator
from app.core.settings import get_settings
from app.core.redis import get_redis
from app.core.rate_limiter import assert_within_rate_limit, RateLimitExceeded

settings = get_settings()
router = APIRouter(prefix="/projects", tags=["issue-resolution"])


async def get_user_id_from_header(x_user_id: str = Header(..., alias="X-User-ID")):
    """Validate X-User-ID header is provided."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide X-User-ID header."
        )
    return x_user_id


class GitHubIssueResponse(BaseModel):
    """Issue data from GitHub API."""
    number: int
    title: str
    body: Optional[str]
    state: str  # open, closed
    labels: List[str]
    html_url: str
    user: str  # Issue author
    created_at: str
    updated_at: str
    comments_count: int
    has_resolution_task: bool  # Whether a resolution task exists
    resolution_task_id: Optional[str]  # Task ID if resolution exists


class IssueListResponse(BaseModel):
    """Paginated issue list response."""
    issues: List[GitHubIssueResponse]
    total: int
    page: int
    per_page: int
    total_pages: Optional[int] = None
    has_next: bool = False
    has_prev: bool = False


class SolveIssueRequest(BaseModel):
    """Request to create resolution task for an issue."""
    issue_title: str
    issue_body: str
    task_name: Optional[str] = None  # Optional custom task name


class SolveIssueResponse(BaseModel):
    """Response after creating resolution task."""
    task_id: str
    resolution_id: str
    project_id: str
    message: str


class IssueResolutionStatusResponse(BaseModel):
    """Current status of issue resolution."""
    resolution_id: str
    task_id: str
    chat_id: Optional[str]
    session_id: Optional[str]
    issue_number: int
    issue_title: str
    issue_body: Optional[str]
    issue_labels: Optional[List[str]]
    resolution_state: str
    resolution_branch: Optional[str]
    auto_query_triggered: bool
    auto_query_session_id: Optional[str]
    auto_query_completed: bool
    solution_approach: Optional[str]
    files_changed: Optional[List[str]]
    test_cases_generated: int
    test_cases_passed: int
    pr_number: Optional[int]
    pr_url: Optional[str]
    pr_state: Optional[str]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class CreatePRRequest(BaseModel):
    """Request to create pull request for resolved issue."""
    title: Optional[str] = None
    body: Optional[str] = None
    branch: Optional[str] = None  # Optional branch name, if not set in resolution


class CreatePRResponse(BaseModel):
    """Response after creating pull request."""
    pr_number: int
    pr_url: str
    message: str


def _serialize_resolution_status(resolution: IssueResolution) -> IssueResolutionStatusResponse:
    """Convert an IssueResolution model into the API response payload."""
    primary_session_id = (
        resolution.planning_session_id
        or resolution.implementation_session_id
        or resolution.auto_query_session_id
    )

    return IssueResolutionStatusResponse(
        resolution_id=str(resolution.id),
        task_id=str(resolution.task_id),
        chat_id=str(resolution.chat_id) if resolution.chat_id else None,
        session_id=primary_session_id,
        issue_number=resolution.issue_number,
        issue_title=resolution.issue_title,
        issue_body=resolution.issue_body,
        issue_labels=resolution.issue_labels,
        resolution_state=resolution.resolution_state,
        resolution_branch=resolution.resolution_branch,
        auto_query_triggered=resolution.auto_query_triggered,
        auto_query_session_id=resolution.auto_query_session_id,
        auto_query_completed=resolution.auto_query_completed,
        solution_approach=resolution.solution_approach,
        files_changed=resolution.files_changed,
        test_cases_generated=resolution.test_cases_generated,
        test_cases_passed=resolution.test_cases_passed,
        pr_number=resolution.pr_number,
        pr_url=resolution.pr_url,
        pr_state=resolution.pr_state,
        error_message=resolution.error_message,
        started_at=resolution.started_at,
        completed_at=resolution.completed_at,
    )


def _extract_repo_info(project: Project) -> Tuple[str, str]:
    if project.github_owner and project.github_repo_name:
        return project.github_owner, project.github_repo_name

    if project.repo_url:
        match = re.search(r'github\.com[:/]([^/]+)/([^/.]+)', project.repo_url)
        if match:
            return match.group(1), match.group(2)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unable to determine GitHub repository for this project."
    )


async def _determine_base_branch(project: Project, session: AsyncSession, explicit_branch: Optional[str] = None) -> str:
    if explicit_branch:
        return explicit_branch

    if project.github_repository_id:
        repo = await session.get(GitHubRepository, project.github_repository_id)
        if repo and repo.default_branch:
            return repo.default_branch

    return "main"


@router.get("/{project_id}/issues", response_model=IssueListResponse)
async def list_project_issues(
    project_id: UUID,
    state: str = Query("open", regex="^(open|closed|all)$"),
    per_page: int = Query(30, ge=1, le=100),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Fetch GitHub issues for a project directly from GitHub API.

    Args:
        project_id: Project UUID
        state: Issue state filter (open, closed, all)
        per_page: Results per page
        page: Page number
        current_user: Authenticated user

    Returns:
        List of issues with resolution status
    """
    # Get project and verify ownership
    stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Parse owner and repo from repo_url if not set in project
    github_owner = project.github_owner
    github_repo_name = project.github_repo_name

    if not github_owner or not github_repo_name:
        # Parse from repo_url (supports github.com URLs)
        import re
        repo_url = project.repo_url
        # Match patterns like: github.com/owner/repo or github.com:owner/repo.git
        match = re.search(r'github\.com[:/]([^/]+)/([^/\.]+)', repo_url)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not parse GitHub repository from repo_url. Please ensure it's a valid GitHub URL."
            )
        github_owner = match.group(1)
        github_repo_name = match.group(2)

    # Get user's GitHub token
    auth_service = GitHubAuthService(session)
    token = await auth_service.get_user_token(current_user.id)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No GitHub token found. Please authenticate with GitHub."
        )

    # Fetch issues from GitHub API
    # Note: GitHub's issues API returns both issues and pull requests
    # We need to fetch more than requested and filter out PRs
    # to ensure we return the requested number of actual issues
    try:
        async with httpx.AsyncClient() as client:
            # Fetch with max per_page (100) to get more items for filtering
            github_per_page = 100
            response = await client.get(
                f"https://api.github.com/repos/{github_owner}/{github_repo_name}/issues",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                params={
                    "state": state,
                    "per_page": github_per_page,
                    "page": page,
                    "sort": "updated",
                    "direction": "desc"
                },
                timeout=30.0
            )
            response.raise_for_status()
            github_issues = response.json()

            # Parse pagination info from Link header
            link_header = response.headers.get("Link", "")
            total_pages = None
            has_next = False
            has_prev = False

            if link_header:
                # Parse Link header for pagination
                # Format: <url>; rel="next", <url>; rel="last"
                import re

                # Check for next page
                if 'rel="next"' in link_header:
                    has_next = True

                # Check for prev page
                if 'rel="prev"' in link_header:
                    has_prev = True

                # Extract last page number for total pages
                last_match = re.search(r'page=(\d+)>; rel="last"', link_header)
                if last_match:
                    total_pages = int(last_match.group(1))

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token expired. Please re-authenticate."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch issues from GitHub: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error communicating with GitHub: {str(e)}"
        )

    # Get existing resolution tasks for this project
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id
    )
    result = await session.execute(stmt)
    existing_resolutions = {res.issue_number: res for res in result.scalars().all()}

    # Transform to response format and filter out PRs
    all_issues = []
    for issue in github_issues:
        # Skip pull requests (they appear in issues API)
        if "pull_request" in issue:
            continue

        issue_number = issue["number"]
        resolution = existing_resolutions.get(issue_number)

        all_issues.append(GitHubIssueResponse(
            number=issue_number,
            title=issue["title"],
            body=issue.get("body"),
            state=issue["state"],
            labels=[label["name"] for label in issue.get("labels", [])],
            html_url=issue["html_url"],
            user=issue["user"]["login"],
            created_at=issue["created_at"],
            updated_at=issue["updated_at"],
            comments_count=issue.get("comments", 0),
            has_resolution_task=resolution is not None,
            resolution_task_id=str(resolution.task_id) if resolution else None
        ))

    # Only return the requested number of issues
    issues = all_issues[:per_page]

    # Determine if there are more pages
    # We have more if either:
    # 1. GitHub has more pages (has_next from Link header)
    # 2. We have more filtered issues than per_page
    has_more = has_next or len(all_issues) > per_page

    # Update pagination flags
    has_next = has_more
    has_prev = page > 1

    # Calculate total count
    # Since we can't know the exact total (PRs are mixed with issues),
    # we estimate based on available data
    total_count = len(issues)
    if has_next:
        # If there's a next page, we know there are more
        total_count = (page * per_page) + 1  # At least one more page

    # Note: total_pages is unreliable since GitHub counts both issues and PRs
    # So we set it to None unless we're sure
    if has_next:
        total_pages = None  # Unknown total pages

    return IssueListResponse(
        issues=issues,
        total=total_count,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        has_next=has_next,
        has_prev=has_prev
    )


@router.get("/{project_id}/issues/{issue_number}")
async def get_single_issue(
    project_id: UUID,
    issue_number: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get a single GitHub issue by number."""
    # Get project and verify ownership
    stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check if we have a resolution for this issue
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    # If we have a resolution, return issue details from it
    if resolution:
        return {
            "number": resolution.issue_number,
            "title": resolution.issue_title,
            "body": resolution.issue_body,
            "state": "open",
            "html_url": f"https://github.com/{project.github_owner}/{project.github_repo_name}/issues/{issue_number}",
            "created_at": resolution.created_at.isoformat() if resolution.created_at else None,
            "updated_at": resolution.updated_at.isoformat() if resolution.updated_at else None,
            "labels": resolution.issue_labels or [],
            "has_resolution": True,
            "resolution_state": resolution.resolution_state
        }

    # Otherwise return a basic issue object (for testing)
    return {
        "number": issue_number,
        "title": f"Issue #{issue_number}",
        "body": "",
        "state": "open",
        "html_url": f"https://github.com/{project.github_owner or 'test'}/{project.github_repo_name or 'repo'}/issues/{issue_number}",
        "labels": [],
        "has_resolution": False
    }


async def initialize_issue_environment(
    task_id: UUID,
    resolution_id: UUID,
    project_id: UUID,
    github_token: str
):
    """
    Initialize deployment environment for issue resolution with chat session.
    Creates the environment and then triggers the initial query through chat service.

    This is called as a background task after creating the resolution.
    """
    from app.core.settings import get_settings
    from app.deps import get_session
    import logging
    logger = logging.getLogger(__name__)
    settings = get_settings()

    # Create a new session for this background task
    async for session in get_session():
        try:
            # Load the objects fresh in this session
            task = await session.get(Task, task_id)
            resolution = await session.get(IssueResolution, resolution_id)
            project = await session.get(Project, project_id)

            if not task or not resolution or not project:
                logger.error(f"Could not load task, resolution, or project")
                return
            # Build GitHub URL with auth token
            github_repo_url = project.repo_url
            logger.info(f"github_repo_url: {github_repo_url}")
            if github_token and github_repo_url:
                if github_repo_url.startswith("https://github.com/"):
                    github_repo_url = github_repo_url.replace(
                        "https://github.com/",
                        f"https://{github_token}@github.com/"
                    )

            # Build project path as project_name/task_name
            project_path = f"{project.name}/{task.id}"

            # Webhook URL points to deployment webhook for now
            webhook_url = f"{settings.webhook_base_url}/api/webhooks/deployment/{task.id}/initialization"

            # Prepare init payload with issue branch
            init_payload = {
                "organization_name": settings.org_name,
                "project_name": project_path,
                "github_repo_url": github_repo_url,
                "webhook_url": webhook_url,
                "branch": resolution.resolution_branch,  # Use issue branch instead of default
                "generate_claude_md": False,
            }
            logger.info(f"Init payload: {init_payload}")
            logger.info(f"Init URL: {settings.init_project_url}")

            # Add MCP servers if configured
            if task.mcp_servers:
                init_payload["mcp_servers"] = task.mcp_servers

            redis_client = await get_redis()
            await assert_within_rate_limit(
                redis_client,
                user_id=project.user_id,
            )

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
                await session.commit()

        except Exception as e:
            # Log error and update resolution
            logger.error(f"Failed to initialize issue environment: {e}")

            resolution.error_message = f"Failed to initialize: {str(e)}"
            resolution.resolution_state = "failed"
            task.deployment_status = "failed"
            await session.commit()
        finally:
            # Close the session
            await session.close()


async def trigger_issue_resolution_query(
    task_id: UUID,
    resolution_id: UUID,
    project_id: UUID,
):
    """
    Mark deployment complete and trigger the planning stage.
    This should only be called AFTER initialization is complete.
    Creates its own database session to avoid session conflicts.
    """
    from app.deps import get_session
    import logging
    logger = logging.getLogger(__name__)
    # Create a new session for this background task
    async for session in get_session():
        try:
            # Load the objects fresh in this session
            task = await session.get(Task, task_id)
            resolution = await session.get(IssueResolution, resolution_id)
            project = await session.get(Project, project_id)

            if not task or not resolution or not project:
                logger.error(f"Could not load task, resolution, or project")
                return

            # Mark deployment as complete using the orchestrator
            orchestrator = IssueResolutionOrchestrator(session)

            # Mark deployment complete which automatically triggers planning stage
            await orchestrator.mark_deployment_complete(resolution_id)

            logger.info(f"Successfully marked deployment complete and triggered planning for resolution {resolution_id}")

            # The old approach is replaced - keeping comment for documentation
            # Previously this would create a detailed prompt and send it via chat_service
            # Now the orchestrator handles stage transitions and prompt generation

        except Exception as e:
            # Log error and update resolution
            logger.error(f"Failed to mark deployment complete and trigger planning: {e}")

            if resolution:
                resolution.error_message = f"Failed to start planning stage: {str(e)}"
                resolution.resolution_state = "failed"
                await session.commit()
        finally:
            # Close the session
            await session.close()



# Four-Stage Workflow Endpoints

class StageStatusResponse(BaseModel):
    """Current stage status of issue resolution."""
    current_stage: str
    resolution_state: str
    stages: dict
    can_transition: bool
    next_action: str
    retry_count: int
    error_message: Optional[str] = None


@router.post("/{project_id}/issues/{issue_number}/solve", response_model=SolveIssueResponse)
async def solve_issue(
    project_id: UUID,
    issue_number: int,
    payload: SolveIssueRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Create a resolution task for a GitHub issue.

    This endpoint fetches issue details from GitHub (or database) and creates
    a resolution task that will go through the four-stage workflow.

    If the user doesn't have write access to the repository, it will automatically
    create a fork and work on the forked repository instead.
    """
    # Get project and verify ownership
    stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check for existing resolution
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Return existing resolution
        return SolveIssueResponse(
            task_id=str(existing.task_id),
            resolution_id=str(existing.id),
            project_id=str(project_id),
            message=f"Resolution already exists for issue #{issue_number}"
        )

    # Parse owner and repo from project URL
    import re
    repo_url = project.repo_url
    match = re.search(r'github\.com[:/]([^/]+)/([^/\.]+)', repo_url)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse GitHub repository from repo_url"
        )

    github_owner = match.group(1)
    github_repo_name = match.group(2)

    # Check if user has write permissions to the repository
    github_api_service = GitHubAPIService(session, current_user.id)
    fork_created = False
    try:
        permissions = await github_api_service.check_user_permissions(github_owner, github_repo_name)
        has_push_access = permissions.get("push", False)

        # If user doesn't have push access, create or get fork
        if not has_push_access:
            # Get user's GitHub token for fork creation
            auth_service = GitHubAuthService(session)
            token = await auth_service.get_user_token(current_user.id)

            if not token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="GitHub authentication required to fork repository"
                )

            # Create or get fork
            fork_data = await github_api_service.get_or_create_fork(github_owner, github_repo_name)
            fork_owner = fork_data["owner"]["login"]
            fork_repo_name = fork_data["name"]
            fork_created = True

            # Check if fork project already exists for this user
            fork_repo_url = fork_data["clone_url"]
            stmt = select(Project).where(
                Project.user_id == current_user.id,
                Project.is_fork_project == True,
                Project.original_issue_repo_id == fork_data["parent"]["id"]
            )
            result = await session.execute(stmt)
            fork_project = result.scalar_one_or_none()

            if not fork_project:
                # Create new project for the fork
                fork_project = Project(
                    name=f"{fork_repo_name}-fork",
                    repo_url=fork_repo_url,
                    user_id=current_user.id,
                    github_repo_id=fork_data["id"],
                    github_owner=fork_owner,
                    github_repo_name=fork_repo_name,
                    is_private=fork_data.get("private", False),
                    is_fork_project=True,
                    original_issue_repo_id=fork_data["parent"]["id"]
                )
                session.add(fork_project)
                await session.flush()

            # Use fork project instead of original
            project = fork_project
            project_id = fork_project.id
            github_owner = fork_owner
            github_repo_name = fork_repo_name

            # Re-check for existing resolution in fork project
            stmt = select(IssueResolution).where(
                IssueResolution.project_id == project_id,
                IssueResolution.issue_number == issue_number
            )
            result = await session.execute(stmt)
            existing_in_fork = result.scalar_one_or_none()

            if existing_in_fork:
                # Return existing resolution from fork
                return SolveIssueResponse(
                    task_id=str(existing_in_fork.task_id),
                    resolution_id=str(existing_in_fork.id),
                    project_id=str(project_id),
                    message=f"Resolution already exists for issue #{issue_number} in forked repository"
                )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check repository permissions or create fork: {str(e)}"
        )

    redis_client = await get_redis()
    try:
        await assert_within_rate_limit(
            redis_client,
            user_id=current_user.id,
            consume=False,
        )
    except RateLimitExceeded as e:
        headers = {}
        if e.retry_after is not None and e.retry_after > 0:
            headers["Retry-After"] = str(e.retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
            headers=headers or None
        )

    issue_title = payload.issue_title
    issue_body = payload.issue_body

    # Create task
    task_name = f"issue-{issue_number}"
    task = Task(
        name=task_name,
        project_id=project_id,
        state="deployment",
        initial_description=f"Resolve issue #{issue_number}: {issue_title}",
        task_type="issue_resolution"
    )
    session.add(task)
    await session.flush()

    # Create resolution
    resolution = IssueResolution(
        task_id=task.id,
        project_id=project_id,
        issue_number=issue_number,
        issue_title=issue_title,
        issue_body=issue_body,
        resolution_state="deployment",
        current_stage="deployment",
        resolution_branch=f"fix/issue-{issue_number}",
        started_at=datetime.utcnow(),
        deployment_started_at=datetime.utcnow()
    )
    session.add(resolution)
    await session.commit()
    await session.refresh(resolution)

    # Trigger planning stage in background
    orchestrator = IssueResolutionOrchestrator(session)
    background_tasks.add_task(
        orchestrator.start_deployment_stage,
        resolution.id
    )

    message = "Issue resolution task created successfully"
    if fork_created:
        message = f"Forked repository to work on issue (no write access to original). {message}"

    return SolveIssueResponse(
        task_id=str(task.id),
        resolution_id=str(resolution.id),
        project_id=str(project_id),
        message=message
    )


@router.get("/{project_id}/tasks/{task_id}/resolution", response_model=IssueResolutionStatusResponse)
async def get_resolution_status_by_task(
    project_id: UUID,
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the issue resolution status for a given task."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this project",
        )

    task = await session.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.task_id == task_id,
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found",
        )

    return _serialize_resolution_status(resolution)


@router.get("/{project_id}/issues/{issue_number}/resolution")
async def get_issue_resolution(
    project_id: UUID,
    issue_number: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get the full resolution details for an issue."""
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found"
        )

    # Return resolution details
    return {
        "task_id": str(resolution.task_id),
        "resolution_id": str(resolution.id),
        "issue_number": resolution.issue_number,
        "issue_title": resolution.issue_title,
        "issue_body": resolution.issue_body,
        "resolution_state": resolution.resolution_state,
        "current_stage": resolution.current_stage,
        "resolution_branch": resolution.resolution_branch,
        "started_at": resolution.started_at.isoformat() if resolution.started_at else None,
        "deployment_complete": resolution.deployment_complete,
        "planning_complete": resolution.planning_complete,
        "planning_approved": resolution.planning_approved,
        "implementation_complete": resolution.implementation_complete,
        "testing_complete": resolution.testing_complete,
        "planning_session_id": resolution.planning_session_id,
        "planning_chat_id": str(resolution.planning_chat_id) if resolution.planning_chat_id else None,
        "implementation_session_id": resolution.implementation_session_id,
        "implementation_chat_id": str(resolution.implementation_chat_id) if resolution.implementation_chat_id else None,
        "pr_number": resolution.pr_number,
        "pr_url": resolution.pr_url,
        "pr_state": resolution.pr_state,
        "pr_created_at": resolution.pr_created_at.isoformat() if resolution.pr_created_at else None,
        "error_message": resolution.error_message
    }

@router.get("/{project_id}/issues/{issue_number}/resolution/stage-status", response_model=StageStatusResponse)
async def get_stage_status(
    project_id: UUID,
    issue_number: int,
    user_id: str = Depends(get_user_id_from_header),
    session: AsyncSession = Depends(get_session)
):
    """Get the current stage status of an issue resolution."""
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found"
        )

    # Build stage information
    stages = {
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
            "completed_at": resolution.planning_completed_at.isoformat() if resolution.planning_completed_at else None
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
        },
        "deploy": {
            "complete": resolution.deploy_complete,
            "session_id": resolution.deploy_session_id,
            "started_at": resolution.deploy_started_at.isoformat() if resolution.deploy_started_at else None,
            "completed_at": resolution.deploy_completed_at.isoformat() if resolution.deploy_completed_at else None
        },
        "pr": {
            "complete": bool(resolution.pr_number),
            "pr_number": resolution.pr_number,
            "pr_url": resolution.pr_url,
            "started_at": resolution.pr_created_at.isoformat() if resolution.pr_created_at else None,
            "completed_at": resolution.pr_created_at.isoformat() if resolution.pr_created_at else None
        }
    }

    # Determine next action
    next_action = ""
    can_transition = False

    if resolution.current_stage == "deployment" and not resolution.deployment_complete:
        next_action = "Waiting for environment setup to complete"
    elif resolution.current_stage == "planning" and not resolution.planning_complete:
        next_action = "Analyzing issue and creating implementation plan"
    elif resolution.current_stage == "planning" and resolution.planning_complete and not resolution.planning_approved:
        next_action = "Review the generated implementation plan and approve to proceed"
        can_transition = True
    elif resolution.current_stage == "implementation" and not resolution.implementation_complete:
        next_action = "Implementing the approved solution"
    elif resolution.current_stage == "testing" and not resolution.testing_complete:
        next_action = "Running automated tests"
    elif resolution.current_stage == "testing" and resolution.testing_complete:
        next_action = "Start application deployment"
        can_transition = True
    elif resolution.current_stage == "deploy":
        if resolution.deploy_complete and not resolution.pr_number:
            next_action = "Create a pull request"
            can_transition = True
        elif resolution.deploy_complete and resolution.pr_number:
            next_action = "Pull request created"
        else:
            next_action = "Deploying application"
    elif resolution.current_stage == "pr":
        if resolution.pr_number:
            next_action = "Pull request created"
        else:
            next_action = "Create a pull request"
    elif resolution.deploy_complete and resolution.pr_number:
        next_action = "Resolution workflow complete"

    return StageStatusResponse(
        current_stage=resolution.current_stage,
        resolution_state=resolution.resolution_state,
        stages=stages,
        can_transition=can_transition,
        next_action=next_action,
        retry_count=resolution.retry_count,
        error_message=resolution.error_message
    )


class ApprovePlanRequest(BaseModel):
    """Request to approve planning stage."""
    notes: Optional[str] = None
    session_id: str


@router.post("/{project_id}/issues/{issue_number}/resolution/approve-plan")
async def approve_plan(
    project_id: UUID,
    issue_number: int,
    payload: ApprovePlanRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Approve the planning stage and start implementation."""
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found"
        )

    if resolution.current_stage != "planning" or not resolution.planning_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning stage is not ready for approval"
        )

    # Approve and trigger implementation
    orchestrator = IssueResolutionOrchestrator(session)
    await orchestrator.approve_plan_and_start_implementation(
        resolution.id,
        current_user.id,
        payload.session_id,
        payload.notes
    )

    return {"message": "Plan approved, implementation started"}


@router.post("/{project_id}/issues/{issue_number}/resolution/retry-stage")
async def retry_stage(
    project_id: UUID,
    issue_number: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Retry the current stage if it failed."""
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found"
        )

    orchestrator = IssueResolutionOrchestrator(session)
    result = await orchestrator.retry_current_stage(resolution.id)

    return {"message": "Stage retry initiated", "result": result}


@router.post("/{project_id}/issues/{issue_number}/resolution/trigger-planning")
async def trigger_planning(
    project_id: UUID,
    issue_number: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Trigger the planning stage for an issue resolution."""
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found"
        )

    # Update resolution state to planning if not already
    if resolution.current_stage != "planning":
        resolution.current_stage = "planning"
        resolution.resolution_state = "analyzing"
        session.add(resolution)
        await session.commit()

    # Trigger planning stage in background
    orchestrator = IssueResolutionOrchestrator(session)
    background_tasks.add_task(
        orchestrator.trigger_planning_stage,
        resolution.id
    )

    return {
        "message": "Planning stage triggered successfully",
        "resolution_id": str(resolution.id),
        "current_stage": resolution.current_stage
    }


@router.post("/{project_id}/issues/{issue_number}/resolution/trigger-deploy")
async def trigger_deploy(
    project_id: UUID,
    issue_number: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Trigger the deploy stage for an issue resolution."""
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolution not found"
        )

    if resolution.current_stage not in {"implementation", "testing", "deploy"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot trigger deploy from stage {resolution.current_stage}. Must be in implementation or testing stage."
        )

    # Trigger deploy stage in background
    orchestrator = IssueResolutionOrchestrator(session)
    background_tasks.add_task(
        orchestrator.trigger_deploy_stage,
        resolution.id
    )

    return {
        "message": "Deploy stage triggered successfully",
        "resolution_id": str(resolution.id),
        "current_stage": "deploy"
    }


@router.post("/{project_id}/issues/{issue_number}/resolution/create-pr", response_model=CreatePRResponse)
async def create_pull_request_endpoint(
    project_id: UUID,
    issue_number: int,
    payload: CreatePRRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Create a pull request for the resolved issue."""

    # Load project and ensure ownership
    stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Load resolution
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resolution not found")

    # Ensure prerequisites met (deployment + planning approval + implementation complete)
    if not (
        resolution.deployment_complete and
        resolution.planning_approved and
        resolution.implementation_complete
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete deployment, planning approval, and implementation before creating a PR."
        )

    if not resolution.resolution_branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resolution branch not available for pull request."
        )

    owner, repo_name = _extract_repo_info(project)
    base_branch = await _determine_base_branch(project, session, payload.branch)
    title = payload.title or f"Fix issue #{issue_number}: {resolution.issue_title}"
    body_lines = [payload.body] if payload.body else []
    if not body_lines:
        body_lines = [
            f"Resolves #{issue_number}",
            "",
            "This pull request was generated from the automated issue-resolution workflow.",
        ]
    body = "\n".join(filter(None, body_lines))

    github_service = GitHubAPIService(session, current_user.id)
    try:
        pr_data = await github_service.create_pull_request(
            owner=owner,
            repo=repo_name,
            title=title,
            body=body,
            head=resolution.resolution_branch,
            base=base_branch,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail)

    resolution.pr_number = pr_data.get("number")
    resolution.pr_url = pr_data.get("html_url")
    resolution.pr_state = pr_data.get("state")
    resolution.pr_created_at = datetime.utcnow()
    resolution.current_stage = "pr"
    resolution.resolution_state = "pr_created"
    session.add(resolution)
    await session.commit()

    return CreatePRResponse(
        pr_number=resolution.pr_number,
        pr_url=resolution.pr_url,
        message="Pull request created successfully",
    )
