"""
Subscription management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from app.deps import get_session, get_current_user, get_admin_user
from app.models import User, SubscriptionTier, TransactionType
from app.services.subscription_service import subscription_service
from app.services.coin_service import coin_service

router = APIRouter()


class UpgradeSubscriptionRequest(BaseModel):
    """Request model for upgrading subscription."""
    tier: SubscriptionTier
    stripe_subscription_id: Optional[str] = None


class AllocateCoinsRequest(BaseModel):
    """Request model for allocating coins (admin only)."""
    user_id: UUID
    amount: int
    description: str


class AdjustCoinsRequest(BaseModel):
    """Request model for adjusting coins (admin only)."""
    user_id: UUID
    amount: int  # Can be positive or negative
    description: str


@router.get("/subscription")
async def get_my_subscription(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get current user's subscription details."""
    subscription = await subscription_service.get_user_subscription(session, current_user.id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )

    return subscription


@router.get("/subscription/balance")
async def get_coin_balance(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get current user's coin balance."""
    balance = await coin_service.get_balance(session, current_user.id)

    return {
        "user_id": str(current_user.id),
        "coins_balance": balance,
        "subscription_tier": current_user.subscription_tier
    }


@router.get("/subscription/transactions")
async def get_my_transactions(
    limit: int = 100,
    offset: int = 0,
    transaction_type: Optional[TransactionType] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get current user's coin transaction history."""
    transactions = await coin_service.get_transaction_history(
        session,
        current_user.id,
        limit=limit,
        offset=offset,
        transaction_type=transaction_type
    )

    return {
        "user_id": str(current_user.id),
        "transactions": transactions,
        "limit": limit,
        "offset": offset
    }


@router.post("/subscription/upgrade")
async def upgrade_my_subscription(
    request: UpgradeSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Upgrade current user's subscription.
    In production, this should be called after successful payment processing.
    """
    try:
        subscription = await subscription_service.upgrade_subscription(
            session,
            current_user.id,
            request.tier,
            request.stripe_subscription_id
        )
        return subscription
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/subscription/cancel")
async def cancel_my_subscription(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Cancel current user's subscription and downgrade to free tier."""
    try:
        subscription = await subscription_service.cancel_subscription(
            session,
            current_user.id
        )
        return subscription
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Admin endpoints
@router.get("/admin/users/{user_id}/subscription")
async def get_user_subscription(
    user_id: UUID,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """Get any user's subscription details (admin only)."""
    subscription = await subscription_service.get_user_subscription(session, user_id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User or subscription not found"
        )

    return subscription


@router.post("/admin/users/{user_id}/subscription/upgrade")
async def admin_upgrade_subscription(
    user_id: UUID,
    request: UpgradeSubscriptionRequest,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """Upgrade any user's subscription (admin only)."""
    try:
        subscription = await subscription_service.upgrade_subscription(
            session,
            user_id,
            request.tier,
            request.stripe_subscription_id
        )
        return subscription
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/admin/coins/allocate")
async def admin_allocate_coins(
    request: AllocateCoinsRequest,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """Allocate coins to a user (admin only)."""
    try:
        transaction = await coin_service.allocate_coins(
            session,
            request.user_id,
            request.amount,
            f"[ADMIN] {request.description}",
            meta_data={"admin_id": str(admin_user.id)}
        )

        return {
            "transaction_id": str(transaction.id),
            "user_id": str(request.user_id),
            "amount": request.amount,
            "balance_after": transaction.balance_after,
            "description": transaction.description
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/admin/coins/adjust")
async def admin_adjust_coins(
    request: AdjustCoinsRequest,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """Adjust coins for a user - can be positive or negative (admin only)."""
    try:
        transaction = await coin_service.adjust_coins(
            session,
            request.user_id,
            request.amount,
            f"[ADMIN] {request.description}",
            meta_data={"admin_id": str(admin_user.id)}
        )

        return {
            "transaction_id": str(transaction.id),
            "user_id": str(request.user_id),
            "amount": request.amount,
            "balance_after": transaction.balance_after,
            "description": transaction.description
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/admin/users/{user_id}/transactions")
async def admin_get_user_transactions(
    user_id: UUID,
    limit: int = 100,
    offset: int = 0,
    transaction_type: Optional[TransactionType] = None,
    admin_user: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """Get any user's coin transaction history (admin only)."""
    transactions = await coin_service.get_transaction_history(
        session,
        user_id,
        limit=limit,
        offset=offset,
        transaction_type=transaction_type
    )

    return {
        "user_id": str(user_id),
        "transactions": transactions,
        "limit": limit,
        "offset": offset
    }
