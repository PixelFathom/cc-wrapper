"""
Subscription service for managing user subscription tiers and feature access.
"""
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import logging

from app.models import User, SubscriptionTier, Feature, is_feature_enabled, TIER_CONFIG, get_credit_package, calculate_credit_expiry_date
from app.services.coin_service import CoinService

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Service for managing user subscriptions and feature access."""

    @staticmethod
    async def get_user_subscription(
        session: AsyncSession,
        user_id: UUID
    ) -> Optional[dict]:
        """Get user's subscription details."""
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        tier_config = TIER_CONFIG.get(user.subscription_tier, {})

        return {
            "user_id": str(user.id),
            "subscription_tier": user.subscription_tier,
            "tier_name": tier_config.get("name", "Unknown"),
            "coins_balance": user.coins_balance,
            "coins_total_allocated": user.coins_total_allocated,
            "coins_total_used": user.coins_total_used,
            "subscription_start_date": user.subscription_start_date.isoformat() if user.subscription_start_date else None,
            "subscription_end_date": user.subscription_end_date.isoformat() if user.subscription_end_date else None,
            "subscription_renews_at": user.subscription_renews_at.isoformat() if user.subscription_renews_at else None,
            "enabled_features": [
                feature.value for feature in Feature
                if is_feature_enabled(user.subscription_tier, feature)
            ]
        }

    @staticmethod
    async def check_feature_access(
        session: AsyncSession,
        user_id: UUID,
        feature: Feature
    ) -> bool:
        """Check if user has access to a specific feature."""
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False

        # Admins have access to all features
        if user.is_admin:
            return True

        return is_feature_enabled(user.subscription_tier, feature)

    @staticmethod
    async def upgrade_subscription(
        session: AsyncSession,
        user_id: UUID,
        new_tier: SubscriptionTier,
        stripe_subscription_id: Optional[str] = None
    ) -> dict:
        """
        Upgrade user subscription to a new tier.
        Allocates coins based on the new tier.
        """
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        old_tier = user.subscription_tier
        tier_config = TIER_CONFIG.get(new_tier, {})

        # Update subscription tier
        user.subscription_tier = new_tier
        user.subscription_start_date = datetime.utcnow()
        user.subscription_renews_at = datetime.utcnow() + timedelta(days=30)  # Monthly renewal

        if stripe_subscription_id:
            user.stripe_subscription_id = stripe_subscription_id

        # Allocate coins for the new tier
        coins_to_allocate = tier_config.get("coins", 0)
        if coins_to_allocate:
            await CoinService.allocate_coins(
                session,
                user_id,
                coins_to_allocate,
                f"Subscription upgraded from {old_tier} to {new_tier}"
            )

        session.add(user)
        await session.commit()
        await session.refresh(user)

        logger.info(
            f"📈 Subscription upgraded | "
            f"user_id={str(user_id)[:8]}... | "
            f"old_tier={old_tier} | "
            f"new_tier={new_tier} | "
            f"coins_allocated={coins_to_allocate}"
        )

        return await SubscriptionService.get_user_subscription(session, user_id)

    @staticmethod
    async def downgrade_subscription(
        session: AsyncSession,
        user_id: UUID,
        new_tier: SubscriptionTier
    ) -> dict:
        """
        Downgrade user subscription to a lower tier.
        Does not remove existing coins, but updates feature access.
        """
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        old_tier = user.subscription_tier

        # Update subscription tier
        user.subscription_tier = new_tier
        user.subscription_end_date = datetime.utcnow()

        session.add(user)
        await session.commit()
        await session.refresh(user)

        logger.info(
            f"📉 Subscription downgraded | "
            f"user_id={str(user_id)[:8]}... | "
            f"old_tier={old_tier} | "
            f"new_tier={new_tier}"
        )

        return await SubscriptionService.get_user_subscription(session, user_id)

    @staticmethod
    async def cancel_subscription(
        session: AsyncSession,
        user_id: UUID
    ) -> dict:
        """
        Cancel user subscription and downgrade to free tier.
        """
        return await SubscriptionService.downgrade_subscription(
            session,
            user_id,
            SubscriptionTier.FREE
        )

    @staticmethod
    async def renew_subscription(
        session: AsyncSession,
        user_id: UUID
    ) -> dict:
        """
        Renew user subscription for another billing period.
        Allocates monthly coins based on current tier.
        """
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        tier_config = TIER_CONFIG.get(user.subscription_tier, {})

        # Update renewal date
        user.subscription_renews_at = datetime.utcnow() + timedelta(days=30)

        # Allocate monthly coins
        coins_to_allocate = tier_config.get("coins", 0)
        if coins_to_allocate:
            await CoinService.allocate_coins(
                session,
                user_id,
                coins_to_allocate,
                f"Monthly renewal for {user.subscription_tier} tier"
            )

        session.add(user)
        await session.commit()
        await session.refresh(user)

        logger.info(
            f"🔄 Subscription renewed | "
            f"user_id={str(user_id)[:8]}... | "
            f"tier={user.subscription_tier} | "
            f"coins_allocated={coins_to_allocate}"
        )

        return await SubscriptionService.get_user_subscription(session, user_id)

    @staticmethod
    async def purchase_credits(
        session: AsyncSession,
        user_id: UUID,
        package_id: str
    ) -> dict:
        """
        Purchase a credit package for a user.
        Allocates credits with 30-day expiration and upgrades to PREMIUM tier.

        Args:
            session: Database session
            user_id: User purchasing credits
            package_id: Credit package ID (basic/standard/pro)

        Returns:
            Dict with purchase details and new subscription status
        """
        # Get package details
        package = get_credit_package(package_id)
        if not package:
            raise ValueError(f"Invalid package ID: {package_id}")

        # Get user
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Calculate expiration date (30 days from now)
        purchase_date = datetime.utcnow()
        expires_at = calculate_credit_expiry_date(
            purchase_date,
            package.get("validity_days", 30)
        )

        # Allocate credits with expiration
        credits = package.get("credits", 0)
        await CoinService.allocate_coins(
            session=session,
            user_id=user_id,
            amount=credits,
            description=f"Purchased {package['name']} ({credits} credits)",
            meta_data={
                "package_id": package_id,
                "package_name": package["name"],
                "price": package["price"],
                "currency": package["currency"]
            },
            expires_at=expires_at,
            package_id=package_id
        )

        # Upgrade to PREMIUM tier if not already
        old_tier = user.subscription_tier
        if user.subscription_tier != SubscriptionTier.PREMIUM:
            user.subscription_tier = SubscriptionTier.PREMIUM
            user.subscription_start_date = datetime.utcnow()
            session.add(user)
            await session.commit()
            await session.refresh(user)

            logger.info(
                f"⬆️ User upgraded to PREMIUM | "
                f"user_id={str(user_id)[:8]}... | "
                f"old_tier={old_tier.value} | "
                f"reason=credit_purchase"
            )

        logger.info(
            f"💳 Credits purchased | "
            f"user_id={str(user_id)[:8]}... | "
            f"package={package_id} | "
            f"credits={credits} | "
            f"expires_at={expires_at.isoformat()}"
        )

        return {
            "user_id": str(user_id),
            "package_id": package_id,
            "package_name": package["name"],
            "credits_purchased": credits,
            "price": package["price"],
            "currency": package["currency"],
            "expires_at": expires_at.isoformat(),
            "subscription_tier": user.subscription_tier.value,
            "new_balance": user.coins_balance
        }


subscription_service = SubscriptionService()
