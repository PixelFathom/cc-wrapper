"""
Credit Expiration Service
Handles expiration of purchased credits after their validity period.
"""
from typing import Dict, List
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import logging

from app.models import User, CoinTransaction, TransactionType, SubscriptionTier

logger = logging.getLogger(__name__)


class CreditExpirationService:
    """Service for managing credit expiration."""

    @staticmethod
    async def expire_old_credits(session: AsyncSession) -> Dict[str, int]:
        """
        Expire credits that have passed their expiration date.
        This should be run as a daily cron job.

        Returns:
            Dict with statistics: total_expired, total_amount, users_affected
        """
        now = datetime.now(timezone.utc)

        # Find all non-expired ALLOCATION transactions with expiration date in the past
        query = select(CoinTransaction).where(
            CoinTransaction.transaction_type == TransactionType.ALLOCATION,
            CoinTransaction.expired == False,
            CoinTransaction.expires_at.isnot(None),
            CoinTransaction.expires_at <= now
        )

        result = await session.execute(query)
        expired_transactions = result.scalars().all()

        if not expired_transactions:
            logger.info("No credits to expire")
            return {
                "total_expired": 0,
                "total_amount": 0,
                "users_affected": 0
            }

        # Group by user to process efficiently
        users_credits = {}
        for transaction in expired_transactions:
            user_id = transaction.user_id
            if user_id not in users_credits:
                users_credits[user_id] = []
            users_credits[user_id].append(transaction)

        total_expired = 0
        total_amount = 0
        users_affected = len(users_credits)

        # Process each user's expired credits
        for user_id, transactions in users_credits.items():
            # Get user
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()

            if not user:
                logger.warning(f"User {user_id} not found, skipping expired credits")
                continue

            # Calculate total expired amount for this user
            user_expired_amount = sum(t.amount for t in transactions)

            # Deduct expired credits from user balance
            user.coins_balance = max(0, user.coins_balance - user_expired_amount)

            # Mark transactions as expired
            for transaction in transactions:
                transaction.expired = True
                transaction.expired_at = now
                session.add(transaction)

            # Create expiry transaction record
            expiry_transaction = CoinTransaction(
                user_id=user_id,
                amount=-user_expired_amount,
                transaction_type=TransactionType.EXPIRY,
                description=f"Credit expiration: {len(transactions)} package(s) expired",
                balance_after=user.coins_balance,
                meta_data={
                    "expired_transaction_ids": [str(t.id) for t in transactions],
                    "expired_packages": [t.package_id for t in transactions if t.package_id]
                }
            )

            session.add(user)
            session.add(expiry_transaction)

            total_expired += len(transactions)
            total_amount += user_expired_amount

            logger.info(
                f"⏰ Credits expired | "
                f"user_id={str(user_id)[:8]}... | "
                f"amount={user_expired_amount} | "
                f"new_balance={user.coins_balance} | "
                f"packages_expired={len(transactions)}"
            )

            # Check if user should be downgraded to FREE tier
            await CreditExpirationService._update_user_premium_status(session, user)

        await session.commit()

        logger.info(
            f"✅ Credit expiration complete | "
            f"total_expired={total_expired} | "
            f"total_amount={total_amount} | "
            f"users_affected={users_affected}"
        )

        return {
            "total_expired": total_expired,
            "total_amount": total_amount,
            "users_affected": users_affected
        }

    @staticmethod
    async def _update_user_premium_status(session: AsyncSession, user: User) -> None:
        """
        Update user's premium status based on their credit balance.
        If user has no credits, downgrade to FREE tier.
        """
        if user.coins_balance <= 0:
            # User has no credits, downgrade to FREE
            if user.subscription_tier != SubscriptionTier.FREE:
                old_tier = user.subscription_tier
                user.subscription_tier = SubscriptionTier.FREE
                session.add(user)

                logger.info(
                    f"⬇️ User downgraded to FREE | "
                    f"user_id={str(user.id)[:8]}... | "
                    f"old_tier={old_tier.value} | "
                    f"reason=no_credits"
                )
        else:
            # User still has credits, ensure PREMIUM tier
            if user.subscription_tier == SubscriptionTier.FREE:
                user.subscription_tier = SubscriptionTier.PREMIUM
                session.add(user)

                logger.info(
                    f"⬆️ User upgraded to PREMIUM | "
                    f"user_id={str(user.id)[:8]}... | "
                    f"reason=has_credits"
                )

    @staticmethod
    async def get_expiring_soon(
        session: AsyncSession,
        days: int = 7
    ) -> List[Dict]:
        """
        Get credits that will expire within the specified number of days.
        Useful for sending expiration warnings to users.

        Args:
            session: Database session
            days: Number of days to look ahead (default: 7)

        Returns:
            List of dicts with user_id, amount, expires_at, package_id
        """
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        future = now + timedelta(days=days)

        query = select(CoinTransaction).where(
            CoinTransaction.transaction_type == TransactionType.ALLOCATION,
            CoinTransaction.expired == False,
            CoinTransaction.expires_at.isnot(None),
            CoinTransaction.expires_at > now,
            CoinTransaction.expires_at <= future
        ).order_by(CoinTransaction.expires_at)

        result = await session.execute(query)
        expiring_transactions = result.scalars().all()

        return [
            {
                "user_id": str(transaction.user_id),
                "amount": transaction.amount,
                "expires_at": transaction.expires_at.isoformat(),
                "package_id": transaction.package_id,
                "days_remaining": (transaction.expires_at - now).days
            }
            for transaction in expiring_transactions
        ]

    @staticmethod
    async def get_user_active_credits(
        session: AsyncSession,
        user_id
    ) -> List[Dict]:
        """
        Get all active (non-expired) credit allocations for a user.
        Shows when each batch of credits will expire.

        Args:
            session: Database session
            user_id: User UUID

        Returns:
            List of active credit allocations with expiration info
        """
        from uuid import UUID

        if isinstance(user_id, str):
            user_id = UUID(user_id)

        now = datetime.now(timezone.utc)

        query = select(CoinTransaction).where(
            CoinTransaction.user_id == user_id,
            CoinTransaction.transaction_type == TransactionType.ALLOCATION,
            CoinTransaction.expired == False,
            CoinTransaction.expires_at.isnot(None),
            CoinTransaction.expires_at > now
        ).order_by(CoinTransaction.expires_at)

        result = await session.execute(query)
        active_transactions = result.scalars().all()

        return [
            {
                "id": str(transaction.id),
                "amount": transaction.amount,
                "package_id": transaction.package_id,
                "purchased_at": transaction.created_at.isoformat(),
                "expires_at": transaction.expires_at.isoformat(),
                "days_remaining": (transaction.expires_at - now).days,
                "description": transaction.description
            }
            for transaction in active_transactions
        ]


credit_expiration_service = CreditExpirationService()
