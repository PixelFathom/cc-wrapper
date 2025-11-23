"""
GitHub repository management endpoints.
Fetches repositories directly from GitHub API - no database caching until project initialization.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import httpx

from app.deps import get_session, get_current_user
from app.models.user import User
from app.models.github_repository import GitHubRepository
from app.models.project import Project
from app.models.task import Task
from app.services.github_auth_service import GitHubAuthService
from app.services.deployment_service import deployment_service
from app.core.rate_limiter import RateLimitExceeded
router = APIRouter(prefix="/github/repositories", tags=["github-repositories"])


class GitHubRepoResponse(BaseModel):
    """Repository data from GitHub API (not from database)."""
    id: int  # GitHub repo ID
    name: str
    full_name: str
    owner: str
    description: Optional[str]
    is_private: bool
    is_fork: bool
    is_archived: bool
    html_url: str
    clone_url: str
    ssh_url: str
    stars_count: int
    forks_count: int
    open_issues_count: int
    language: Optional[str]
    topics: List[str]
    default_branch: str
    updated_at: str  # GitHub's updated_at
    is_initialized: bool  # Check if already exists as project


class RepositoryListResponse(BaseModel):
    """Paginated repository list response."""
    repositories: List[GitHubRepoResponse]
    total: int


class InitializeRepositoryRequest(BaseModel):
    """Request to initialize a repository as a project."""
    github_repo_id: int
    project_name: Optional[str] = None
    task_name: str  # Required: task name for initialization


class InitializeRepositoryResponse(BaseModel):
    """Response after initializing repository."""
    project_id: str
    task_id: str
    message: str


@router.get("", response_model=RepositoryListResponse)
async def list_repositories(
    per_page: int = Query(100, ge=1, le=100),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Fetch user's GitHub repositories directly from GitHub API.
    No database caching - repositories are only stored when initialized as projects.

    Args:
        per_page: Results per page (max 100)
        page: Page number
        current_user: Authenticated user (from X-User-ID header)

    Returns:
        List of repositories with initialization status
    """
    # Get user's GitHub token
    auth_service = GitHubAuthService(session)
    token = await auth_service.get_user_token(current_user.id)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No GitHub token found. Please authenticate with GitHub."
        )

    # Fetch repos from GitHub API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                params={
                    "per_page": per_page,
                    "page": page,
                    "sort": "updated",
                    "affiliation": "owner,collaborator,organization_member"
                },
                timeout=30.0
            )
            response.raise_for_status()
            github_repos = response.json()

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token expired. Please re-authenticate."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch repositories from GitHub: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error communicating with GitHub: {str(e)}"
        )

    # Get list of already initialized repo IDs from database
    stmt = select(Project.github_repo_id).where(
        Project.user_id == current_user.id,
        Project.github_repo_id.isnot(None)
    )
    result = await session.execute(stmt)
    initialized_repo_ids = {row[0] for row in result.all()}

    # Transform GitHub API response to our format
    repositories = []
    for repo in github_repos:
        if repo.get("archived", False):
            # Skip archived repos by default
            continue

        repositories.append(GitHubRepoResponse(
            id=repo["id"],
            name=repo["name"],
            full_name=repo["full_name"],
            owner=repo["owner"]["login"],
            description=repo.get("description"),
            is_private=repo["private"],
            is_fork=repo["fork"],
            is_archived=repo.get("archived", False),
            html_url=repo["html_url"],
            clone_url=repo["clone_url"],
            ssh_url=repo["ssh_url"],
            stars_count=repo["stargazers_count"],
            forks_count=repo["forks_count"],
            open_issues_count=repo["open_issues_count"],
            language=repo.get("language"),
            topics=repo.get("topics", []),
            default_branch=repo.get("default_branch", "main"),
            updated_at=repo["updated_at"],
            is_initialized=repo["id"] in initialized_repo_ids,
        ))

    return RepositoryListResponse(
        repositories=repositories,
        total=len(repositories)
    )


