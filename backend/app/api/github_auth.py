"""
GitHub OAuth authentication endpoints.
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.deps import get_session
from app.services.github_auth_service import GitHubAuthService
from app.core.settings import get_settings

settings = get_settings()
router = APIRouter(prefix="/github/auth")


class OAuthUrlResponse(BaseModel):
    """OAuth authorization URL response."""
    authorization_url: str
    state: str


class TokenExchangeRequest(BaseModel):
    """OAuth code exchange request."""
    code: str
    state: str


class UserProfileResponse(BaseModel):
    """Authenticated user profile response."""
    id: str
    github_id: int
    github_login: str
    github_name: Optional[str]
    email: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    company: Optional[str]
    location: Optional[str]
    blog: Optional[str]
    public_repos: int
    followers: int
    following: int


@router.get("/authorize", response_model=OAuthUrlResponse)
async def get_authorization_url(
    redirect_uri: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """
    Get GitHub OAuth authorization URL.

    Returns:
        Authorization URL and CSRF state token
    """
    auth_service = GitHubAuthService(session)

    # Generate CSRF state token
    state = secrets.token_urlsafe(32)

    # Use provided redirect URI or default
    callback_uri = redirect_uri or settings.github_oauth_callback_url

    # Generate OAuth URL
    auth_url = await auth_service.get_oauth_url(callback_uri, state)

    return OAuthUrlResponse(
        authorization_url=auth_url,
        state=state
    )


@router.post("/callback", response_model=UserProfileResponse)
async def oauth_callback(
    request: Request,
    payload: TokenExchangeRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Handle GitHub OAuth callback.

    Exchange authorization code for access token and create/update user.

    Args:
        payload: OAuth code and state

    Returns:
        User profile data

    Raises:
        HTTPException: If OAuth flow fails
    """
    auth_service = GitHubAuthService(session)

    try:
        # Exchange code for token
        token_response = await auth_service.exchange_code_for_token(payload.code)

        access_token = token_response.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to obtain access token"
            )

        # Fetch GitHub user profile
        github_profile = await auth_service.get_github_user(access_token)

        # Get client IP for audit
        client_ip = request.client.host if request.client else None

        # Create or update user
        user = await auth_service.create_or_update_user(
            github_profile=github_profile,
            access_token=access_token,
            scope=token_response.get("scope"),
            ip_address=client_ip
        )

        return UserProfileResponse(
            id=str(user.id),
            github_id=user.github_id,
            github_login=user.github_login,
            github_name=user.github_name,
            email=user.email,
            avatar_url=user.avatar_url,
            bio=user.bio,
            company=user.company,
            location=user.location,
            blog=user.blog,
            public_repos=user.public_repos,
            followers=user.followers,
            following=user.following,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth callback failed: {str(e)}"
        )


@router.post("/logout")
async def logout(
    request: Request,
    user_id: str,
    session: AsyncSession = Depends(get_session)
):
    """
    Revoke user's GitHub OAuth token.

    Args:
        user_id: User UUID

    Returns:
        Success message
    """
    auth_service = GitHubAuthService(session)

    # Get client IP for audit
    client_ip = request.client.host if request.client else None

    from uuid import UUID
    try:
        await auth_service.revoke_user_token(UUID(user_id), ip_address=client_ip)
        return {"message": "Successfully logged out"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logout failed: {str(e)}"
        )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user(
    user_id: str,
    session: AsyncSession = Depends(get_session)
):
    """
    Get current authenticated user profile.

    Args:
        user_id: User UUID (from session/cookie)

    Returns:
        User profile data
    """
    from uuid import UUID
    from sqlmodel import select
    from app.models.user import User

    try:
        stmt = select(User).where(User.id == UUID(user_id))
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserProfileResponse(
            id=str(user.id),
            github_id=user.github_id,
            github_login=user.github_login,
            github_name=user.github_name,
            email=user.email,
            avatar_url=user.avatar_url,
            bio=user.bio,
            company=user.company,
            location=user.location,
            blog=user.blog,
            public_repos=user.public_repos,
            followers=user.followers,
            following=user.following,
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
