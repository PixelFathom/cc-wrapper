from typing import Optional, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
import redis.asyncio as redis
from jose import JWTError
import json
from datetime import datetime, timezone

from app.deps import get_session, get_redis_client
from app.models.user import User
from app.core.security import decode_token, TokenData


# Security scheme
security = HTTPBearer()


async def get_current_user_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)]
) -> TokenData:
    """Extract and validate JWT token from request"""
    token = credentials.credentials
    
    # Check if token is blacklisted in Redis
    is_blacklisted = await redis_client.get(f"blacklist:{token}")
    if is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Decode token
    token_data = decode_token(token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token_data


async def get_current_user(
    token_data: Annotated[TokenData, Depends(get_current_user_token)],
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)]
) -> User:
    """Get current authenticated user from database"""
    # Try to get user from Redis cache first
    user_cache_key = f"user:{token_data.user_id}"
    cached_user = await redis_client.get(user_cache_key)
    
    if cached_user:
        user_dict = json.loads(cached_user)
        user = User(**user_dict)
    else:
        # Get from database
        statement = select(User).where(User.id == token_data.user_id)
        result = await session.exec(statement)
        user = result.first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Cache user in Redis for 5 minutes
        user_dict = user.model_dump(mode="json")
        await redis_client.setex(
            user_cache_key, 
            300,  # 5 minutes
            json.dumps(user_dict)
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Ensure current user is active"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Ensure current user is a superuser"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Optional authentication dependency
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        
        # Check if token is blacklisted
        is_blacklisted = await redis_client.get(f"blacklist:{token}")
        if is_blacklisted:
            return None
        
        # Decode token
        token_data = decode_token(token)
        if token_data is None:
            return None
        
        # Get user
        statement = select(User).where(User.id == token_data.user_id)
        result = await session.exec(statement)
        user = result.first()
        
        if user and user.is_active:
            return user
        
        return None
    except Exception:
        return None