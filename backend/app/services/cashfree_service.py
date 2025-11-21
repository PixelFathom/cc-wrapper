"""
Cashfree Payment Gateway Service
Handles all interactions with Cashfree API for payment processing.
Uses direct HTTP API calls via httpx instead of SDK to avoid dependency conflicts.
"""
import hmac
import hashlib
import base64
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
import httpx
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select

from app.core.settings import get_settings
from app.models.payment import Payment, PaymentStatus, PaymentProvider
from app.models.user import User
from app.models.subscription import SubscriptionTier, TIER_CONFIG, CREDIT_PACKAGES, get_credit_package


class CashfreeService:
    """Service for Cashfree payment gateway operations."""

    def __init__(self):
        self.settings = get_settings()
        self._configure_cashfree()

    def _configure_cashfree(self):
        """Configure Cashfree API client with credentials from settings."""
        # Set base URL based on environment
        self.base_url = (
            "https://sandbox.cashfree.com"
            if self.settings.cashfree_environment == "sandbox"
            else "https://api.cashfree.com"
        )

        # Set API version
        self.api_version = self.settings.cashfree_api_version

        # Prepare headers for API requests
        self.headers = {
            "x-client-id": self.settings.cashfree_app_id,
            "x-client-secret": self.settings.cashfree_secret_key,
            "x-api-version": self.api_version,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _get_api_url(self, path: str) -> str:
        """Get full API URL for a given path."""
        return f"{self.base_url}{path}"

    async def create_order(
        self,
        session: AsyncSession,
        user: User,
        package_id: str,
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Cashfree payment order for credit purchase.

        Args:
            session: Database session
            user: User making the payment
            package_id: Credit package ID (basic/standard/pro)
            return_url: URL to redirect after payment (optional)
            cancel_url: URL to redirect if payment cancelled (optional)

        Returns:
            Dictionary containing order details including order_id and payment_session_id

        Raises:
            ValueError: If package_id is invalid or user details incomplete
            Exception: If Cashfree API call fails
        """
        # Get credit package
        package = get_credit_package(package_id)
        if not package:
            raise ValueError(f"Invalid credit package: {package_id}")

        amount = package["price"]
        credits = package["credits"]

        if amount <= 0:
            raise ValueError("Cannot create order for free package")

        # Validate user details
        if not user.email:
            raise ValueError("User email is required for payment")

        # Generate unique order ID
        order_id = f"ORDER_{user.id}_{package_id}_{int(datetime.utcnow().timestamp())}"

        # Calculate order expiry (30 minutes from now)
        order_expiry = datetime.utcnow() + timedelta(minutes=30)

        # Create order request payload
        order_request = {
            "order_id": order_id,
            "order_amount": float(amount),
            "order_currency": "INR",  # Cashfree TEST accounts only support INR
            "customer_details": {
                "customer_id": str(user.id),
                "customer_email": user.email,
                "customer_phone": user.phone or "+10000000000",  # Default if not provided
                "customer_name": user.github_name or user.github_login,
            },
            "order_meta": {
                "return_url": return_url or f"{self.settings.backend_host}/payment/success",
                "notify_url": f"{self.settings.webhook_base_url}/api/webhooks/cashfree",
            },
            "order_expiry_time": order_expiry.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "order_note": f"Credit purchase: {package['name']} ({credits} credits)",
        }

        # Call Cashfree API
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._get_api_url("/pg/orders"),
                    headers=self.headers,
                    json=order_request,
                    timeout=30.0,
                )

                if response.status_code != 200:
                    error_msg = response.text
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", error_msg)
                    except:
                        pass
                    raise Exception(f"Cashfree API error ({response.status_code}): {error_msg}")

                order_dict = response.json()

            # Create payment record in database
            payment = Payment(
                user_id=user.id,
                payment_provider=PaymentProvider.CASHFREE,
                order_id=order_id,
                payment_session_id=order_dict.get("payment_session_id"),
                amount=float(amount),
                currency="INR",
                status=PaymentStatus.PENDING,
                subscription_tier=package_id,  # Store package_id instead of tier
                customer_email=user.email,
                customer_phone=user.phone,
                payment_initiated_at=datetime.utcnow(),
                meta_data={
                    "package_id": package_id,
                    "package_name": package["name"],
                    "credits": credits,
                    "cashfree_order": order_dict,
                },
            )

            session.add(payment)
            await session.commit()
            await session.refresh(payment)

            return {
                "order_id": order_id,
                "payment_session_id": order_dict.get("payment_session_id"),
                "amount": amount,
                "currency": "INR",
                "package_id": package_id,
                "package_name": package["name"],
                "credits": credits,
                "created_at": payment.created_at.isoformat(),
            }

        except Exception as e:
            raise Exception(f"Failed to create Cashfree order: {str(e)}")

    async def verify_payment(
        self,
        session: AsyncSession,
        order_id: str,
    ) -> Payment:
        """
        Verify payment status from Cashfree and update database.

        Args:
            session: Database session
            order_id: Cashfree order ID

        Returns:
            Updated Payment object

        Raises:
            ValueError: If order not found
            Exception: If Cashfree API call fails
        """
        # Get payment from database
        result = await session.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            raise ValueError(f"Payment order not found: {order_id}")

        try:
            # Fetch order details from Cashfree
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url(f"/pg/orders/{order_id}"),
                    headers=self.headers,
                    timeout=30.0,
                )

                if response.status_code != 200:
                    error_msg = response.text
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", error_msg)
                    except:
                        pass
                    raise Exception(f"Cashfree API error ({response.status_code}): {error_msg}")

                order_dict = response.json()

            order_status = order_dict.get("order_status", "").upper()

            # Update payment based on Cashfree status
            if order_status == "PAID":
                payment.status = PaymentStatus.SUCCESS
                payment.payment_completed_at = datetime.utcnow()
                payment.transaction_id = order_dict.get("cf_payment_id")
                payment.payment_method = order_dict.get("payment_method")
                payment.bank_reference = order_dict.get("bank_reference")

            elif order_status in ["EXPIRED", "CANCELLED"]:
                payment.status = PaymentStatus(order_status.lower())
                payment.payment_failed_at = datetime.utcnow()

            elif order_status == "FAILED":
                payment.status = PaymentStatus.FAILED
                payment.payment_failed_at = datetime.utcnow()
                payment.error_message = order_dict.get("error_details", {}).get("error_description")
                payment.error_code = order_dict.get("error_details", {}).get("error_code")

            elif order_status == "ACTIVE":
                payment.status = PaymentStatus.ACTIVE

            # Update metadata
            if payment.meta_data:
                payment.meta_data["cashfree_verification"] = order_dict
            else:
                payment.meta_data = {"cashfree_verification": order_dict}

            payment.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(payment)

            return payment

        except Exception as e:
            raise Exception(f"Failed to verify payment: {str(e)}")

    def verify_webhook_signature(
        self,
        raw_body: str,
        signature: str,
        timestamp: str,
    ) -> bool:
        """
        Verify Cashfree webhook signature for security.

        According to Cashfree official documentation:
        - Use the raw request body (not parsed JSON)
        - Concatenate: timestamp + rawBody (no separator)
        - Calculate: Base64(HMAC_SHA256(timestamp + rawBody, secretKey))
        - Use Cashfree SECRET KEY (not webhook secret)

        Reference:
        - https://github.com/cashfree/cashfree-pg-webhook
        - https://www.cashfree.com/docs/api-reference/vrs/webhook-signature-verification

        Args:
            raw_body: Raw request body as string
            signature: Signature from x-webhook-signature header
            timestamp: Timestamp from x-webhook-timestamp header

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Create signed payload: timestamp + raw_body (direct concatenation)
            signed_payload = timestamp + raw_body

            # Calculate HMAC SHA256 using Cashfree SECRET KEY
            hmac_digest = hmac.new(
                self.settings.cashfree_secret_key.encode(),
                signed_payload.encode(),
                hashlib.sha256
            ).digest()

            # Base64 encode the HMAC digest
            calculated_signature = base64.b64encode(hmac_digest).decode()

            # Compare signatures securely
            is_valid = hmac.compare_digest(calculated_signature, signature)

            if not is_valid:
                # Log for debugging (without exposing secrets)
                print(f"Webhook signature verification failed")
                print(f"Expected signature: {calculated_signature[:20]}...")
                print(f"Received signature: {signature[:20]}...")

            return is_valid

        except Exception as e:
            print(f"Error verifying webhook signature: {str(e)}")
            return False

    async def process_webhook(
        self,
        session: AsyncSession,
        payload: Dict[str, Any],
    ) -> Payment:
        """
        Process Cashfree webhook notification.

        Args:
            session: Database session
            payload: Webhook payload from Cashfree

        Returns:
            Updated Payment object

        Raises:
            ValueError: If order not found or payload invalid
        """
        # Extract order details from webhook
        webhook_data = payload.get("data", {})
        order = webhook_data.get("order", {})
        payment_data = webhook_data.get("payment", {})

        order_id = order.get("order_id")
        if not order_id:
            raise ValueError("Invalid webhook payload: missing order_id")

        # Get payment from database
        result = await session.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            raise ValueError(f"Payment order not found: {order_id}")

        # Update webhook tracking
        payment.webhook_count += 1
        payment.webhook_received_at = datetime.utcnow()

        # Update payment status based on webhook event
        order_status = order.get("order_status", "").upper()

        if order_status == "PAID":
            payment.status = PaymentStatus.SUCCESS
            payment.payment_completed_at = datetime.utcnow()
            payment.transaction_id = payment_data.get("cf_payment_id")
            payment.payment_method = payment_data.get("payment_method")
            payment.bank_reference = payment_data.get("bank_reference")

        elif order_status in ["EXPIRED", "CANCELLED"]:
            payment.status = PaymentStatus(order_status.lower())
            payment.payment_failed_at = datetime.utcnow()

        elif order_status == "FAILED":
            payment.status = PaymentStatus.FAILED
            payment.payment_failed_at = datetime.utcnow()
            error_details = payment_data.get("payment_message", "")
            payment.error_message = error_details

        # Update metadata with webhook data
        if payment.meta_data:
            webhooks = payment.meta_data.get("webhooks", [])
            webhooks.append({
                "received_at": datetime.utcnow().isoformat(),
                "payload": payload
            })
            payment.meta_data["webhooks"] = webhooks
        else:
            payment.meta_data = {
                "webhooks": [{
                    "received_at": datetime.utcnow().isoformat(),
                    "payload": payload
                }]
            }

        payment.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(payment)

        return payment

    async def initiate_refund(
        self,
        session: AsyncSession,
        order_id: str,
        refund_amount: Optional[float] = None,
        refund_note: Optional[str] = None,
    ) -> Payment:
        """
        Initiate a refund for a successful payment.

        Args:
            session: Database session
            order_id: Cashfree order ID
            refund_amount: Amount to refund (None for full refund)
            refund_note: Note for the refund

        Returns:
            Updated Payment object

        Raises:
            ValueError: If payment not found or not eligible for refund
            ApiException: If Cashfree API call fails
        """
        # Get payment from database
        result = await session.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            raise ValueError(f"Payment order not found: {order_id}")

        if payment.status != PaymentStatus.SUCCESS:
            raise ValueError(f"Cannot refund payment with status: {payment.status}")

        # Determine refund amount (full refund if not specified)
        refund_amt = refund_amount if refund_amount is not None else payment.amount

        if refund_amt > payment.amount:
            raise ValueError("Refund amount cannot exceed payment amount")

        try:
            # Call Cashfree refund API
            # Note: Cashfree refund API implementation depends on SDK version
            # This is a placeholder for the actual implementation

            # For now, mark as refund initiated
            payment.status = PaymentStatus.REFUNDED
            payment.refund_initiated_at = datetime.utcnow()
            payment.refund_amount = refund_amt
            payment.refund_completed_at = datetime.utcnow()  # Will be updated by webhook

            # Update metadata
            if payment.meta_data:
                payment.meta_data["refund"] = {
                    "initiated_at": datetime.utcnow().isoformat(),
                    "amount": refund_amt,
                    "note": refund_note,
                }
            else:
                payment.meta_data = {
                    "refund": {
                        "initiated_at": datetime.utcnow().isoformat(),
                        "amount": refund_amt,
                        "note": refund_note,
                    }
                }

            await session.commit()
            await session.refresh(payment)

            return payment

        except Exception as e:
            raise Exception(f"Failed to initiate refund: {str(e)}")

    async def get_payment_by_order_id(
        self,
        session: AsyncSession,
        order_id: str,
    ) -> Optional[Payment]:
        """
        Get payment by Cashfree order ID.

        Args:
            session: Database session
            order_id: Cashfree order ID

        Returns:
            Payment object or None if not found
        """
        result = await session.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_user_payments(
        self,
        session: AsyncSession,
        user_id: UUID,
        status: Optional[PaymentStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Payment]:
        """
        Get all payments for a user.

        Args:
            session: Database session
            user_id: User ID
            status: Filter by payment status (optional)
            limit: Maximum number of payments to return
            offset: Number of payments to skip

        Returns:
            List of Payment objects
        """
        query = select(Payment).where(Payment.user_id == user_id)

        if status:
            query = query.where(Payment.status == status)

        query = query.order_by(Payment.created_at.desc()).limit(limit).offset(offset)

        result = await session.execute(query)
        return list(result.scalars().all())


# Singleton instance
_cashfree_service: Optional[CashfreeService] = None


def get_cashfree_service() -> CashfreeService:
    """Get or create Cashfree service singleton."""
    global _cashfree_service
    if _cashfree_service is None:
        _cashfree_service = CashfreeService()
    return _cashfree_service
