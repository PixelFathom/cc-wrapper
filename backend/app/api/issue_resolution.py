"""
GitHub issue resolution workflow endpoints.
Manages the complete lifecycle of resolving GitHub issues through tasks.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
import httpx
import json

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
from app.core.settings import get_settings

settings = get_settings()
router = APIRouter(prefix="/projects", tags=["issue-resolution"])


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
    Trigger the initial query to start solving the issue using chat service.
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

            # Use the existing chat that was created in solve_github_issue
            if not resolution.chat_id:
                logger.error(f"Resolution {resolution.id} has no chat_id")
                raise ValueError("Resolution must have an associated chat")

            # Load the existing chat
            initial_chat = await session.get(Chat, resolution.chat_id)
            if not initial_chat:
                logger.error(f"Could not load chat {resolution.chat_id}")
                raise ValueError("Could not load chat for resolution")
            # Generate issue resolution prompt
            labels_str = ", ".join(resolution.issue_labels) if resolution.issue_labels else "None"

            # Get github owner and repo name, parsing from URL if needed
            github_owner = project.github_owner
            github_repo_name = project.github_repo_name

            if not github_owner or not github_repo_name:
                import re
                github_match = re.search(r'github\.com[:/]([^/]+)/([^/\s]+?)(?:\.git)?$', project.repo_url)
                if github_match:
                    github_owner = github_match.group(1)
                    github_repo_name = github_match.group(2).replace('.git', '')
                else:
                    github_owner = "unknown"
                    github_repo_name = "repository"

            detailed_prompt = f"""# GitHub Issue Resolution Task

## Repository Context
- **Repository**: {github_owner}/{github_repo_name}
- **Issue**: #{resolution.issue_number} - {resolution.issue_title}
- **Labels**: {labels_str}
- **Working Branch**: `{resolution.resolution_branch}`

## Issue Description
{resolution.issue_body or "No description provided."}

---

## Universal Coding Standards & Best Practices

