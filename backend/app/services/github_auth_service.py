"""
GitHub OAuth authentication service.
Handles OAuth flow, token management, and user profile sync.
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.models.user_token import UserToken
from app.models.audit_log import AuditLog
from app.core.encryption import encrypt_token, decrypt_token
from app.core.settings import get_settings

settings = get_settings()


class GitHubAuthService:
    """Service for GitHub OAuth authentication and token management."""

    GITHUB_API_BASE = "https://api.github.com"
    GITHUB_OAUTH_BASE = "https://github.com/login/oauth"

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """
        Generate GitHub OAuth authorization URL.

        Args:
            redirect_uri: OAuth callback URL
            state: CSRF protection state parameter

        Returns:
            Authorization URL for redirect
        """
        client_id = settings.github_client_id
        scope = "repo read:user user:email workflow"

        return (
            f"{self.GITHUB_OAUTH_BASE}/authorize"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&scope={scope}"
            f"&state={state}"
        )

    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange OAuth code for access token.

        Args:
            code: OAuth authorization code

        Returns:
            Token response from GitHub

        Raises:
            httpx.HTTPError: If token exchange fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.GITHUB_OAUTH_BASE}/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_github_user(self, access_token: str) -> Dict[str, Any]:
        """
        Fetch authenticated user's GitHub profile.

        Args:
            access_token: GitHub OAuth access token

        Returns:
            User profile data from GitHub API
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GITHUB_API_BASE}/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            response.raise_for_status()
            return response.json()

    async def create_or_update_user(
        self,
        github_profile: Dict[str, Any],
        access_token: str,
        scope: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Create or update user from GitHub profile and store encrypted token.

        Args:
            github_profile: GitHub user profile data
            access_token: OAuth access token
            scope: OAuth scopes granted
            ip_address: User's IP address for audit

        Returns:
            User object (created or updated)
        """
        # Check if user exists
        stmt = select(User).where(User.github_id == github_profile["id"])
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()

        now = datetime.utcnow()

        if user:
            # Update existing user
            user.github_login = github_profile["login"]
            user.github_name = github_profile.get("name")
            user.email = github_profile.get("email")
            user.avatar_url = github_profile.get("avatar_url")
            user.bio = github_profile.get("bio")
            user.company = github_profile.get("company")
            user.location = github_profile.get("location")
            user.blog = github_profile.get("blog")
            user.public_repos = github_profile.get("public_repos", 0)
            user.followers = github_profile.get("followers", 0)
            user.following = github_profile.get("following", 0)
            user.last_login_at = now
            user.updated_at = now

            action = "user_login"
        else:
            # Create new user
            user = User(
                github_id=github_profile["id"],
                github_login=github_profile["login"],
                github_name=github_profile.get("name"),
                email=github_profile.get("email"),
                avatar_url=github_profile.get("avatar_url"),
                bio=github_profile.get("bio"),
                company=github_profile.get("company"),
                location=github_profile.get("location"),
                blog=github_profile.get("blog"),
                public_repos=github_profile.get("public_repos", 0),
                followers=github_profile.get("followers", 0),
                following=github_profile.get("following", 0),
                last_login_at=now,
            )
            self.session.add(user)
            action = "user_created"

        await self.session.flush()

        # Store or update token
        await self._store_user_token(user.id, access_token, scope)

        # Audit log
        await self._create_audit_log(
            user_id=user.id,
            action=action,
            ip_address=ip_address
        )

        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def _store_user_token(
        self,
        user_id: UUID,
        access_token: str,
        scope: Optional[str] = None,
        refresh_token: Optional[str] = None,
        expires_in: Optional[int] = None,
    ) -> UserToken:
        """Store encrypted OAuth token for user."""
        # Check if token exists
        stmt = select(UserToken).where(UserToken.user_id == user_id)
        result = await self.session.execute(stmt)
        token = result.scalar_one_or_none()

        # Encrypt tokens
        encrypted_access = encrypt_token(access_token)
        encrypted_refresh = encrypt_token(refresh_token) if refresh_token else None

        # Calculate expiration
        expires_at = None
        if expires_in:
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        now = datetime.utcnow()

        if token:
            # Update existing token
            token.access_token_encrypted = encrypted_access
            token.refresh_token_encrypted = encrypted_refresh
            token.scope = scope
            token.expires_at = expires_at
            token.updated_at = now
        else:
            # Create new token
            token = UserToken(
                user_id=user_id,
                access_token_encrypted=encrypted_access,
                refresh_token_encrypted=encrypted_refresh,
                scope=scope,
                expires_at=expires_at,
            )
            self.session.add(token)

        await self.session.flush()
        return token

    async def get_user_token(self, user_id: UUID) -> Optional[str]:
        """
        Get decrypted access token for user.

        Args:
            user_id: User UUID

        Returns:
            Decrypted access token or None
        """
        stmt = select(UserToken).where(UserToken.user_id == user_id)
        result = await self.session.execute(stmt)
        token = result.scalar_one_or_none()

        if not token:
            return None

        # Check if token is expired
        if token.expires_at and token.expires_at < datetime.utcnow():
            # TODO: Implement token refresh logic
            return None

        return decrypt_token(token.access_token_encrypted)

    async def revoke_user_token(self, user_id: UUID, ip_address: Optional[str] = None):
        """
        Revoke user's OAuth token.

        Args:
            user_id: User UUID
            ip_address: IP address for audit
        """
        stmt = select(UserToken).where(UserToken.user_id == user_id)
        result = await self.session.execute(stmt)
        token = result.scalar_one_or_none()

        if token:
            await self.session.delete(token)

            # Audit log
            await self._create_audit_log(
                user_id=user_id,
                action="token_revoked",
                ip_address=ip_address,
            )

            await self.session.commit()

    async def _create_audit_log(
        self,
        user_id: Optional[UUID] = None,
        action: str = "",
        resource_type: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        meta_data: Optional[Dict[str, Any]] = None,
    ):
        """Create audit log entry."""
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.session.add(log)
        await self.session.flush()
