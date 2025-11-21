from typing import AsyncGenerator, Optional, Callable
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from fastapi import Header, HTTPException, status, Depends
from app.core.settings import get_settings
from app.core.redis import get_redis
from app.models.user import User
from app.models.subscription import Feature
import redis.asyncio as redis
from uuid import UUID

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,  # Disable SQL logging
    future=True
)

async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_redis_client() -> redis.Redis:
    return await get_redis()


async def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Get current authenticated user from X-User-ID header.

    In production, this should validate a JWT token or session cookie.
    For now, we're using a simple user ID header approach.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide X-User-ID header."
        )

    try:
        user_uuid = UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )

    # Get user from database
    stmt = select(User).where(User.id == user_uuid)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify that the current user is an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_feature(feature: Feature) -> Callable:
    """
    Dependency factory to check if user has access to a specific feature.

    Usage:
        @router.get("/some-endpoint")
        async def some_endpoint(
            user: User = Depends(require_feature(Feature.DEPLOYMENT_HOST))
        ):
            ...
    """
    async def feature_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        # Import here to avoid circular dependency
        from app.models.subscription import is_feature_enabled

        # Admins have access to all features
        if current_user.is_admin:
            return current_user

        # Check if feature is enabled for user's tier
        if not is_feature_enabled(current_user.subscription_tier, feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires a higher subscription tier. Feature: {feature.value}"
            )

        return current_user

    return feature_checker