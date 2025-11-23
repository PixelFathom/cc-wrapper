"""
GitHub issues management and task generation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.deps import get_session, get_current_user, get_admin_user
from app.models.user import User
from app.models.github_issue import GitHubIssue
from app.models.github_repository import GitHubRepository
from app.models.task import Task
from app.models.project import Project
from app.services.github_api_service import GitHubAPIService

router = APIRouter(prefix="/github/issues")


class IssueResponse(BaseModel):
    """GitHub issue response."""
    id: str
    repository_id: str
    github_issue_number: int
    title: str
    body: Optional[str]
    state: str
    labels: Optional[List[str]]
    author_login: str
    author_avatar_url: Optional[str]
    assignees: Optional[List[str]]
    comments_count: int
    reactions_count: int
    html_url: str
    github_created_at: datetime
    github_updated_at: datetime
    is_task_generated: bool
    generated_task_id: Optional[str]
    priority: Optional[str]


class IssueListResponse(BaseModel):
    """Paginated issue list response."""
    issues: List[IssueResponse]
    total: int
    page: int
    per_page: int


class GenerateTaskFromIssueRequest(BaseModel):
    """Request to generate a task from an issue."""
    issue_id: str
    project_id: Optional[str] = None
    task_name: Optional[str] = None


class GenerateTaskFromIssueResponse(BaseModel):
    """Response after generating task from issue."""
    task_id: str
    issue_id: str
    project_id: str
    message: str


@router.get("", response_model=IssueListResponse)
async def list_issues(
    user_id: str,
    repository_id: Optional[str] = None,
    state: str = Query("open", regex="^(open|closed|all)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    sync: bool = Query(False, description="Sync from GitHub before returning"),
    current_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """
    List GitHub issues for user's repositories (admin only - premium feature).

    Args:
        user_id: User UUID
        repository_id: Optional filter by repository
        state: Issue state filter (open, closed, all)
        page: Page number
        per_page: Results per page
        sync: Whether to sync from GitHub first

    Returns:
        Paginated list of issues
    """
    try:
        user_uuid = UUID(user_id)
        repo_uuid = UUID(repository_id) if repository_id else None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID or repository ID"
        )

    # Sync from GitHub if requested
    if sync and repo_uuid:
        # Get repository details
        repo_stmt = select(GitHubRepository).where(
            GitHubRepository.id == repo_uuid,
            GitHubRepository.user_id == user_uuid
        )
        repo_result = await session.execute(repo_stmt)
        repository = repo_result.scalar_one_or_none()

        if repository:
            api_service = GitHubAPIService(session, user_uuid)
            try:
                await api_service.fetch_repository_issues(
                    owner=repository.owner,
                    repo=repository.name,
                    sync_to_db=True,
                    state=state,
                    per_page=per_page,
                    page=page
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to sync issues: {str(e)}"
                )

    # Build query
    if repo_uuid:
        stmt = select(GitHubIssue).where(GitHubIssue.repository_id == repo_uuid)
    else:
        # Join with repositories to filter by user
        stmt = select(GitHubIssue).join(GitHubRepository).where(
            GitHubRepository.user_id == user_uuid
        )

    # Filter by state
    if state != "all":
        stmt = stmt.where(GitHubIssue.state == state)

    # Order by updated date
    stmt = stmt.order_by(GitHubIssue.github_updated_at.desc())

    # Count total
    count_result = await session.execute(stmt)
    total = len(count_result.all())

    # Apply pagination
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    result = await session.execute(stmt)
    issues = result.scalars().all()

    return IssueListResponse(
        issues=[
            IssueResponse(
                id=str(issue.id),
                repository_id=str(issue.repository_id),
                github_issue_number=issue.github_issue_number,
                title=issue.title,
                body=issue.body,
                state=issue.state,
                labels=issue.labels,
                author_login=issue.author_login,
                author_avatar_url=issue.author_avatar_url,
                assignees=issue.assignees,
                comments_count=issue.comments_count,
                reactions_count=issue.reactions_count,
                html_url=issue.html_url,
                github_created_at=issue.github_created_at,
                github_updated_at=issue.github_updated_at,
                is_task_generated=issue.is_task_generated,
                generated_task_id=str(issue.generated_task_id) if issue.generated_task_id else None,
                priority=issue.priority,
            )
            for issue in issues
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/generate-task", response_model=GenerateTaskFromIssueResponse)
async def generate_task_from_issue(
    user_id: str,
    payload: GenerateTaskFromIssueRequest,
    current_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Generate a detailed coding task from a GitHub issue.

    This will:
    1. Fetch the issue details
    2. Get repository structure and context
    3. Generate a comprehensive task description
    4. Create a task linked to the issue
    5. Optionally initialize the repository as a project if not already done

    Args:
        user_id: User UUID
        payload: Task generation request

    Returns:
        Created task details
    """
    try:
        user_uuid = UUID(user_id)
        issue_uuid = UUID(payload.issue_id)
        project_uuid = UUID(payload.project_id) if payload.project_id else None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID, issue ID, or project ID"
        )

    # Get issue
    stmt = select(GitHubIssue).where(GitHubIssue.id == issue_uuid)
    result = await session.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )

    # Check if task already generated
    if issue.is_task_generated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task already generated for this issue"
        )

    # Get repository
    repo_stmt = select(GitHubRepository).where(GitHubRepository.id == issue.repository_id)
    repo_result = await session.execute(repo_stmt)
    repository = repo_result.scalar_one_or_none()

    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify user owns repository
    if repository.user_id != user_uuid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Get or create project
    if project_uuid:
        proj_stmt = select(Project).where(
            Project.id == project_uuid,
            Project.user_id == user_uuid
        )
        proj_result = await session.execute(proj_stmt)
        project = proj_result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
    else:
        # Check if project exists for this repository
        proj_stmt = select(Project).where(
            Project.github_repository_id == repository.id,
            Project.user_id == user_uuid
        )
        proj_result = await session.execute(proj_stmt)
        project = proj_result.scalar_one_or_none()

        if not project:
            # Create new project
            project = Project(
                name=repository.name,
                repo_url=repository.clone_url,
                user_id=user_uuid,
                github_repo_id=repository.github_repo_id,
                github_owner=repository.owner,
                github_repo_name=repository.name,
                is_private=repository.is_private,
                github_repository_id=repository.id,
            )
            session.add(project)
            await session.flush()

    # Generate comprehensive task description
    task_description = _generate_task_description(issue, repository)

    # Create task
    task_name = payload.task_name or f"Solve: {issue.title}"
    task = Task(
        name=task_name,
        project_id=project.id,
        deployment_status="pending",
    )
    session.add(task)
    await session.flush()

    # Link issue to task
    issue.is_task_generated = True
    issue.generated_task_id = task.id

    await session.commit()
    await session.refresh(task)

    return GenerateTaskFromIssueResponse(
        task_id=str(task.id),
        issue_id=str(issue.id),
        project_id=str(project.id),
        message=f"Successfully generated task from issue #{issue.github_issue_number}"
    )