### 1. **Code Architecture Principles**
- **Separation of Concerns**: Keep different aspects of functionality separate and modular
- **DRY (Don't Repeat Yourself)**: Avoid code duplication; extract common logic into reusable functions/modules
- **SOLID Principles**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
- **Clean Code**: Write code that is self-documenting with meaningful names and clear intent
- **Modularity**: Break down complex problems into smaller, manageable components

### 2. **Code Quality Standards**

#### **Naming Conventions**
- Use descriptive, meaningful names for variables, functions, and classes
- Be consistent with naming patterns throughout the codebase
- Avoid abbreviations and single-letter variables (except for loop counters)
- Use intention-revealing names that explain the "why" not just the "what"

#### **Function/Method Design**
- Keep functions small and focused on a single task
- Limit function parameters (ideally 3 or fewer)
- Functions should either do something or return something, not both
- Use pure functions when possible (no side effects)
- Document complex logic with clear comments

#### **Error Handling**
- Handle errors gracefully and predictably
- Provide meaningful error messages
- Use appropriate error types/codes
- Log errors appropriately for debugging
- Never silently swallow errors
- Fail fast and fail clearly

#### **Input Validation**
- Validate all external inputs
- Sanitize user inputs to prevent injection attacks
- Use strong typing where available
- Define clear contracts for function inputs/outputs
- Handle edge cases and boundary conditions

### 3. **Performance Considerations**
- **Efficiency**: Use appropriate data structures and algorithms
- **Resource Management**: Properly manage memory, connections, and file handles
- **Caching**: Implement caching where appropriate to avoid redundant operations
- **Lazy Loading**: Load resources only when needed
- **Optimization**: Profile before optimizing; avoid premature optimization

### 4. **Security Best Practices**
- Never hardcode secrets, passwords, or API keys
- Use environment variables for configuration
- Implement proper authentication and authorization
- Protect against common vulnerabilities (SQL injection, XSS, CSRF, etc.)
- Keep dependencies updated and audit for vulnerabilities
- Follow the principle of least privilege
- Validate and sanitize all inputs

### 5. **Testing Philosophy**
- **Test Coverage**: Aim for comprehensive test coverage of critical paths
- **Test Types**: Include unit tests, integration tests, and end-to-end tests
- **Edge Cases**: Test boundary conditions and error scenarios
- **Regression Testing**: Ensure fixes don't break existing functionality
- **Test Independence**: Tests should not depend on each other
- **Clear Assertions**: Each test should have clear, specific assertions

### 6. **Documentation Standards**
- Write self-documenting code with clear naming
- Add comments for complex logic or business rules
- Document public APIs and interfaces
- Keep README files updated
- Document architectural decisions
- Include examples where helpful

### 7. **Version Control Best Practices**

#### **Commit Standards**
- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Use present tense imperative mood ("Add feature" not "Added feature")
- Include the "why" not just the "what" when necessary
- Reference issue numbers when applicable

#### **Branch Management**
- Use meaningful branch names
- Keep branches focused and short-lived
- Regular merging/rebasing to avoid conflicts
- Delete branches after merging

### 8. **Code Review Principles**
- Review for correctness, maintainability, and adherence to standards
- Consider performance implications
- Check for security vulnerabilities
- Ensure adequate test coverage
- Verify documentation is updated

---

## Your Task: Resolve the GitHub Issue

### Phase 1: Analysis & Understanding
**Before writing any code:**

1. **Thoroughly Analyze the Issue**
   - Read and understand the issue description completely
   - Identify the core problem and its symptoms
   - Determine the scope and impact of the issue
   - Consider any mentioned constraints or requirements

2. **Investigate the Codebase**
   - Locate all relevant files and components
   - Understand the current implementation
   - Trace the data/control flow
   - Identify dependencies and potential side effects

3. **Root Cause Analysis**
   - Determine the underlying cause, not just symptoms
   - Understand why the issue occurs
   - Consider all edge cases and scenarios
   - Identify related areas that might be affected

4. **Solution Planning**
   - Design a clean, maintainable solution
   - Consider multiple approaches and trade-offs
   - Plan for backward compatibility if needed
   - Identify risks and mitigation strategies

### Phase 2: Implementation Strategy

1. **Code Changes**
   - Follow existing code patterns and conventions
   - Maintain consistency with the codebase style
   - Keep changes minimal and focused
   - Refactor only when necessary for the fix
   - Add appropriate error handling

2. **Quality Assurance**
   - Write/update tests for your changes
   - Ensure existing tests still pass
   - Test edge cases and error scenarios
   - Verify performance impact
   - Check for security implications

3. **Documentation Updates**
   - Update code comments if logic changes
   - Update API documentation if interfaces change
   - Add inline comments for complex logic
   - Update configuration examples if needed

### Phase 3: Validation

**Testing Checklist:**
- [ ] Happy path works correctly
- [ ] Error cases handled gracefully
- [ ] Edge cases considered
- [ ] No regression in existing features
- [ ] Performance acceptable
- [ ] Security implications reviewed

**Code Quality Checklist:**
- [ ] Follows existing patterns
- [ ] No code duplication
- [ ] Clear variable/function names
- [ ] Appropriate comments added
- [ ] No debugging code left
- [ ] Dependencies properly managed

### Phase 4: Completion

1. **Final Review**
   - Self-review all changes
   - Ensure issue is fully resolved
   - Verify all tests pass
   - Check for any missed requirements

2. **Commit & Push**
   - Create clear, atomic commits
   - Write descriptive commit messages
   - Reference the issue number
   - Push to appropriate branch

---

## Important Guidelines

### ⚠️ Critical Reminders
- **Understand before implementing**: Never start coding without fully understanding the problem
- **Maintain consistency**: Follow existing patterns and conventions in the codebase
- **Think about impact**: Consider how your changes affect other parts of the system
- **Test thoroughly**: Ensure your fix works and doesn't break anything else
- **Keep it simple**: Choose the simplest solution that fully addresses the problem

### 🎯 Success Criteria
Your solution will be considered complete when:
1. The issue is fully resolved
2. All tests pass (existing and new)
3. Code follows project standards
4. No new issues are introduced
5. Solution is maintainable and clear

### 📋 Pre-Implementation Checklist
Before you start coding, ensure you can answer:
- [ ] What is the exact problem?
- [ ] Why does it occur?
- [ ] What is the minimal fix needed?
- [ ] What could break with this change?
- [ ] How will you test the solution?

---

## Start Resolution Process

Begin by analyzing the issue and presenting a clear plan:

1. **Problem Statement**: Summarize your understanding of the issue
2. **Root Cause**: Explain why the issue occurs
3. **Proposed Solution**: Describe your approach to fix it
4. **Implementation Plan**: List the steps you'll take
5. **Testing Strategy**: Explain how you'll validate the fix
6. **Risk Assessment**: Identify potential impacts or concerns

After your plan is reviewed and approved, proceed with the implementation following all the best practices outlined above.

Remember: Good code is not just code that works, but code that is maintainable, secure, efficient, and clear to others who will work with it in the future.
"""

            # Update the initial chat with the prompt
            initial_chat.content = {"text": detailed_prompt}
            session.add(initial_chat)
            await session.commit()
            await session.refresh(initial_chat)

            # Use chat service to send the query with bypass mode enabled
            # Use the existing session_id to maintain continuity
            result = await chat_service.send_query(
                session,
                initial_chat.id,
                detailed_prompt,
                bypass_mode=True,  # Always use bypass mode for issue resolution
                agent_name=None,
                include_task_id=False
            )

            # Update resolution status
            resolution.auto_query_triggered = True
            resolution.resolution_state = "analyzing"
            resolution.analyzing_started_at = datetime.utcnow()

            # Session ID should remain the same, but update if chat service returned a different one
            if result.get("session_id") and result.get("session_id") != issue_session_id:
                logger.warning(f"Chat service returned different session_id: {result.get('session_id')} vs {issue_session_id}")
                resolution.auto_query_session_id = result.get("session_id")

            await session.commit()

            logger.info(f"Triggered issue resolution query for task {task.id}")

        except Exception as e:
            # Log error and update resolution
            logger.error(f"Failed to trigger issue resolution query: {e}")

            resolution.error_message = f"Failed to start resolution: {str(e)}"
            resolution.resolution_state = "failed"
            await session.commit()
        finally:
            # Close the session
            await session.close()


@router.post("/{project_id}/issues/{issue_number}/solve", response_model=SolveIssueResponse)
async def solve_github_issue(
    project_id: UUID,
    issue_number: int,
    payload: SolveIssueRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Create a resolution task for a GitHub issue and auto-trigger query.

    Args:
        project_id: Project UUID
        issue_number: GitHub issue number
        payload: Request with optional task name
        background_tasks: FastAPI background tasks
        current_user: Authenticated user

    Returns:
        Task and resolution IDs
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

    # Ensure we have GitHub owner and repo name
    github_owner = project.github_owner
    github_repo_name = project.github_repo_name

    # If not set, try to parse from repo_url
    if not github_owner or not github_repo_name:
        import re
        repo_url = project.repo_url

        # Match patterns like: github.com/owner/repo or github.com:owner/repo.git
        github_match = re.search(r'github\.com[:/]([^/]+)/([^/\s]+?)(?:\.git)?$', repo_url)
        if github_match:
            github_owner = github_match.group(1)
            github_repo_name = github_match.group(2).replace('.git', '')

            # Update the project with parsed values
            project.github_owner = github_owner
            project.github_repo_name = github_repo_name
            session.add(project)
            await session.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine GitHub repository from project. Please ensure the project is linked to a valid GitHub repository."
            )

    # Get user's GitHub token
    auth_service = GitHubAuthService(session)
    token = await auth_service.get_user_token(current_user.id)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No GitHub token found. Please authenticate with GitHub."
        )

    # Initialize GitHub API service
    github_api = GitHubAPIService(session, current_user.id)

    # Check user permissions on the original repository
    permissions = await github_api.check_user_permissions(
        github_owner,
        github_repo_name
    )

    # Determine if we need to use a fork
    use_fork = not permissions["push"]
    fork_data = None
    fork_project = None

    if use_fork:
        # Get or create fork for the repository
        try:
            fork_data = await github_api.get_or_create_fork(
                github_owner,
                github_repo_name
            )

            # Sync fork data to our database
            await github_api._sync_repositories_to_db([fork_data])

            # Check if we already have a project for this fork
            stmt = select(Project).where(
                Project.user_id == current_user.id,
                Project.github_repo_id == fork_data["id"]
            )
            result = await session.execute(stmt)
            fork_project = result.scalar_one_or_none()

            if not fork_project:
                # Create a new project for the fork
                fork_project = Project(
                    name=f"{fork_data['name']}-fork",
                    repo_url=fork_data["clone_url"],
                    user_id=current_user.id,
                    github_repo_id=fork_data["id"],
                    github_owner=fork_data["owner"]["login"],
                    github_repo_name=fork_data["name"],
                    is_private=fork_data["private"],
                    is_fork_project=True,
                    original_issue_repo_id=project.github_repo_id  # Link to original repo
                )
                session.add(fork_project)
                await session.flush()

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create or access fork: {str(e)}"
            )

    # Fetch issue details from GitHub
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{github_owner}/{github_repo_name}/issues/{issue_number}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=30.0
            )
            response.raise_for_status()
            issue_data = response.json()

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issue #{issue_number} not found"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch issue from GitHub: {str(e)}"
        )

    # Check if resolution already exists
    stmt = select(IssueResolution).where(
        IssueResolution.project_id == project_id,
        IssueResolution.issue_number == issue_number
    )
    result = await session.execute(stmt)
    existing_resolution = result.scalar_one_or_none()

    if existing_resolution:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resolution task already exists for issue #{issue_number}. Task ID: {existing_resolution.task_id}"
        )

    # Get or create GitHubRepository for this project
    github_repo = None
    if project.github_repository_id:
        stmt = select(GitHubRepository).where(GitHubRepository.id == project.github_repository_id)
        result = await session.execute(stmt)
        github_repo = result.scalar_one_or_none()

    if not github_repo:
        # Check if GitHubRepository already exists by github_repo_id or owner/name
        stmt = select(GitHubRepository).where(
            (GitHubRepository.github_repo_id == project.github_repo_id) |
            ((GitHubRepository.owner == github_owner) & (GitHubRepository.name == github_repo_name))
        )
        result = await session.execute(stmt)
        github_repo = result.scalar_one_or_none()

    if not github_repo:
        # Fetch repository data from GitHub if not cached
        try:
            async with httpx.AsyncClient() as client:
                repo_response = await client.get(
                    f"https://api.github.com/repos/{github_owner}/{github_repo_name}",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                    timeout=30.0
                )
                repo_response.raise_for_status()
                repo_data = repo_response.json()
        except httpx.HTTPStatusError:
            # If can't fetch repo data, create minimal record
            repo_data = {
                "id": project.github_repo_id or 0,
                "owner": {"login": github_owner},
                "name": github_repo_name,
                "full_name": f"{github_owner}/{github_repo_name}",
                "html_url": f"https://github.com/{github_owner}/{github_repo_name}",
                "clone_url": project.repo_url,
                "ssh_url": project.repo_url,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "private": project.is_private
            }

        # Create GitHubRepository record
        github_repo = GitHubRepository(
            user_id=current_user.id,
            github_repo_id=repo_data["id"],
            owner=repo_data["owner"]["login"],
            name=repo_data["name"],
            full_name=repo_data["full_name"],
            html_url=repo_data["html_url"],
            clone_url=repo_data.get("clone_url", project.repo_url),
            ssh_url=repo_data.get("ssh_url", project.repo_url),
            is_private=repo_data.get("private", False),
            github_created_at=datetime.fromisoformat(repo_data["created_at"].replace('Z', '+00:00')).replace(tzinfo=None),
            github_updated_at=datetime.fromisoformat(repo_data["updated_at"].replace('Z', '+00:00')).replace(tzinfo=None),
            description=repo_data.get("description"),
            stars_count=repo_data.get("stargazers_count", 0),
            forks_count=repo_data.get("forks_count", 0),
            open_issues_count=repo_data.get("open_issues_count", 0),
            watchers_count=repo_data.get("watchers_count", 0),
            language=repo_data.get("language"),
            default_branch=repo_data.get("default_branch", "main"),
            last_synced_at=datetime.utcnow()
        )
        session.add(github_repo)
        await session.flush()

    # Link repository to project if not already linked
    if not project.github_repository_id:
        project.github_repository_id = github_repo.id
        session.add(project)
        await session.flush()

    # Get or create GitHubIssue record
    stmt = select(GitHubIssue).where(
        GitHubIssue.repository_id == github_repo.id,
        GitHubIssue.github_issue_number == issue_number
    )
    result = await session.execute(stmt)
    github_issue = result.scalar_one_or_none()

    if not github_issue:
        # Create new GitHubIssue record
        github_issue = GitHubIssue(
            repository_id=github_repo.id,
            github_issue_id=issue_data["id"],
            github_issue_number=issue_number,
            title=issue_data["title"],
            body=issue_data.get("body"),
            state=issue_data["state"],
            labels=[label["name"] for label in issue_data.get("labels", [])],
            author_login=issue_data["user"]["login"],
            author_avatar_url=issue_data["user"].get("avatar_url"),
            assignees=[assignee["login"] for assignee in issue_data.get("assignees", [])],
            comments_count=issue_data.get("comments", 0),
            html_url=issue_data["html_url"],
            github_created_at=datetime.fromisoformat(issue_data["created_at"].replace('Z', '+00:00')).replace(tzinfo=None),
            github_updated_at=datetime.fromisoformat(issue_data["updated_at"].replace('Z', '+00:00')).replace(tzinfo=None),
            last_synced_at=datetime.utcnow()
        )
        session.add(github_issue)
        await session.flush()

    github_issue_id = github_issue.id

    # Determine which project to use for the task
    # If using fork, create task under fork project, but still track original issue
    working_project_id = fork_project.id if use_fork and fork_project else project_id
    working_project = fork_project if use_fork and fork_project else project

    # Create task with improved naming: issue-{number}
    task_name = payload.task_name or f"issue-{issue_number}"
    task = Task(
        name=task_name,
        project_id=working_project_id,  # Use fork project if applicable
        state="pending",
        initial_description=f"Resolve GitHub issue #{issue_number}: {issue_data['title']} (from {github_owner}/{github_repo_name})",
        task_type="issue_resolution"  # Mark as issue resolution task
    )
    session.add(task)
    await session.flush()

    # Create sub_project for this task
    from uuid import uuid4
    sub_project = SubProject(task_id=task.id)
    session.add(sub_project)
    await session.flush()

    # Create initial chat session
    issue_session_id = str(uuid4())
    initial_chat = Chat(
        sub_project_id=sub_project.id,
        session_id=issue_session_id,
        role="user",
        content={"text": "Initializing issue resolution..."}
    )
    session.add(initial_chat)
    await session.flush()

    # Generate branch name for this issue
    issue_branch = f"fix/issue-{issue_number}"

    # Create issue resolution record
    # Always store the original project_id for the issue, even if working on fork
    resolution = IssueResolution(
        task_id=task.id,
        project_id=project_id,  # Original project ID where issue exists
        github_issue_id=github_issue_id,
        chat_id=initial_chat.id,  # Link to the chat session
        issue_number=issue_number,
        issue_title=issue_data["title"],
        issue_body=issue_data.get("body"),
        issue_labels=[label["name"] for label in issue_data.get("labels", [])],
        resolution_state="initializing",
        resolution_branch=issue_branch,
        started_at=datetime.utcnow(),
        auto_query_session_id=issue_session_id  # Store the session ID
    )
    session.add(resolution)
    await session.commit()
    await session.refresh(task)
    await session.refresh(resolution)
    await session.refresh(initial_chat)
    await session.refresh(sub_project)

    # Trigger initialization in background with chat session
    # Pass IDs instead of objects to avoid session issues
    # Use working_project (fork if applicable) for initialization
    background_tasks.add_task(
        initialize_issue_environment,
        task.id,
        resolution.id,
        working_project.id,  # Use working project (fork or original)
        token
    )

    fork_message = f" Using forked repository: {working_project.github_owner}/{working_project.github_repo_name}" if use_fork else ""
    return SolveIssueResponse(
        task_id=str(task.id),
        resolution_id=str(resolution.id),
        project_id=str(working_project_id),
        message=f"Created resolution task for issue #{issue_number}.{fork_message} Initializing environment..."
    )


@router.post("/{project_id}/tasks/{task_id}/resolution/chat")
async def send_issue_chat_message(
    project_id: UUID,
    task_id: UUID,
    payload: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Send a chat message for issue resolution using the chat service.
    This endpoint allows continuing the conversation for an issue resolution task.

    Args:
        project_id: Project UUID
        task_id: Task UUID
        payload: {"message": "user message"}
        current_user: Authenticated user

    Returns:
        Query response with session details
    """
    import logging
    logger = logging.getLogger(__name__)

    # First verify the task belongs to the project and user has access
    task_stmt = select(Task).join(Project).where(
        Task.id == task_id,
        Task.project_id == project_id,
        Project.user_id == current_user.id
    )
    task_result = await session.execute(task_stmt)
    task = task_result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or access denied"
        )

    # Get resolution by task_id (resolution might reference original project, not fork)
    stmt = select(IssueResolution).where(
        IssueResolution.task_id == task_id
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue resolution not found"
        )

    if not resolution.chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No chat session found for this issue resolution"
        )

    # Get message from payload
    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required"
        )

    # Get the chat to find sub_project
    chat = await session.get(Chat, resolution.chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )

    try:
        # Create a new user message in the chat
        user_chat = Chat(
            sub_project_id=chat.sub_project_id,
            session_id=resolution.auto_query_session_id,  # Use the same session ID
            role="user",
            content={"text": message}
        )
        session.add(user_chat)
        await session.commit()
        await session.refresh(user_chat)

        # Use chat service to send the query with bypass mode enabled
        result = await chat_service.send_query(
            session,
            user_chat.id,
            message,
            session_id=resolution.auto_query_session_id,  # Continue same session
            bypass_mode=True,  # Always use bypass mode for issue resolution
            agent_name=None
        )

        logger.info(f"Sent follow-up message for issue resolution task {task_id}")

        return {
            "success": True,
            "session_id": result.get("session_id"),
            "chat_id": str(user_chat.id),
            "assistant_chat_id": result.get("assistant_chat_id"),
            "message": "Message sent successfully"
        }

    except Exception as e:
        logger.error(f"Failed to send issue chat message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}"
        )


