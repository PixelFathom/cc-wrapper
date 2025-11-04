"""
GitHub API service for repository and issue management.
Acts as a proxy to GitHub API with caching and rate limit handling.
"""
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.github_repository import GitHubRepository
from app.models.github_issue import GitHubIssue
from app.models.user import User
from app.services.github_auth_service import GitHubAuthService


class GitHubAPIService:
    """Service for interacting with GitHub API."""

    GITHUB_API_BASE = "https://api.github.com"

    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id
        self.auth_service = GitHubAuthService(session)

    async def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers with user's token."""
        token = await self.auth_service.get_user_token(self.user_id)
        if not token:
            raise ValueError("No valid GitHub token found for user")

        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
        }

    async def fetch_user_repositories(
        self,
        sync_to_db: bool = True,
        per_page: int = 100,
        page: int = 1,
        sort: str = "updated",
        direction: str = "desc"
    ) -> List[Dict[str, Any]]:
        """
        Fetch user's GitHub repositories.

        Args:
            sync_to_db: Whether to sync repositories to database
            per_page: Results per page (max 100)
            page: Page number
            sort: Sort by (created, updated, pushed, full_name)
            direction: Sort direction (asc, desc)

        Returns:
            List of repository dictionaries
        """
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GITHUB_API_BASE}/user/repos",
                headers=headers,
                params={
                    "per_page": per_page,
                    "page": page,
                    "sort": sort,
                    "direction": direction,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            repos = response.json()

        if sync_to_db and repos:
            await self._sync_repositories_to_db(repos)

        return repos

    async def _sync_repositories_to_db(self, repos: List[Dict[str, Any]]):
        """Sync fetched repositories to database."""
        now = datetime.utcnow()

        for repo_data in repos:
            github_repo_id = repo_data["id"]

            # Check if repository exists
            stmt = select(GitHubRepository).where(
                GitHubRepository.github_repo_id == github_repo_id
            )
            result = await self.session.execute(stmt)
            repo = result.scalar_one_or_none()

            # Parse timestamps and convert to naive (remove timezone info)
            created_at = datetime.fromisoformat(repo_data["created_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            updated_at = datetime.fromisoformat(repo_data["updated_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            pushed_at = None
            if repo_data.get("pushed_at"):
                pushed_at = datetime.fromisoformat(repo_data["pushed_at"].replace("Z", "+00:00")).replace(tzinfo=None)

            # Extract fork parent information
            parent_repo_id = None
            parent_full_name = None
            if repo_data["fork"] and repo_data.get("parent"):
                parent_repo_id = repo_data["parent"]["id"]
                parent_full_name = repo_data["parent"]["full_name"]

            # Extract user permissions
            permissions = repo_data.get("permissions", {})
            can_push = permissions.get("push", False)
            can_admin = permissions.get("admin", False)

            if repo:
                # Update existing
                repo.owner = repo_data["owner"]["login"]
                repo.name = repo_data["name"]
                repo.full_name = repo_data["full_name"]
                repo.description = repo_data.get("description")
                repo.is_private = repo_data["private"]
                repo.is_fork = repo_data["fork"]
                repo.is_archived = repo_data.get("archived", False)
                repo.html_url = repo_data["html_url"]
                repo.clone_url = repo_data["clone_url"]
                repo.ssh_url = repo_data["ssh_url"]
                repo.stars_count = repo_data["stargazers_count"]
                repo.forks_count = repo_data["forks_count"]
                repo.open_issues_count = repo_data["open_issues_count"]
                repo.watchers_count = repo_data["watchers_count"]
                repo.size = repo_data["size"]
                repo.language = repo_data.get("language")
                repo.topics = repo_data.get("topics", [])
                repo.github_created_at = created_at
                repo.github_updated_at = updated_at
                repo.github_pushed_at = pushed_at
                repo.last_synced_at = now
                repo.license_name = repo_data.get("license", {}).get("name") if repo_data.get("license") else None
                repo.default_branch = repo_data.get("default_branch", "main")
                repo.has_issues = repo_data.get("has_issues", True)
                repo.has_wiki = repo_data.get("has_wiki", False)
                repo.has_pages = repo_data.get("has_pages", False)
                repo.has_downloads = repo_data.get("has_downloads", False)
                repo.parent_repo_id = parent_repo_id
                repo.parent_full_name = parent_full_name
                repo.can_push = can_push
                repo.can_admin = can_admin
                repo.updated_at = now
            else:
                # Create new
                repo = GitHubRepository(
                    user_id=self.user_id,
                    github_repo_id=github_repo_id,
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
                    watchers_count=repo_data["watchers_count"],
                    size=repo_data["size"],
                    language=repo_data.get("language"),
                    topics=repo_data.get("topics", []),
                    github_created_at=created_at,
                    github_updated_at=updated_at,
                    github_pushed_at=pushed_at,
                    last_synced_at=now,
                    license_name=repo_data.get("license", {}).get("name") if repo_data.get("license") else None,
                    default_branch=repo_data.get("default_branch", "main"),
                    has_issues=repo_data.get("has_issues", True),
                    has_wiki=repo_data.get("has_wiki", False),
                    has_pages=repo_data.get("has_pages", False),
                    has_downloads=repo_data.get("has_downloads", False),
                    parent_repo_id=parent_repo_id,
                    parent_full_name=parent_full_name,
                    can_push=can_push,
                    can_admin=can_admin,
                )
                self.session.add(repo)

        await self.session.commit()

    async def fetch_repository_issues(
        self,
        owner: str,
        repo: str,
        sync_to_db: bool = True,
        state: str = "open",
        per_page: int = 100,
        page: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        Fetch issues for a specific repository.

        Args:
            owner: Repository owner
            repo: Repository name
            sync_to_db: Whether to sync to database
            state: Issue state (open, closed, all)
            per_page: Results per page
            page: Page number

        Returns:
            List of issue dictionaries
        """
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/issues",
                headers=headers,
                params={
                    "state": state,
                    "per_page": per_page,
                    "page": page,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            issues = response.json()

        if sync_to_db and issues:
            await self._sync_issues_to_db(owner, repo, issues)

        return issues

    async def _sync_issues_to_db(self, owner: str, repo: str, issues: List[Dict[str, Any]]):
        """Sync fetched issues to database."""
        # Get repository from database
        stmt = select(GitHubRepository).where(
            GitHubRepository.owner == owner,
            GitHubRepository.name == repo,
            GitHubRepository.user_id == self.user_id,
        )
        result = await self.session.execute(stmt)
        repository = result.scalar_one_or_none()

        if not repository:
            # Repository not found, skip syncing
            return

        now = datetime.utcnow()

        for issue_data in issues:
            # Skip pull requests (they appear in issues endpoint)
            if "pull_request" in issue_data:
                continue

            github_issue_id = issue_data["id"]
            github_issue_number = issue_data["number"]

            # Check if issue exists
            stmt = select(GitHubIssue).where(
                GitHubIssue.repository_id == repository.id,
                GitHubIssue.github_issue_number == github_issue_number,
            )
            result = await self.session.execute(stmt)
            issue = result.scalar_one_or_none()

            # Parse timestamps and convert to naive (remove timezone info)
            created_at = datetime.fromisoformat(issue_data["created_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            updated_at = datetime.fromisoformat(issue_data["updated_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            closed_at = None
            if issue_data.get("closed_at"):
                closed_at = datetime.fromisoformat(issue_data["closed_at"].replace("Z", "+00:00")).replace(tzinfo=None)

            # Extract labels
            labels = [label["name"] for label in issue_data.get("labels", [])]

            # Extract assignees
            assignees = [assignee["login"] for assignee in issue_data.get("assignees", [])]

            # Count reactions
            reactions_count = sum(issue_data.get("reactions", {}).values()) if issue_data.get("reactions") else 0

            if issue:
                # Update existing
                issue.title = issue_data["title"]
                issue.body = issue_data.get("body")
                issue.state = issue_data["state"]
                issue.labels = labels
                issue.assignees = assignees
                issue.comments_count = issue_data.get("comments", 0)
                issue.reactions_count = reactions_count
                issue.github_updated_at = updated_at
                issue.github_closed_at = closed_at
                issue.last_synced_at = now
                issue.updated_at = now
            else:
                # Create new
                issue = GitHubIssue(
                    repository_id=repository.id,
                    github_issue_id=github_issue_id,
                    github_issue_number=github_issue_number,
                    title=issue_data["title"],
                    body=issue_data.get("body"),
                    state=issue_data["state"],
                    labels=labels,
                    author_login=issue_data["user"]["login"],
                    author_avatar_url=issue_data["user"].get("avatar_url"),
                    assignees=assignees,
                    comments_count=issue_data.get("comments", 0),
                    reactions_count=reactions_count,
                    html_url=issue_data["html_url"],
                    github_created_at=created_at,
                    github_updated_at=updated_at,
                    github_closed_at=closed_at,
                    last_synced_at=now,
                )
                self.session.add(issue)

        await self.session.commit()

    async def get_repository_structure(self, owner: str, repo: str, path: str = "") -> Dict[str, Any]:
        """
        Get repository file structure for a given path.

        Args:
            owner: Repository owner
            repo: Repository name
            path: Path within repository (empty for root)

        Returns:
            Directory contents from GitHub API
        """
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()

    async def check_user_permissions(self, owner: str, repo: str) -> Dict[str, bool]:
        """
        Check user's permissions on a repository.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Dictionary with push and admin permissions
        """
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}"
            response = await client.get(url, headers=headers, timeout=30.0)

            if response.status_code == 404:
                return {"push": False, "admin": False}

            response.raise_for_status()
            repo_data = response.json()

            permissions = repo_data.get("permissions", {})
            return {
                "push": permissions.get("push", False),
                "admin": permissions.get("admin", False)
            }

    async def check_fork_exists(self, owner: str, repo: str) -> Optional[Dict[str, Any]]:
        """
        Check if user has already forked a repository.

        Args:
            owner: Original repository owner
            repo: Original repository name

        Returns:
            Fork repository data if exists, None otherwise
        """
        headers = await self._get_headers()

        # First, get the user's username
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                f"{self.GITHUB_API_BASE}/user",
                headers=headers,
                timeout=30.0
            )
            user_response.raise_for_status()
            username = user_response.json()["login"]

            # Check if fork exists for this user
            fork_url = f"{self.GITHUB_API_BASE}/repos/{username}/{repo}"
            fork_response = await client.get(fork_url, headers=headers, timeout=30.0)

            if fork_response.status_code == 404:
                return None

            if fork_response.status_code == 200:
                fork_data = fork_response.json()
                # Verify it's actually a fork of the original repo
                if fork_data.get("fork") and fork_data.get("parent"):
                    parent = fork_data["parent"]
                    if parent["full_name"] == f"{owner}/{repo}":
                        return fork_data

            return None

    async def create_fork(self, owner: str, repo: str) -> Dict[str, Any]:
        """
        Create a fork of a repository.

        Args:
            owner: Original repository owner
            repo: Original repository name

        Returns:
            Created fork repository data
        """
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/forks"
            response = await client.post(
                url,
                headers=headers,
                json={},  # Empty body for fork creation
                timeout=60.0  # Longer timeout for fork creation
            )
            response.raise_for_status()
            return response.json()

    async def wait_for_fork_ready(self, owner: str, repo: str, max_attempts: int = 30) -> bool:
        """
        Wait for a forked repository to be ready for operations.

        Args:
            owner: Fork owner (usually the authenticated user)
            repo: Fork repository name
            max_attempts: Maximum number of attempts (default 30 seconds)

        Returns:
            True if fork is ready, False if timeout
        """
        headers = await self._get_headers()
        import asyncio

        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient() as client:
                    # Try to access the fork
                    url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}"
                    response = await client.get(url, headers=headers, timeout=10.0)

                    if response.status_code == 200:
                        # Fork exists, check if it's ready by trying to get its contents
                        contents_url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/contents"
                        contents_response = await client.get(contents_url, headers=headers, timeout=10.0)

                        if contents_response.status_code == 200:
                            return True
            except Exception:
                pass  # Ignore errors during waiting

            # Wait before next attempt
            await asyncio.sleep(1)

        return False

    async def get_or_create_fork(self, owner: str, repo: str) -> Dict[str, Any]:
        """
        Get existing fork or create a new one if it doesn't exist.

        Args:
            owner: Original repository owner
            repo: Original repository name

        Returns:
            Fork repository data
        """
        # Check if fork already exists
        existing_fork = await self.check_fork_exists(owner, repo)
        if existing_fork:
            return existing_fork

        # Create fork
        fork = await self.create_fork(owner, repo)

        # Wait for fork to be ready
        fork_owner = fork["owner"]["login"]
        fork_ready = await self.wait_for_fork_ready(fork_owner, fork["name"])

        if not fork_ready:
            raise Exception(f"Fork creation timed out for {owner}/{repo}")

        # Fetch full fork data with permissions
        return await self.fetch_repository(fork_owner, fork["name"])

    async def fetch_repository(self, owner: str, repo: str) -> Dict[str, Any]:
        """
        Fetch a specific repository's data.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Repository data from GitHub API
        """
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}"
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()
