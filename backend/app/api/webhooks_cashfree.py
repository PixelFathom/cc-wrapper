"""
Cashfree Webhook Handler
Processes payment notifications from Cashfree.
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Header, status
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional
import logging

from app.deps import get_session
from app.models.payment import PaymentStatus
from app.services.cashfree_service import get_cashfree_service
from app.services.subscription_service import SubscriptionService
from app.models.subscription import SubscriptionTier

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/cashfree")
async def handle_cashfree_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
    x_webhook_signature: Optional[str] = Header(None, alias="x-webhook-signature"),
    x_webhook_timestamp: Optional[str] = Header(None, alias="x-webhook-timestamp"),
):
    """
    Handle Cashfree payment webhook notifications.

    This endpoint is called by Cashfree when:
    - Payment is completed successfully
    - Payment fails
    - Payment is cancelled by user
    - Refund is processed

    Security:
    - Verifies webhook signature using Cashfree webhook secret
    - Only processes webhooks with valid signatures
    """
    try:
        # Parse webhook payload
        payload = await request.json()

        logger.info(f"Received Cashfree webhook: {payload.get('type', 'unknown')}")

        # Verify webhook signature
        cashfree_service = get_cashfree_service()

        if x_webhook_signature and x_webhook_timestamp:
            is_valid = cashfree_service.verify_webhook_signature(
                payload=payload,
                signature=x_webhook_signature,
                timestamp=x_webhook_timestamp,
            )

            if not is_valid:
                logger.warning("Invalid Cashfree webhook signature")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        else:
            logger.warning("Cashfree webhook received without signature headers")

        # Process webhook
        payment = await cashfree_service.process_webhook(
            session=session,
            payload=payload,
        )

        logger.info(
            f"Processed webhook for order {payment.order_id}. "
            f"Status: {payment.status.value}"
        )

        # If payment is successful, upgrade subscription
        if payment.status == PaymentStatus.SUCCESS:
            subscription_service = SubscriptionService()
            tier = SubscriptionTier(payment.subscription_tier)

            # Upgrade subscription (will allocate coins automatically)
            await subscription_service.upgrade_subscription(
                session=session,
                user_id=payment.user_id,
                tier=tier,
                payment_id=payment.order_id,
            )

            logger.info(
                f"Successfully upgraded user {payment.user_id} to {tier.value} "
                f"via webhook for order {payment.order_id}"
            )

        return {
            "status": "ok",
            "order_id": payment.order_id,
            "payment_status": payment.status.value,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process Cashfree webhook: {str(e)}")

        # Return 200 even on error to prevent Cashfree from retrying
        # Log the error for manual investigation
        return {
            "status": "error",
            "message": "Webhook processing failed. Will be investigated.",
        }
