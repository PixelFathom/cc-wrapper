"""
Cashfree Webhook Handler
Processes payment notifications from Cashfree.
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Header, status
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional
import logging
import json

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
    - PAYMENT_SUCCESS_WEBHOOK: Payment is completed successfully
    - PAYMENT_FAILED_WEBHOOK: Payment fails
    - PAYMENT_USER_DROPPED_WEBHOOK: User abandons payment checkout

    Security:
    - Verifies webhook signature using Cashfree secret key (NOT webhook secret)
    - Uses raw request body for signature verification as per Cashfree docs
    - Formula: Base64(HMAC_SHA256(timestamp + rawBody, secretKey))

    Reference: https://github.com/cashfree/cashfree-pg-webhook
    """
    try:
        # Get raw request body for signature verification
        # IMPORTANT: Must get raw body BEFORE parsing JSON
        raw_body = await request.body()
        raw_body_str = raw_body.decode('utf-8')

        # Parse webhook payload from raw body
        payload = json.loads(raw_body_str)

        logger.info(f"Received Cashfree webhook: {payload.get('type', 'unknown')}")

        # Verify webhook signature using Cashfree's recommended method
        cashfree_service = get_cashfree_service()

        if x_webhook_signature and x_webhook_timestamp:
            is_valid = cashfree_service.verify_webhook_signature(
                raw_body=raw_body_str,
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

        # If payment is successful, purchase credits
        if payment.status == PaymentStatus.SUCCESS:
            subscription_service = SubscriptionService()
            package_id = payment.subscription_tier  # Now stores package_id

            # Purchase credits (will allocate with expiration and upgrade to PREMIUM)
            await subscription_service.purchase_credits(
                session=session,
                user_id=payment.user_id,
                package_id=package_id,
            )

            logger.info(
                f"Successfully purchased credits for user {payment.user_id} with package {package_id} "
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
