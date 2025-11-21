"""
Coin service for managing user coin allocations, deductions, and transaction history.
"""
from typing import Optional, List
from uuid import UUID
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import logging

from app.models import User, CoinTransaction, TransactionType

logger = logging.getLogger(__name__)


class InsufficientCoinsError(Exception):
    """Raised when user doesn't have enough coins for an operation."""
    pass


class CoinService:
    """Service for managing user coins and transactions."""

    @staticmethod
    async def get_balance(
        session: AsyncSession,
        user_id: UUID
    ) -> int:
        """Get user's current coin balance."""
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        return user.coins_balance

    @staticmethod
    async def allocate_coins(
        session: AsyncSession,
        user_id: UUID,
        amount: int,
        description: str,
        meta_data: Optional[dict] = None
    ) -> CoinTransaction:
        """
        Allocate coins to a user (add to their balance).
        Creates a transaction record for audit trail.
        """
        if amount <= 0:
            raise ValueError("Amount must be positive")

        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Update user balance
        user.coins_balance += amount
        user.coins_total_allocated += amount

        # Create transaction record
        transaction = CoinTransaction(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.ALLOCATION,
            description=description,
            balance_after=user.coins_balance,
            meta_data=meta_data
        )

        session.add(user)
        session.add(transaction)
        await session.commit()
        await session.refresh(transaction)

        logger.info(
            f"💰 Coins allocated | "
            f"user_id={str(user_id)[:8]}... | "
            f"amount={amount} | "
            f"new_balance={user.coins_balance} | "
            f"description={description}"
        )

        return transaction

    @staticmethod
    async def deduct_coins(
        session: AsyncSession,
        user_id: UUID,
        amount: int,
        description: str,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        meta_data: Optional[dict] = None
    ) -> CoinTransaction:
        """
        Deduct coins from a user (subtract from their balance).
        Raises InsufficientCoinsError if user doesn't have enough coins.
        Creates a transaction record for audit trail.
        """
        if amount <= 0:
            raise ValueError("Amount must be positive")

        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Check if user has enough coins
        if user.coins_balance < amount:
            raise InsufficientCoinsError(
                f"Insufficient coins. Required: {amount}, Available: {user.coins_balance}"
            )

        # Update user balance
        user.coins_balance -= amount
        user.coins_total_used += amount

        # Create transaction record
        transaction = CoinTransaction(
            user_id=user_id,
            amount=-amount,  # Negative for deduction
            transaction_type=TransactionType.USAGE,
            description=description,
            reference_id=reference_id,
            reference_type=reference_type,
            balance_after=user.coins_balance,
            meta_data=meta_data
        )

        session.add(user)
        session.add(transaction)
        await session.commit()
        await session.refresh(transaction)

        logger.info(
            f"💸 Coins deducted | "
            f"user_id={str(user_id)[:8]}... | "
            f"amount={amount} | "
            f"new_balance={user.coins_balance} | "
            f"description={description}"
        )

        return transaction

    @staticmethod
    async def refund_coins(
        session: AsyncSession,
        user_id: UUID,
        amount: int,
        description: str,
        reference_id: Optional[str] = None,
        meta_data: Optional[dict] = None
    ) -> CoinTransaction:
        """
        Refund coins to a user.
        Creates a transaction record for audit trail.
        """
        if amount <= 0:
            raise ValueError("Amount must be positive")

        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Update user balance
        user.coins_balance += amount
        # Also reduce total used since this is a refund
        user.coins_total_used = max(0, user.coins_total_used - amount)

        # Create transaction record
        transaction = CoinTransaction(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.REFUND,
            description=description,
            reference_id=reference_id,
            balance_after=user.coins_balance,
            meta_data=meta_data
        )

        session.add(user)
        session.add(transaction)
        await session.commit()
        await session.refresh(transaction)

        logger.info(
            f"🔄 Coins refunded | "
            f"user_id={str(user_id)[:8]}... | "
            f"amount={amount} | "
            f"new_balance={user.coins_balance} | "
            f"description={description}"
        )

        return transaction

    @staticmethod
    async def adjust_coins(
        session: AsyncSession,
        user_id: UUID,
        amount: int,
        description: str,
        meta_data: Optional[dict] = None
    ) -> CoinTransaction:
        """
        Manual adjustment of coins (admin only).
        Can be positive or negative.
        """
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Update user balance
        user.coins_balance += amount

        # Update allocation or usage tracking
        if amount > 0:
            user.coins_total_allocated += amount
        else:
            user.coins_total_used += abs(amount)

        # Create transaction record
        transaction = CoinTransaction(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.ADJUSTMENT,
            description=description,
            balance_after=user.coins_balance,
            meta_data=meta_data
        )

        session.add(user)
        session.add(transaction)
        await session.commit()
        await session.refresh(transaction)

        logger.info(
            f"⚙️ Coins adjusted | "
            f"user_id={str(user_id)[:8]}... | "
            f"amount={amount} | "
            f"new_balance={user.coins_balance} | "
            f"description={description}"
        )

        return transaction

    @staticmethod
    async def get_transaction_history(
        session: AsyncSession,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0,
        transaction_type: Optional[TransactionType] = None
    ) -> List[dict]:
        """Get user's coin transaction history."""
        query = select(CoinTransaction).where(CoinTransaction.user_id == user_id)

        if transaction_type:
            query = query.where(CoinTransaction.transaction_type == transaction_type)

        query = query.order_by(CoinTransaction.created_at.desc()).offset(offset).limit(limit)

        result = await session.execute(query)
        transactions = result.scalars().all()

        return [
            {
                "id": str(transaction.id),
                "amount": transaction.amount,
                "transaction_type": transaction.transaction_type,
                "description": transaction.description,
                "reference_id": transaction.reference_id,
                "reference_type": transaction.reference_type,
                "balance_after": transaction.balance_after,
                "metadata": transaction.meta_data,
                "created_at": transaction.created_at.isoformat()
            }
            for transaction in transactions
        ]


coin_service = CoinService()
