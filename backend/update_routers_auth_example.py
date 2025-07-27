#!/usr/bin/env python3
"""
Example of how to update existing routers to include authentication.

This script shows the changes needed to protect API endpoints with JWT authentication.
"""

# BEFORE: Original endpoint without authentication
"""
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.deps import get_session

@router.post("/tasks")
async def create_task(
    task: TaskCreate,
    session: AsyncSession = Depends(get_session)
):
    # endpoint logic
    pass
"""

# AFTER: Endpoint with authentication
"""
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated
from app.deps import get_session
from app.models.user import User
from app.core.auth import get_current_active_user

@router.post("/tasks")
async def create_task(
    task: TaskCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    # endpoint logic
    # You now have access to current_user object
    pass
"""

# For each router file, you need to:
# 1. Add imports:
#    - from typing import Annotated
#    - from app.models.user import User
#    - from app.core.auth import get_current_active_user

# 2. Update function signatures to include:
#    - current_user: Annotated[User, Depends(get_current_active_user)]
#    - Change session to use Annotated type hint

# 3. Optional: Use different auth dependencies based on needs:
#    - get_current_active_user: Requires authenticated, active user
#    - get_current_superuser: Requires superuser permissions
#    - get_current_user_optional: Authentication is optional

# Example with different auth levels:
"""
# Public endpoint - no auth required
@router.get("/public/info")
async def get_public_info():
    return {"message": "Public information"}

# Optional auth - works for both authenticated and anonymous
@router.get("/mixed/data")
async def get_mixed_data(
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if current_user:
        return {"message": f"Hello {current_user.username}", "authenticated": True}
    return {"message": "Hello anonymous", "authenticated": False}

# Protected endpoint - requires authentication
@router.get("/protected/data")
async def get_protected_data(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    return {"message": f"Secret data for {current_user.username}"}

# Admin only endpoint
@router.delete("/admin/user/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_superuser)]
):
    # Only superusers can access this
    return {"message": "User deleted"}
"""