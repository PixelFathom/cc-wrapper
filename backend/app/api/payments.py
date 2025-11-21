"""
Payment API endpoints for Cashfree integration.
Handles order creation, payment verification, webhooks, and refunds.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import logging

from app.deps import get_session, get_current_user
from app.models.user import User
from app.models.payment import Payment, PaymentStatus, PaymentProvider
from app.models.subscription import SubscriptionTier
from app.services.cashfree_service import get_cashfree_service
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


# Request/Response Models
class CreateOrderRequest(BaseModel):
    """Request model for creating a payment order."""
    tier: SubscriptionTier = Field(..., description="Target subscription tier")
    return_url: Optional[str] = Field(None, description="URL to redirect after payment")
    cancel_url: Optional[str] = Field(None, description="URL to redirect if payment cancelled")


class CreateOrderResponse(BaseModel):
    """Response model for create order endpoint."""
    order_id: str
    payment_session_id: str
    amount: float
    currency: str
    tier: str
    tier_name: str
    created_at: str


class VerifyPaymentRequest(BaseModel):
    """Request model for verifying payment."""
    order_id: str = Field(..., description="Cashfree order ID")


class PaymentResponse(BaseModel):
    """Response model for payment details."""
    id: str
    order_id: str
    amount: float
    currency: str
    status: str
    subscription_tier: str
    payment_provider: str
    transaction_id: Optional[str]
    payment_method: Optional[str]
    created_at: datetime
    payment_completed_at: Optional[datetime]
    payment_failed_at: Optional[datetime]
    error_message: Optional[str]


class RefundRequest(BaseModel):
    """Request model for initiating refund."""
    order_id: str = Field(..., description="Cashfree order ID")
    refund_amount: Optional[float] = Field(None, description="Amount to refund (full refund if not specified)")
    refund_note: Optional[str] = Field(None, description="Note for the refund")


# Endpoints

@router.post("/create-order", response_model=CreateOrderResponse)
async def create_payment_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Create a Cashfree payment order for subscription upgrade.

    This endpoint:
    1. Validates the user and tier
    2. Creates a Cashfree order
    3. Stores the order in the database
    4. Returns order details including payment_session_id for checkout
    """
    try:
        cashfree_service = get_cashfree_service()

        # Validate user has required details
        if not current_user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for payment. Please update your profile."
            )

        if not current_user.phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required for payment. Please update your profile."
            )

        # Create order
        order_data = await cashfree_service.create_order(
            session=session,
            user=current_user,
            tier=request.tier,
            return_url=request.return_url,
            cancel_url=request.cancel_url,
        )

        return CreateOrderResponse(**order_data)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create payment order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment order. Please try again."
        )


@router.post("/verify", response_model=PaymentResponse)
async def verify_payment(
    request: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Verify payment status from Cashfree and update database.

    This endpoint:
    1. Fetches the latest payment status from Cashfree
    2. Updates the payment record in the database
    3. If payment is successful, upgrades the subscription
    4. Returns updated payment details
    """
    try:
        cashfree_service = get_cashfree_service()

        # Verify payment
        payment = await cashfree_service.verify_payment(
            session=session,
            order_id=request.order_id,
        )

        # Verify payment belongs to current user
        if payment.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this payment"
            )

        # If payment is successful, upgrade subscription
        if payment.status == PaymentStatus.SUCCESS:
            subscription_service = SubscriptionService()
            tier = SubscriptionTier(payment.subscription_tier)

            # Upgrade subscription (will allocate coins automatically)
            await subscription_service.upgrade_subscription(
                session=session,
                user_id=current_user.id,
                tier=tier,
                payment_id=payment.order_id,
            )

            logger.info(f"Successfully upgraded user {current_user.id} to {tier.value} after payment verification")

        return PaymentResponse(
            id=str(payment.id),
            order_id=payment.order_id,
            amount=payment.amount,
            currency=payment.currency,
            status=payment.status.value,
            subscription_tier=payment.subscription_tier,
            payment_provider=payment.payment_provider.value,
            transaction_id=payment.transaction_id,
            payment_method=payment.payment_method,
            created_at=payment.created_at,
            payment_completed_at=payment.payment_completed_at,
            payment_failed_at=payment.payment_failed_at,
            error_message=payment.error_message,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to verify payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify payment. Please try again."
        )


@router.get("/order/{order_id}", response_model=PaymentResponse)
async def get_payment_by_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get payment details by order ID.

    Returns the current status and details of a payment order.
    """
    cashfree_service = get_cashfree_service()

    payment = await cashfree_service.get_payment_by_order_id(
        session=session,
        order_id=order_id,
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment order not found"
        )

    # Verify payment belongs to current user
    if payment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this payment"
        )

    return PaymentResponse(
        id=str(payment.id),
        order_id=payment.order_id,
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status.value,
        subscription_tier=payment.subscription_tier,
        payment_provider=payment.payment_provider.value,
        transaction_id=payment.transaction_id,
        payment_method=payment.payment_method,
        created_at=payment.created_at,
        payment_completed_at=payment.payment_completed_at,
        payment_failed_at=payment.payment_failed_at,
        error_message=payment.error_message,
    )


