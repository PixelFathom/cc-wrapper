"""
User profile management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from typing import Optional

from app.deps import get_session, get_current_user
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    """Request model for updating user profile."""
    email: Optional[EmailStr] = Field(None, description="User email address")
    phone: Optional[str] = Field(None, description="User phone number with country code")
    github_name: Optional[str] = Field(None, max_length=255, description="GitHub display name")
    bio: Optional[str] = Field(None, max_length=500, description="User bio")
    company: Optional[str] = Field(None, max_length=255, description="Company name")
    location: Optional[str] = Field(None, max_length=255, description="Location")
    blog: Optional[str] = Field(None, max_length=500, description="Blog or website URL")

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number format."""
        if v is None or v == "":
            return None

        # Remove spaces and common separators
        phone = re.sub(r'[\s\-\(\)]', '', v)

        # Check if it starts with + and has 10-15 digits
        if not re.match(r'^\+\d{10,15}$', phone):
            raise ValueError(
                'Phone number must be in international format with country code (e.g., +919876543210)'
            )

        return phone


class ProfileResponse(BaseModel):
    """Response model for user profile."""
    id: str
    github_id: int
    github_login: str
    github_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    company: Optional[str]
    location: Optional[str]
    blog: Optional[str]
    public_repos: int
    followers: int
    following: int
    subscription_tier: str
    coins_balance: int
    is_admin: bool


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Get current user's profile."""
    return ProfileResponse(
        id=str(current_user.id),
        github_id=current_user.github_id,
        github_login=current_user.github_login,
        github_name=current_user.github_name,
        email=current_user.email,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        bio=current_user.bio,
        company=current_user.company,
        location=current_user.location,
        blog=current_user.blog,
        public_repos=current_user.public_repos,
        followers=current_user.followers,
        following=current_user.following,
        subscription_tier=current_user.subscription_tier.value,
        coins_balance=current_user.coins_balance,
        is_admin=current_user.is_admin,
    )


@router.put("/me", response_model=ProfileResponse)
async def update_my_profile(
    profile_update: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Update current user's profile.

    Only provided fields will be updated. Fields set to null will clear the value.
    """
    # Update only provided fields
    if profile_update.email is not None:
        current_user.email = profile_update.email

    if profile_update.phone is not None:
        current_user.phone = profile_update.phone

    if profile_update.github_name is not None:
        current_user.github_name = profile_update.github_name

    if profile_update.bio is not None:
        current_user.bio = profile_update.bio

    if profile_update.company is not None:
        current_user.company = profile_update.company

    if profile_update.location is not None:
        current_user.location = profile_update.location

    if profile_update.blog is not None:
        current_user.blog = profile_update.blog

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return ProfileResponse(
        id=str(current_user.id),
        github_id=current_user.github_id,
        github_login=current_user.github_login,
        github_name=current_user.github_name,
        email=current_user.email,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        bio=current_user.bio,
        company=current_user.company,
        location=current_user.location,
        blog=current_user.blog,
        public_repos=current_user.public_repos,
        followers=current_user.followers,
        following=current_user.following,
        subscription_tier=current_user.subscription_tier.value,
        coins_balance=current_user.coins_balance,
        is_admin=current_user.is_admin,
    )


@router.post("/me/validate-payment-requirements")
async def validate_payment_requirements(
    current_user: User = Depends(get_current_user),
):
    """
    Check if user has required information for payment processing.

    Returns validation errors if email or phone are missing.
    """
    errors = []

    if not current_user.email:
        errors.append({
            "field": "email",
            "message": "Email is required for payment processing"
        })

    if not current_user.phone:
        errors.append({
            "field": "phone",
            "message": "Phone number is required for payment processing"
        })

    if errors:
        return {
            "valid": False,
            "errors": errors,
            "message": "Please update your profile with email and phone number to proceed with payment"
        }

    return {
        "valid": True,
        "message": "Profile has all required information for payment"
    }
