from typing import AsyncGenerator, Optional
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from fastapi import Header, HTTPException, status, Depends
from app.core.settings import get_settings
from app.core.redis import get_redis
from app.models.user import User
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