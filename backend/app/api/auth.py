from typing import Annotated
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
import redis.asyncio as redis
import json

from app.deps import get_session, get_redis_client
from app.models.user import User, UserCreate, UserRead
from pydantic import BaseModel
from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_tokens,
    Token,
    decode_token
)
from app.core.auth import get_current_user, get_current_user_token
from app.core.security import TokenData


router = APIRouter()
security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)]
) -> Token:
    """
    Login endpoint that returns JWT tokens.
    """
    # Get user by username
    statement = select(User).where(User.username == login_data.username)
    result = await session.exec(statement)
    user = result.first()
    
    # Verify user exists and password is correct
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Update last login (use timezone-naive datetime for PostgreSQL)
    user.last_login = datetime.utcnow()
    session.add(user)
    await session.commit()
    
    # Create tokens
    tokens = create_tokens(str(user.id), user.username)
    
    # Store session in Redis with user data
    session_key = f"session:{user.id}"
    session_data = {
        "user_id": str(user.id),
        "username": user.username,
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "login_time": datetime.now(timezone.utc).isoformat()
    }
    
    # Set session to expire in 7 days (same as refresh token)
    await redis_client.setex(
        session_key,
        int(timedelta(days=7).total_seconds()),
        json.dumps(session_data)
    )
    
    return tokens


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    current_user: Annotated[User, Depends(get_current_user)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)]
) -> Response:
    """
    Logout endpoint that blacklists the current token and clears session.
    """
    token = credentials.credentials
    
    # Decode token to get expiration time
    try:
        token_data = decode_token(token)
        if token_data:
            # Add token to blacklist in Redis
            # Token will be blacklisted until its original expiration time
            blacklist_key = f"blacklist:{token}"
            await redis_client.setex(
                blacklist_key,
                timedelta(minutes=30).total_seconds(),  # Same as access token expiry
                "1"
            )
            
            # Clear user session
            session_key = f"session:{current_user.id}"
            await redis_client.delete(session_key)
            
            # Clear user cache
            user_cache_key = f"user:{current_user.id}"
            await redis_client.delete(user_cache_key)
    except Exception:
        pass  # Even if token decode fails, we still want to logout
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/auth/me", response_model=UserRead)
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)]
) -> UserRead:
    """
    Get current authenticated user information.
    """
    return UserRead(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        is_superuser=current_user.is_superuser,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )


@router.post("/auth/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)]
) -> Token:
    """
    Refresh access token using refresh token.
    """
    # Check if refresh token is blacklisted
    is_blacklisted = await redis_client.get(f"blacklist:{refresh_token}")
    if is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked"
        )
    
    # Decode refresh token
    token_data = decode_token(refresh_token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Get user
    statement = select(User).where(User.id == token_data.user_id)
    result = await session.exec(statement)
    user = result.first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new tokens
    tokens = create_tokens(str(user.id), user.username)
    
    # Update session in Redis
    session_key = f"session:{user.id}"
    session_data = {
        "user_id": str(user.id),
        "username": user.username,
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "login_time": datetime.now(timezone.utc).isoformat()
    }
    
    await redis_client.setex(
        session_key,
        timedelta(days=7).total_seconds(),
        json.dumps(session_data)
    )
    
    # Blacklist old refresh token
    await redis_client.setex(
        f"blacklist:{refresh_token}",
        timedelta(days=7).total_seconds(),
        "1"
    )
    
    return tokens