@router.post("/initialize", response_model=InitializeRepositoryResponse)
async def initialize_repository(
    payload: InitializeRepositoryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Initialize a GitHub repository as a project.
    This is when we create the database entry and call the init service.

    Args:
        payload: Repository initialization request
        current_user: Authenticated user

    Returns:
        Project creation status
    """
    # Get user's GitHub token
    auth_service = GitHubAuthService(session)
    token = await auth_service.get_user_token(current_user.id)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No GitHub token found. Please re-authenticate."
        )

    # Fetch specific repository details from GitHub
    try:
        async with httpx.AsyncClient() as client:
            # We need to get the full_name from the repo_id
            # First, get user repos and find the matching one
            response = await client.get(
                "https://api.github.com/user/repos",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                params={
                    "per_page": 500,
                    "page": 1,
                    "sort": "updated",
                    "affiliation": "owner,collaborator,organization_member"
                },
                timeout=30.0
            )
            response.raise_for_status()
            repos = response.json()

            # Find the specific repo
            repo_data = next((r for r in repos if r["id"] == payload.github_repo_id), None)

            if not repo_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Repository not found or you don't have access"
                )

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch repository from GitHub: {str(e)}"
        )

    # Check if repository is already initialized as a project
    stmt = select(Project).where(
        Project.user_id == current_user.id,
        Project.github_repo_id == payload.github_repo_id
    )
    result = await session.execute(stmt)
    existing_project = result.scalar_one_or_none()

    if existing_project:
        # Project already exists, just create a new task for it
        project = existing_project
        project_name = existing_project.name
    else:
        # Create new project
        project_name = payload.project_name or repo_data["name"]
        project = Project(
            name=project_name,
            repo_url=repo_data["clone_url"],
            user_id=current_user.id,
            github_repo_id=repo_data["id"],
            github_owner=repo_data["owner"]["login"],
            github_repo_name=repo_data["name"],
            is_private=repo_data["private"],
        )
        session.add(project)
        await session.flush()

        # Store GitHub repository metadata for future reference
        github_repo = GitHubRepository(
            user_id=current_user.id,
            github_repo_id=repo_data["id"],
            owner=repo_data["owner"]["login"],
            name=repo_data["name"],
            full_name=repo_data["full_name"],
            description=repo_data.get("description"),
            is_private=repo_data["private"],
            is_fork=repo_data["fork"],
            is_archived=repo_data.get("archived", False),
            html_url=repo_data["html_url"],
            clone_url=repo_data["clone_url"],
            ssh_url=repo_data["ssh_url"],
            stars_count=repo_data["stargazers_count"],
            forks_count=repo_data["forks_count"],
            open_issues_count=repo_data["open_issues_count"],
            watchers_count=repo_data.get("watchers_count", 0),
            size=repo_data.get("size", 0),
            language=repo_data.get("language"),
            topics=repo_data.get("topics", []),
            github_created_at=datetime.fromisoformat(repo_data["created_at"].replace('Z', '+00:00')).replace(tzinfo=None),
            github_updated_at=datetime.fromisoformat(repo_data["updated_at"].replace('Z', '+00:00')).replace(tzinfo=None),
            github_pushed_at=datetime.fromisoformat(repo_data["pushed_at"].replace('Z', '+00:00')).replace(tzinfo=None) if repo_data.get("pushed_at") else None,
            last_synced_at=datetime.utcnow(),
            is_initialized=True,
            license_name=repo_data.get("license", {}).get("name") if repo_data.get("license") else None,
            default_branch=repo_data.get("default_branch", "main"),
            has_issues=repo_data.get("has_issues", False),
            has_wiki=repo_data.get("has_wiki", False),
            has_pages=repo_data.get("has_pages", False),
            has_downloads=repo_data.get("has_downloads", False),
        )
        session.add(github_repo)
        project.github_repository_id = github_repo.id
        await session.flush()

    # Create task for this project initialization
    task = Task(
        name=payload.task_name,
        project_id=project.id
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)

    # Initialize deployment using deployment service
    try:
        # The deployment service handles:
        # - Rate limiting
        # - Building GitHub URL with token
        # - Building project path
        # - Building webhook URL
        # - Calling init-project API
        # - Updating task status
        await deployment_service.initialize_project(session, task.id, github_token=token)
        await session.commit()

        return InitializeRepositoryResponse(
            project_id=str(project.id),
            task_id=str(task.id),
            message=f"Successfully initialized {repo_data['full_name']} with task: {task.name}"
        )
    except Exception as e:
        # Rollback on failure
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize repository: {str(e)}"
        )