@router.get("/{project_id}/tasks/{task_id}/resolution", response_model=IssueResolutionStatusResponse)
async def get_issue_resolution_status(
    project_id: UUID,
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get the current status of an issue resolution.

    Args:
        project_id: Project UUID
        task_id: Task UUID
        current_user: Authenticated user

    Returns:
        Resolution status details
    """
    # First verify the task belongs to the project and user has access
    task_stmt = select(Task).join(Project).where(
        Task.id == task_id,
        Task.project_id == project_id,
        Project.user_id == current_user.id
    )
    task_result = await session.execute(task_stmt)
    task = task_result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or access denied"
        )

    # Get resolution by task_id (resolution might reference original project, not fork)
    stmt = select(IssueResolution).where(
        IssueResolution.task_id == task_id
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue resolution not found"
        )

    return IssueResolutionStatusResponse(
        resolution_id=str(resolution.id),
        task_id=str(resolution.task_id),
        chat_id=str(resolution.chat_id) if hasattr(resolution, 'chat_id') and resolution.chat_id else None,
        session_id=resolution.auto_query_session_id,
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
        completed_at=resolution.completed_at
    )


@router.post("/{project_id}/tasks/{task_id}/resolution/create-pr", response_model=CreatePRResponse)
async def create_pull_request(
    project_id: UUID,
    task_id: UUID,
    payload: CreatePRRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Create a pull request for the resolved issue.

    Args:
        project_id: Project UUID
        task_id: Task UUID
        payload: PR title, body, and optional branch
        current_user: Authenticated user

    Returns:
        Created PR details
    """
    # First verify the task belongs to the project and user has access
    task_stmt = select(Task).join(Project).where(
        Task.id == task_id,
        Task.project_id == project_id,
        Project.user_id == current_user.id
    )
    task_result = await session.execute(task_stmt)
    task = task_result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or access denied"
        )

    # Get resolution by task_id (resolution might reference original project, not fork)
    stmt = select(IssueResolution).where(
        IssueResolution.task_id == task_id
    )
    result = await session.execute(stmt)
    resolution = result.scalar_one_or_none()

    if not resolution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue resolution not found"
        )

    # Check if PR already created
    if resolution.pr_number:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pull request already created: #{resolution.pr_number}"
        )

    # Get the working project where the task lives (could be a fork)
    working_project = await session.get(Project, task.project_id)

    # Get the original project (from resolution's project_id)
    original_project = await session.get(Project, resolution.project_id)

    if not working_project or not original_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project configuration error"
        )

    # Determine if we're working with a fork
    is_fork = working_project.is_fork_project

    # Get user's GitHub token
    auth_service = GitHubAuthService(session)
    token = await auth_service.get_user_token(current_user.id)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No GitHub token found. Please authenticate with GitHub."
        )

    # Get branch from payload or resolution
    branch = payload.branch or resolution.resolution_branch
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No branch specified. Please provide a branch name or ensure the issue has been resolved on a branch first."
        )

    # Get GitHub repository to get default branch
    stmt = select(GitHubRepository).where(GitHubRepository.id == original_project.github_repository_id)
    result = await session.execute(stmt)
    github_repo = result.scalar_one_or_none()

    # Determine PR target repository and head format
    if is_fork:
        # For forks, we create PR to the original repository
        pr_target_owner = original_project.github_owner
        pr_target_repo = original_project.github_repo_name
        # Head branch format for cross-repo PR: "username:branch-name"
        pr_head = f"{working_project.github_owner}:{branch}"
    else:
        # For direct contributions, PR within the same repository
        pr_target_owner = working_project.github_owner
        pr_target_repo = working_project.github_repo_name
        # Head branch format for same-repo PR: "branch-name"
        pr_head = branch

    # Create PR via GitHub API
    pr_title = payload.title or f"Fix: Resolve issue #{resolution.issue_number}"
    pr_body = payload.body or f"""
## Description
This PR resolves #{resolution.issue_number}

## Changes
{resolution.solution_approach or 'Automated resolution by Claude Code'}

## Test Cases
- Generated: {resolution.test_cases_generated}
- Passed: {resolution.test_cases_passed}

Closes #{resolution.issue_number}
"""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.github.com/repos/{pr_target_owner}/{pr_target_repo}/pulls",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json={
                    "title": pr_title,
                    "body": pr_body,
                    "head": pr_head,
                    "base": github_repo.default_branch if github_repo else "main"
                },
                timeout=30.0
            )
            response.raise_for_status()
            pr_data = response.json()

    except httpx.HTTPStatusError as e:
        error_detail = e.response.json() if e.response.content else str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pull request: {error_detail}"
        )

    # Update resolution with PR info
    resolution.pr_number = pr_data["number"]
    resolution.pr_url = pr_data["html_url"]
    resolution.pr_state = pr_data["state"]
    resolution.pr_created_at = datetime.utcnow()
    resolution.resolution_state = "pr_created"

    await session.commit()

    return CreatePRResponse(
        pr_number=pr_data["number"],
        pr_url=pr_data["html_url"],
        message=f"Successfully created PR #{pr_data['number']}"
    )