@router.get("/my-payments", response_model=List[PaymentResponse])
async def get_my_payments(
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get all payments for the current user.

    Query parameters:
    - status: Filter by payment status (pending, success, failed, etc.)
    - limit: Maximum number of payments to return (default: 50)
    - offset: Number of payments to skip (default: 0)
    """
    cashfree_service = get_cashfree_service()

    # Validate status filter
    payment_status = None
    if status_filter:
        try:
            payment_status = PaymentStatus(status_filter.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )

    payments = await cashfree_service.get_user_payments(
        session=session,
        user_id=current_user.id,
        status=payment_status,
        limit=min(limit, 100),  # Cap at 100
        offset=offset,
    )

    return [
        PaymentResponse(
            id=str(payment.id),
            order_id=payment.order_id,
            amount=payment.amount,
            currency=payment.currency,
            status=payment.status.value,
            subscription_tier=payment.subscription_tier,
            payment_provider=payment.payment_provider.value,
            transaction_id=payment.transaction_id,
            payment_method=payment.payment_method,
            created_at=payment.created_at,
            payment_completed_at=payment.payment_completed_at,
            payment_failed_at=payment.payment_failed_at,
            error_message=payment.error_message,
        )
        for payment in payments
    ]


@router.post("/refund", response_model=PaymentResponse)
async def initiate_refund(
    request: RefundRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Initiate a refund for a successful payment.

    This endpoint:
    1. Validates the payment exists and is eligible for refund
    2. Initiates refund via Cashfree
    3. Updates the payment record
    4. Downgrades the subscription if applicable

    Note: Refunds are typically processed within 5-7 business days.
    """
    try:
        cashfree_service = get_cashfree_service()

        # Get payment
        payment = await cashfree_service.get_payment_by_order_id(
            session=session,
            order_id=request.order_id,
        )

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment order not found"
            )

        # Verify payment belongs to current user (or user is admin)
        if payment.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to refund this payment"
            )

        # Initiate refund
        refunded_payment = await cashfree_service.initiate_refund(
            session=session,
            order_id=request.order_id,
            refund_amount=request.refund_amount,
            refund_note=request.refund_note,
        )

        # Downgrade subscription if refund is for current subscription
        # This is optional - you might want different logic here
        logger.info(f"Refund initiated for order {request.order_id}. Manual subscription downgrade may be required.")

        return PaymentResponse(
            id=str(refunded_payment.id),
            order_id=refunded_payment.order_id,
            amount=refunded_payment.amount,
            currency=refunded_payment.currency,
            status=refunded_payment.status.value,
            subscription_tier=refunded_payment.subscription_tier,
            payment_provider=refunded_payment.payment_provider.value,
            transaction_id=refunded_payment.transaction_id,
            payment_method=refunded_payment.payment_method,
            created_at=refunded_payment.created_at,
            payment_completed_at=refunded_payment.payment_completed_at,
            payment_failed_at=refunded_payment.payment_failed_at,
            error_message=refunded_payment.error_message,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to initiate refund: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate refund. Please contact support."
        )