def _generate_task_description(issue: GitHubIssue, repository: GitHubRepository) -> str:
    """
    Generate a comprehensive task description from an issue.

    This creates a detailed prompt that includes:
    - Issue context (title, body, labels)
    - Repository information
    - Instructions to follow best practices
    - Request for structured solution
    """
    labels_str = ", ".join(issue.labels) if issue.labels else "None"

    description = f"""
# GitHub Issue Task

## Issue Details
- **Issue Number**: #{issue.github_issue_number}
- **Title**: {issue.title}
- **Labels**: {labels_str}
- **Author**: @{issue.author_login}
- **Created**: {issue.github_created_at.strftime('%Y-%m-%d')}
- **URL**: {issue.html_url}

## Description
{issue.body or "No description provided."}

## Repository Context
- **Repository**: {repository.full_name}
- **Language**: {repository.language or "Not specified"}
- **Topics**: {", ".join(repository.topics) if repository.topics else "None"}
- **Default Branch**: {repository.default_branch}

## Task Requirements

Please solve this issue by following these guidelines:

1. **Understand the Context**
   - Review the existing codebase structure
   - Identify relevant files and dependencies
   - Understand the repository's coding conventions

2. **Implement the Solution**
   - Write clean, maintainable code following the repository's style
   - Ensure backward compatibility if modifying existing features
   - Add appropriate error handling
   - Follow the language and framework best practices

3. **Testing**
   - Write unit tests for new functionality
   - Ensure existing tests still pass
   - Test edge cases and error scenarios

4. **Documentation**
   - Update relevant documentation
   - Add inline comments for complex logic
   - Update README if adding new features

5. **Code Review Ready**
   - Ensure code follows linting rules
   - Self-review the changes
   - Prepare clear commit messages

## Deliverables
- Working implementation that solves the issue
- Tests covering the changes
- Updated documentation
- Clean commit history
"""
    return description


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    user_id: str,
    issue_id: str,
    current_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get details of a specific issue.

    Args:
        user_id: User UUID
        issue_id: Issue UUID

    Returns:
        Issue details
    """
    try:
        user_uuid = UUID(user_id)
        issue_uuid = UUID(issue_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID or issue ID"
        )

    # Get issue and verify ownership through repository
    stmt = select(GitHubIssue).join(GitHubRepository).where(
        GitHubIssue.id == issue_uuid,
        GitHubRepository.user_id == user_uuid
    )
    result = await session.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )

    return IssueResponse(
        id=str(issue.id),
        repository_id=str(issue.repository_id),
        github_issue_number=issue.github_issue_number,
        title=issue.title,
        body=issue.body,
        state=issue.state,
        labels=issue.labels,
        author_login=issue.author_login,
        author_avatar_url=issue.author_avatar_url,
        assignees=issue.assignees,
        comments_count=issue.comments_count,
        reactions_count=issue.reactions_count,
        html_url=issue.html_url,
        github_created_at=issue.github_created_at,
        github_updated_at=issue.github_updated_at,
        is_task_generated=issue.is_task_generated,
        generated_task_id=str(issue.generated_task_id) if issue.generated_task_id else None,
        priority=issue.priority,
    )
